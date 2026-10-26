import { useEffect, useRef, useState } from "preact/hooks";
import { anna, errorCode } from "../lib/anna";
import { ensureFonts, renderCard } from "../lib/card";
import { CARD_FONTS, RTL_LANGS, type CardFontId } from "../lib/data";
import { cardContent, cardDataUrl, renderCardBlob, type CardJob, type StageId } from "../lib/job";
import type { CardWords } from "../lib/prompts";
import { downloadFile } from "../lib/services";

export interface StudioProps {
  job: CardJob;
  onRetry: (id: StageId) => void;
  onAdd: (id: "art" | "voice" | "song") => void;
  onEdit: (patch: Partial<CardWords>) => void;
  onFont: (f: CardFontId) => void;
  onSave: () => void;
  onStop: () => void;
  onNew: () => void;
  notify: (msg: string) => void;
}

const STAGE_COPY: Record<StageId, { working: string; done: string; label: string }> = {
  words: { label: "Words", working: "Writing your message…", done: "Message written" },
  art: { label: "Art", working: "Painting the card art… (about 30 seconds)", done: "Art painted" },
  voice: { label: "Voice", working: "Recording the voice note…", done: "Voice note recorded" },
  song: { label: "Song", working: "Composing the song…", done: "Song composed" },
  save: { label: "Save", working: "Saving to My cards…", done: "Saved to My cards" },
};

function slug(s: string) {
  return (s || "card").normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "card";
}

