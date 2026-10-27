import { anna, fetchBlob } from "./anna";
import { ensureMp3 } from "./mp3";
import type { CatalogModel, Catalogs, ImagePlan, SongPlan, VoicePlan } from "./pricing";
import { songSeconds } from "./pricing";
import { buildWordsPrompt, normaliseLyrics, parseWords, type CardRequest, type CardWords, type LyricsSpec } from "./prompts";

// ── Catalogue & credits ─────────────────────────────────────────────

export async function loadCatalogs(): Promise<Catalogs> {
  const get = async (serviceType: string) => {
    try {
      return await anna().llm.catalog({ serviceType });
    } catch {
      return { models: [], quota: null };
    }
  };
  const [image, tts, music] = await Promise.all([get("image_gen"), get("tts"), get("music_gen")]);
  return {
    image: (image.models ?? []) as CatalogModel[],
    tts: (tts.models ?? []) as CatalogModel[],
    music: (music.models ?? []) as CatalogModel[],
    remainingCU: image.quota?.remainingCU ?? tts.quota?.remainingCU ?? music.quota?.remainingCU ?? null,
  };
}

export async function refreshCredits(): Promise<number | null> {
  try {
    const r = await anna().llm.catalog({ serviceType: "image_gen" });
    return r.quota?.remainingCU ?? null;
  } catch {
    return null;
  }
}

// ── Words ───────────────────────────────────────────────────────────

export async function writeWords(req: CardRequest, lyrics: LyricsSpec | null): Promise<CardWords> {
  const { system, user } = buildWordsPrompt(req, lyrics);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anna().llm.complete({
      systemPrompt: system,
      messages: [{ role: "user", content: { type: "text", text: user } }],
      maxTokens: 1400,
      temperature: attempt === 0 ? 0.9 : 0.6,
    });
    try {
      return parseWords(String(res?.content?.text ?? ""));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ── Async media jobs (image + music) ────────────────────────────────

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "expired"]);

export class JobError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Poll a host media job until it ends. Jobs keep running on Anna's servers
 * even if the window is closed, so a reopened app resumes from the saved id.
 */
export async function awaitJob(
  ns: "image" | "music",
  jobId: string,
  opts: { signal?: AbortSignal; onState?: (state: string) => void; timeoutMs?: number } = {},
): Promise<any> {
  const started = Date.now();
  const limit = opts.timeoutMs ?? 12 * 60 * 1000;
  let delay = 2500;
  for (;;) {
    if (opts.signal?.aborted) throw new JobError("cancelled", "Stopped.");
    let view: any;
    try {
      view = await anna()[ns].getJob({ jobId });
    } catch (e: any) {
      const code = String(e?.code ?? "");
      if (code.includes("NOT_FOUND")) throw new JobError(code, "This job is no longer available.");
      view = null;
    }
    if (view) {
      opts.onState?.(view.state);
      if (view.state === "succeeded") return view;
      if (TERMINAL.has(view.state)) {
        throw new JobError(String(view.error?.code ?? view.state), String(view.error?.message ?? `The job ${view.state}.`));
      }
    }
    if (Date.now() - started > limit) throw new JobError("TIMEOUT", "This step took too long.");
    await sleep(delay, opts.signal);
    delay = Math.min(delay + 500, 5000);
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export async function submitArt(prompt: string, plan: ImagePlan, key: string): Promise<string> {
  const args: Record<string, unknown> = {
    prompt,
    model: plan.model,
    size: plan.size,
    n: 1,
    clientTag: "card-art",
    idempotencyKey: key,
  };
  if (plan.quality) args.quality = plan.quality;
  const job = await anna().image.generateAsync(args);
  return String(job.jobId);
}

export async function artFromJob(view: any): Promise<Blob> {
  const img = view?.result?.images?.[0];
  if (!img?.url) throw new JobError("EMPTY", "The art service returned no image.");
  return fetchBlob(img.url);
}

export async function submitSong(words: CardWords, plan: SongPlan, key: string): Promise<string> {
  const lyrics = normaliseLyrics(words.lyrics);
  const style = words.songStyle || "cheerful acoustic celebration song, warm vocals, light percussion";
  const args: Record<string, unknown> = { model: plan.model, clientTag: "card-song", idempotencyKey: key };
  if (plan.lyricsField) {
    args.prompt = style;
    if (lyrics) args.lyrics = lyrics;
  } else {
    args.prompt = lyrics ? `${style}. Sing these lyrics exactly, all of them:\n${lyrics}` : style;
  }
  if (plan.variableLength) args.durationSec = songSeconds(lyrics, plan);
  if (plan.formats.includes("mp3")) args.format = "mp3";
  const job = await anna().music.generate(args);
  return String(job.jobId);
}

export async function songFromJob(view: any): Promise<{ blob: Blob; lyrics: string }> {
  const url = view?.result?.url;
  if (!url) throw new JobError("EMPTY", "The music service returned no song.");
  const raw = await fetchBlob(url);
  // Some models (Lyria) put production notes in `lyrics`; only trust real, tagged lyrics.
  const echoed = String(view.result.lyrics ?? "");
  const lyrics = /\[(verse|chorus)/i.test(echoed) && !/^\s*caption:/i.test(echoed) ? echoed : "";
  return { blob: await ensureMp3(raw), lyrics };
}

// ── Voice ───────────────────────────────────────────────────────────

export async function speak(text: string, plan: VoicePlan): Promise<Blob> {
  const args: Record<string, unknown> = {
    text: text.slice(0, plan.maxChars),
    model: plan.model,
    voice: plan.voice,
    format: "mp3",
  };
  const res = await anna().audio.speak(args, { timeoutMs: 150_000 });
  let blob: Blob;
  if (res?.audioBase64) {
    const bin = atob(res.audioBase64);
    blob = new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: res.mimeType || "audio/mpeg" });
  } else if (res?.url) {
    blob = await fetchBlob(res.url);
  } else {
    throw new JobError("EMPTY", "The voice service returned no audio.");
  }
  return ensureMp3(blob);
}

// ── APS files ───────────────────────────────────────────────────────

export async function saveFile(path: string, blob: Blob): Promise<string> {
  const type = blob.type || "application/octet-stream";
  const init = await anna().files.upload_init({ path, size: blob.size, content_type: type });
  const put = await fetch(init.put_url, { method: "PUT", body: blob, headers: init.headers ?? { "Content-Type": type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  await anna().files.upload_finalize({ path, upload_id: init.upload_id });
  return path;
}

export async function fileUrl(path: string): Promise<string> {
  const r = await anna().files.download_url({ path, ttl_seconds: 1800 });
  return r.get_url;
}

export async function loadFile(path: string): Promise<Blob> {
  return fetchBlob(await fileUrl(path));
}

export async function deleteFile(path: string) {
  try {
    await anna().files.delete({ path });
  } catch {
    /* already gone */
  }
}

/** Host-mediated download (top-level browsing context); falls back to a local link. */
export async function downloadFile(path: string | null, blob: Blob | null, filename: string) {
  if (path) {
    try {
      await anna().files.download({ path, filename });
      return;
    } catch {
      /* fall through to a local download */
    }
  }
  if (!blob) throw new Error("Nothing to download yet.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
