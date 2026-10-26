import { useCallback, useRef, useState } from "preact/hooks";
import { problemText } from "./anna";
import { blobToDataUrl, canvasToBlob, CARD_H, CARD_W, ensureFonts, renderCard, type CardContent } from "./card";
import { occasionById, type CardFontId } from "./data";
import { newCardId, saveCard, type SavedCard } from "./history";
import { planImage, planSong, planVoice, type Catalogs, type Extras } from "./pricing";
import { buildArtPrompt, voiceScript, type CardRequest, type CardWords } from "./prompts";
import { composeSong, loadFile, paintArt, saveFile, speak, writeWords } from "./services";

export type StageId = "words" | "art" | "voice" | "song" | "save";
export type StageState = "waiting" | "working" | "done" | "failed" | "skipped";

export interface Stage {
  state: StageState;
  error?: string;
}

export type Stages = Record<StageId, Stage>;

export interface Media {
  blob: Blob;
  url: string;
}

export interface CardJob {
  id: string;
  createdAt: string;
  request: CardRequest;
  extras: Extras;
  words: CardWords | null;
  font: CardFontId;
  art: ImageBitmap | null;
  artBlob: Blob | null;
  voice: Media | null;
  song: (Media & { lyrics: string }) | null;
  stages: Stages;
  files: SavedCard["files"];
  /** Words edited since the card image was last saved. */
  dirty: boolean;
  /** Voice note was recorded from older words. */
  voiceStale: boolean;
}

const initialStages = (extras: Extras): Stages => ({
  words: { state: "waiting" },
  art: { state: extras.art ? "waiting" : "skipped" },
  voice: { state: extras.voice ? "waiting" : "skipped" },
  song: { state: extras.song ? "waiting" : "skipped" },
  save: { state: "waiting" },
});

function media(blob: Blob): Media {
  return { blob, url: URL.createObjectURL(blob) };
}

export function cardContent(job: CardJob): CardContent {
  const w = job.words;
  return {
    title: w?.title ?? "",
    message: w?.message ?? "",
    signoff: w?.signoff ?? "",
    language: job.request.language,
    font: job.font,
    wash: occasionById(job.request.occasion).wash,
    seed: parseInt(job.id.slice(-6), 36) || 7,
  };
}

async function artToJpeg(bmp: ImageBitmap): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  return canvasToBlob(c, "image/jpeg", 0.88);
}

export async function renderCardBlob(job: CardJob): Promise<Blob> {
  await ensureFonts(job.font);
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  renderCard(c, job.art, cardContent(job));
  return canvasToBlob(c, "image/jpeg", 0.9);
}

export async function cardDataUrl(job: CardJob): Promise<string> {
  return blobToDataUrl(await renderCardBlob(job));
}

export function toSaved(job: CardJob): SavedCard {
  return {
    id: job.id,
    createdAt: job.createdAt,
    request: job.request,
    title: job.words?.title ?? "",
    message: job.words?.message ?? "",
    signoff: job.words?.signoff ?? "",
    lyrics: job.song?.lyrics ?? job.words?.lyrics,
    font: job.font,
    files: job.files,
  };
}