export function Studio({ job, onRetry, onAdd, onEdit, onFont, onSave, onStop, onNew, notify }: StudioProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const words = job.words;
  const st = job.stages;
  const working = Object.values(st).some((s) => s.state === "working");
  const rtl = RTL_LANGS.has(job.request.language);
  const fileBase = `wishcraft-${slug(job.request.recipient)}`;

  useEffect(() => {
    if (!canvas.current || !words) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await ensureFonts(job.font);
      if (!cancelled && canvas.current) renderCard(canvas.current, job.art, cardContent(job));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [words?.title, words?.message, words?.signoff, job.art, job.font, job.id]);

  const download = async () => {
    try {
      const path = job.dirty ? null : job.files.card ?? null;
      await downloadFile(path, path ? null : await renderCardBlob(job), `${fileBase}.jpg`);
    } catch (e) {
      notify("The card couldn't be downloaded. Try again.");
    }
  };

  const share = async () => {
    if (!words) return;
    setSharing(true);
    try {
      const dataUrl = await cardDataUrl(job);
      try {
        const r = await anna().mobile.share({ title: words.title, text: words.message, data_url: dataUrl, filename: `${fileBase}.jpg` });
        if (r?.shared !== false) notify("Shared.");
        return;
      } catch (e) {
        if (errorCode(e) !== "unsupported_container" && errorCode(e) !== "permission_denied") throw e;
      }
      const blob = await renderCardBlob(job);
      const file = new File([blob], `${fileBase}.jpg`, { type: "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: words.title, text: words.message });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      await downloadFile(null, blob, `${fileBase}.jpg`);
      await copyText(false);
      notify("Card downloaded and message copied. Paste it with the picture in any chat app.");
    } catch {
      notify("Sharing didn't work here. Use Download card instead.");
    } finally {
      setSharing(false);
    }
  };

  const copyText = async (announce = true) => {
    if (!words) return;
    const text = [words.title, words.message, words.signoff].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      if (announce) notify("Message copied.");
    } catch {
      if (announce) notify("Copying isn't allowed here. Select the message text and copy it.");
    }
  };

  const sendToChat = async () => {
    try {
      await anna().chat.append_artifact({
        artifact: {
          kind: "wishcraft_card",
          app_slug: "wishcraft",
          summary: `${words?.title ?? "Card"} — ${words?.message ?? ""}`.slice(0, 1000),
          payload_ref: job.files.card,
        },
      });
      notify("Card added to your Anna chat.");
    } catch {
      notify("The card couldn't be added to chat.");
    }
  };

  return (
    <section class="studio" aria-label="Your card">
      <div class="desk">
        <div class={`card-frame${job.art ? " has-art" : ""}${words ? "" : " is-blank"}`}>
          {words ? (
            <canvas ref={canvas} class="card-canvas" role="img" aria-label={`Card: ${words.title}. ${words.message} ${words.signoff}`} />
          ) : (
            <div class="card-blank">
              <span class="quill" aria-hidden="true" />
              <p>{st.words.state === "failed" ? "The message couldn't be written." : "Writing your message…"}</p>
            </div>
          )}
        </div>

        <ol class="stages" aria-live="polite">
          {(Object.keys(STAGE_COPY) as StageId[])
            .filter((id) => st[id].state !== "skipped")
            .map((id) => (
              <li key={id} class={`stage is-${st[id].state}`}>
                <span class="stage__dot" aria-hidden="true" />
                <span class="stage__text">
                  {st[id].state === "done"
                    ? STAGE_COPY[id].done
                    : st[id].state === "failed"
                      ? st[id].error
                      : st[id].state === "working"
                        ? STAGE_COPY[id].working
                        : `${STAGE_COPY[id].label}: waiting`}
                </span>
                {st[id].state === "failed" && (
                  <button type="button" class="link" onClick={() => onRetry(id)}>
                    Try again
                  </button>
                )}
              </li>
            ))}
        </ol>
        {working && (st.art.state === "working" || st.song.state === "working") && (
          <button type="button" class="link quiet" onClick={onStop}>
            Stop painting and composing
          </button>
        )}
      </div>

      {words && (
        <div class="sheet">
          <div class="actions">
            <button type="button" class="btn primary" onClick={download} disabled={st.words.state !== "done"}>
              Download card
            </button>
            <button type="button" class="btn" onClick={share} disabled={sharing}>
              {sharing ? "Preparing…" : "Share"}
            </button>
            <button type="button" class="btn" onClick={() => copyText()}>
              Copy message
            </button>
            {job.files.card && (
              <button type="button" class="btn" onClick={sendToChat}>
                Add to chat
              </button>
            )}
          </div>

          {(job.voice || job.song || !job.extras.art || !job.extras.voice || !job.extras.song) && (
            <div class="media">
              {job.voice && (
                <div class="clip">
                  <span class="clip__title">Voice note</span>
                  <audio controls src={job.voice.url} preload="metadata" />
                  <div class="clip__row">
                    {job.voiceStale && (
                      <button type="button" class="link" onClick={() => onRetry("voice")} disabled={st.voice.state === "working"}>
                        Record again with the new words
                      </button>
                    )}
                    <button
                      type="button"
                      class="link"
                      onClick={() => downloadFile(job.files.voice ?? null, job.voice!.blob, `${fileBase}-voice.mp3`).catch(() => notify("The voice note couldn't be downloaded."))}
                    >
                      Download voice note
                    </button>
                  </div>
                </div>
              )}
              {job.song && (
                <div class="clip">
                  <span class="clip__title">Song</span>
                  <audio controls src={job.song.url} preload="metadata" />
                  <div class="clip__row">
                    <button
                      type="button"
                      class="link"
                      onClick={() =>
                        downloadFile(job.files.song ?? null, job.song!.blob, `${fileBase}-song.${job.song!.blob.type.includes("mpeg") ? "mp3" : "wav"}`).catch(() =>
                          notify("The song couldn't be downloaded."),
                        )
                      }
                    >
                      Download song
                    </button>
                  </div>
                  {job.song.lyrics && (
                    <details>
                      <summary>Lyrics</summary>
                      <pre class="lyrics" dir={rtl ? "rtl" : "auto"}>{job.song.lyrics.replace(/\[(verse|chorus|bridge|intro|outro)\]\n?/g, "")}</pre>
                    </details>
                  )}
                </div>
              )}
              <div class="add-row">
                {!job.extras.art && st.words.state === "done" && (
                  <button type="button" class="link" onClick={() => onAdd("art")}>
                    Add card art
                  </button>
                )}
                {!job.extras.voice && st.words.state === "done" && (
                  <button type="button" class="link" onClick={() => onAdd("voice")}>
                    Add a voice note
                  </button>
                )}
                {!job.extras.song && st.words.state === "done" && (
                  <button type="button" class="link" onClick={() => onAdd("song")}>
                    Add a song
                  </button>
                )}
              </div>
            </div>
          )}

          <details class="edit" open={false}>
            <summary>Edit the words</summary>
            <label class="field">
              <span class="label">Headline</span>
              <input class="input" dir="auto" value={words.title} maxLength={80} onInput={(e) => onEdit({ title: e.currentTarget.value })} />
            </label>
            <label class="field">
              <span class="label">Message</span>
              <textarea class="input" dir="auto" rows={6} value={words.message} maxLength={900} onInput={(e) => onEdit({ message: e.currentTarget.value })} />
            </label>
            <label class="field">
              <span class="label">Sign-off</span>
              <input class="input" dir="auto" value={words.signoff} maxLength={120} onInput={(e) => onEdit({ signoff: e.currentTarget.value })} />
            </label>
            <label class="field">
              <span class="label">Lettering</span>
              <select class="input" value={job.font} onChange={(e) => onFont(e.currentTarget.value as CardFontId)}>
                {CARD_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <div class="edit__row">
              <button type="button" class="btn primary" onClick={onSave} disabled={!job.dirty || st.save.state === "working"}>
                {job.dirty ? "Save changes" : "Changes saved"}
              </button>
              {job.extras.art && (
                <button type="button" class="btn" onClick={() => onRetry("art")} disabled={st.art.state === "working"}>
                  Repaint the art
                </button>
              )}
            </div>
          </details>

          <button type="button" class="link" onClick={onNew}>
            Make another card
          </button>
        </div>
      )}
    </section>
  );
}