export function useCardJob(getCatalogs: () => Catalogs | null, onCredits: () => void) {
  const [job, setJob] = useState<CardJob | null>(null);
  const ref = useRef<CardJob | null>(null);
  const abort = useRef<AbortController | null>(null);

  const update = useCallback((patch: Partial<CardJob> | ((j: CardJob) => Partial<CardJob>)) => {
    const cur = ref.current;
    if (!cur) return;
    const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
    ref.current = next;
    setJob(next);
  }, []);

  const setStage = useCallback(
    (id: StageId, stage: Stage) => update((j) => ({ stages: { ...j.stages, [id]: stage } })),
    [update],
  );

  const runStage = useCallback(
    async <T,>(id: StageId, fn: () => Promise<T>): Promise<T | null> => {
      setStage(id, { state: "working" });
      try {
        const out = await fn();
        setStage(id, { state: "done" });
        return out;
      } catch (e) {
        if ((e as any)?.code === "cancelled") {
          setStage(id, { state: "failed", error: "Stopped." });
        } else {
          console.warn(`[wishcraft] ${id} failed`, e);
          setStage(id, { state: "failed", error: problemText(e) });
        }
        return null;
      }
    },
    [setStage],
  );

  const doArt = useCallback(async () => {
    const j = ref.current;
    const cat = getCatalogs();
    if (!j?.words || !cat) return;
    const plan = planImage(cat.image);
    if (!plan) return setStage("art", { state: "failed", error: "Card art isn't available on your Anna account." });
    const art = await runStage("art", () => paintArt(buildArtPrompt(j.words!, j.request), plan, abort.current?.signal));
    if (art) {
      const bmp = await createImageBitmap(art.blob);
      update({ art: bmp, artBlob: art.blob, dirty: true });
    }
  }, [getCatalogs, runStage, setStage, update]);

  const doVoice = useCallback(async () => {
    const j = ref.current;
    const cat = getCatalogs();
    if (!j?.words || !cat) return;
    const plan = planVoice(cat.tts, j.request.language);
    if (!plan) return setStage("voice", { state: "failed", error: "Voice notes aren't available on your Anna account." });
    const clip = await runStage("voice", () => speak(voiceScript(j.words!), plan, j.request.language));
    if (clip) {
      if (ref.current?.voice) URL.revokeObjectURL(ref.current.voice.url);
      update({ voice: media(clip.blob), voiceStale: false });
    }
  }, [getCatalogs, runStage, setStage, update]);

  const doSong = useCallback(async () => {
    const j = ref.current;
    const cat = getCatalogs();
    if (!j?.words || !cat) return;
    const plan = planSong(cat.music);
    if (!plan) return setStage("song", { state: "failed", error: "Songs aren't available on your Anna account." });
    const song = await runStage("song", () => composeSong(j.words!, plan, abort.current?.signal));
    if (song) {
      if (ref.current?.song) URL.revokeObjectURL(ref.current.song.url);
      update({ song: { ...media(song.blob), lyrics: song.lyrics } });
    }
  }, [getCatalogs, runStage, setStage, update]);

  /** Upload whatever exists and write the history record. */
  const doSave = useCallback(async () => {
    await runStage("save", async () => {
      const j = ref.current!;
      const base = `cards/${j.id}/`;
      const files = { ...j.files };
      files.card = await saveFile(base + "card.jpg", await renderCardBlob(j));
      const uploads: Promise<void>[] = [];
      if (j.art && !files.art) uploads.push(artToJpeg(j.art).then((b) => saveFile(base + "art.jpg", b)).then((p) => void (files.art = p)));
      if (j.voice) uploads.push(saveFile(base + "voice.mp3", j.voice.blob).then((p) => void (files.voice = p)));
      if (j.song && !files.song) {
        const ext = j.song.blob.type.includes("mpeg") ? "mp3" : "wav";
        uploads.push(saveFile(`${base}song.${ext}`, j.song.blob).then((p) => void (files.song = p)));
      }
      // Media copies are best-effort: the card itself is what matters.
      await Promise.allSettled(uploads);
      update({ files, dirty: false });
      await saveCard(toSaved(ref.current!));
    });
    onCredits();
  }, [onCredits, runStage, update]);

  const create = useCallback(
    async (request: CardRequest, extras: Extras, font: CardFontId) => {
      abort.current?.abort();
      abort.current = new AbortController();
      const fresh: CardJob = {
        id: newCardId(),
        createdAt: new Date().toISOString(),
        request,
        extras,
        words: null,
        font,
        art: null,
        artBlob: null,
        voice: null,
        song: null,
        stages: initialStages(extras),
        files: {},
        dirty: false,
        voiceStale: false,
      };
      ref.current = fresh;
      setJob(fresh);
      const words = await runStage("words", () => writeWords(request));
      if (!words) {
        setStage("save", { state: "skipped" });
        return;
      }
      update({ words });
      await Promise.allSettled([extras.art && doArt(), extras.voice && doVoice(), extras.song && doSong()]);
      await doSave();
    },
    [doArt, doSave, doSong, doVoice, runStage, setStage, update],
  );

  const retry = useCallback(
    async (id: StageId) => {
      const j = ref.current;
      if (!j) return;
      if (id === "words") return create(j.request, j.extras, j.font);
      abort.current = new AbortController();
      if (id === "art") {
        update({ files: { ...j.files, art: undefined } });
        await doArt();
      }
      if (id === "voice") await doVoice();
      if (id === "song") {
        update({ files: { ...j.files, song: undefined } });
        await doSong();
      }
      if (j.stages.words.state === "done") await doSave();
    },
    [create, doArt, doSave, doSong, doVoice, update],
  );

  const addExtra = useCallback(
    async (id: "art" | "voice" | "song") => {
      const j = ref.current;
      if (!j) return;
      update({ extras: { ...j.extras, [id]: true } });
      await retry(id);
    },
    [retry, update],
  );

  const editWords = useCallback(
    (patch: Partial<CardWords>) =>
      update((j) => ({
        words: j.words ? { ...j.words, ...patch } : j.words,
        dirty: true,
        voiceStale: !!j.voice || j.voiceStale,
      })),
    [update],
  );

  const setFont = useCallback((font: CardFontId) => update({ font, dirty: true }), [update]);

  const stop = useCallback(() => abort.current?.abort(), []);

  /** Reopen a saved card from My cards. */
  const open = useCallback(async (card: SavedCard) => {
    abort.current?.abort();
    const done: Stage = { state: "done" };
    const skipped: Stage = { state: "skipped" };
    const fresh: CardJob = {
      id: card.id,
      createdAt: card.createdAt,
      request: card.request,
      extras: { art: !!card.files.art, voice: !!card.files.voice, song: !!card.files.song },
      words: { title: card.title, message: card.message, signoff: card.signoff, artPrompt: "", songStyle: "", lyrics: card.lyrics ?? "" },
      font: card.font,
      art: null,
      artBlob: null,
      voice: null,
      song: null,
      stages: {
        words: done,
        art: card.files.art ? { state: "working" } : skipped,
        voice: card.files.voice ? { state: "working" } : skipped,
        song: card.files.song ? { state: "working" } : skipped,
        save: done,
      },
      files: card.files,
      dirty: false,
      voiceStale: false,
    };
    ref.current = fresh;
    setJob(fresh);
    const load = async (id: "art" | "voice" | "song", path?: string) => {
      if (!path) return;
      try {
        const blob = await loadFile(path);
        if (ref.current?.id !== card.id) return;
        if (id === "art") update({ art: await createImageBitmap(blob), artBlob: blob });
        if (id === "voice") update({ voice: media(blob) });
        if (id === "song") update({ song: { ...media(blob), lyrics: card.lyrics ?? "" } });
        setStage(id, done);
      } catch (e) {
        setStage(id, { state: "failed", error: "This file couldn't be loaded. " + problemText(e) });
      }
    };
    await Promise.all([load("art", card.files.art), load("voice", card.files.voice), load("song", card.files.song)]);
  }, [setStage, update]);

  const reset = useCallback(() => {
    abort.current?.abort();
    ref.current = null;
    setJob(null);
  }, []);

  return { job, create, retry, addExtra, editWords, setFont, save: doSave, stop, open, reset };
}
