import { useSyncExternalStore } from "react";
import { anna, problemText } from "./anna";
import { audioController } from "./audio";
import { imageToJpeg, renderCardBlob, seedFromId, type CardContent } from "./card";
import type { LetteringId } from "./data";
import { buildZip, exportFileName, type ExportKind } from "./exporter";
import { lyricsSpec, planImage, planSong, planVoice, type Catalogs, type Extras } from "./pricing";
import { buildArtPrompt, voiceScript, type CardRequest, type CardWords } from "./prompts";
import {
  getRecord,
  initialStages,
  needsResume,
  newCardId,
  saveRecord,
  type CardRecord,
  type StageId,
  type StageState,
} from "./records";
import {
  artFromJob,
  awaitJob,
  downloadFile,
  loadFile,
  saveFile,
  songFromJob,
  speak,
  submitArt,
  submitSong,
  writeWords,
} from "./services";

export interface Media {
  blob: Blob;
  url: string;
}

export interface CardView {
  record: CardRecord;
  art: ImageBitmap | null;
  voice: Media | null;
  song: Media | null;
  card: Media | null;
  /** Words or lettering changed since the card image was saved. */
  dirty: boolean;
  /** Voice note was recorded from older words. */
  voiceStale: boolean;
  /** Something is being exported (zip, etc.). */
  exporting: boolean;
}

type Listener = () => void;

/** Voice recordings in flight, keyed by card and script, shared across detach/reopen. */
const inflightVoice = new Map<string, Promise<Blob>>();
interface Run {
  id: string;
  t: number;
}

function media(blob: Blob): Media {
  return { blob, url: URL.createObjectURL(blob) };
}

function release(v: CardView | null) {
  if (!v) return;
  for (const m of [v.voice, v.song, v.card]) if (m) URL.revokeObjectURL(m.url);
  v.art?.close?.();
}

export function contentOf(r: CardRecord, placeholder = false): CardContent {
  return {
    title: r.words?.title ?? "",
    message: r.words?.message ?? "",
    signoff: r.words?.signoff ?? "",
    language: r.request.language,
    lettering: r.lettering,
    occasion: r.request.occasion,
    seed: seedFromId(r.id),
    placeholder,
  };
}

/**
 * Owns the card being made or viewed. Lives outside React so that a re-render,
 * a closed window or a StrictMode double effect can never start a step twice.
 */
class Studio {
  private view: CardView | null = null;
  private listeners = new Set<Listener>();
  private abort = new AbortController();
  private running = new Set<StageId>();
  private token = 0;
  /** Words and lettering of the last saved card image, while edits are unsaved. */
  private saved: { words: CardWords; lettering: LetteringId } | null = null;
  private saving: Promise<void> = Promise.resolve();
  onCredits: () => void = () => {};

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.view;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private patch(p: Partial<CardView>) {
    if (!this.view) return;
    this.view = { ...this.view, ...p };
    this.emit();
  }

  private patchRecord(p: Partial<CardRecord>, persist = true) {
    if (!this.view) return;
    const record = { ...this.view.record, ...p, updatedAt: new Date().toISOString() };
    this.view = { ...this.view, record };
    this.emit();
    if (persist) this.persist();
  }

  private setStage(id: StageId, state: StageState, error?: string) {
    if (!this.view) return;
    this.patchRecord({ stages: { ...this.view.record.stages, [id]: { state, ...(error ? { error } : {}) } } });
  }

  /** Writes are queued so an older snapshot can never overwrite a newer one. */
  private persist() {
    const v = this.view;
    if (!v) return;
    const snapshot = v.dirty && this.saved ? { ...v.record, words: this.saved.words, lettering: this.saved.lettering } : v.record;
    this.saving = this.saving.then(() => saveRecord(snapshot)).catch((e) => console.warn("[wishcraft] save failed", e));
  }

  flush(): Promise<void> {
    return this.saving;
  }

  /** The user left the card while its voice note was recording: keep the paid audio anyway. */
  private keepDetachedVoice(id: string, blob: Blob): Promise<void> {
    if (this.view?.record.id === id) return Promise.resolve();
    const done = this.saving.then(async () => {
      const path = await saveFile(`cards/${id}/voice.mp3`, blob);
      const rec = await getRecord(id);
      if (!rec || rec.files.voice) return;
      await saveRecord({
        ...rec,
        files: { ...rec.files, voice: path },
        stages: { ...rec.stages, voice: { state: "done" } },
        updatedAt: new Date().toISOString(),
      });
    });
    this.saving = done.catch((e) => console.warn("[wishcraft] keeping voice failed", e));
    return this.saving;
  }

  /** True only for the run that is attached now; a detached run can never touch a reopened card. */
  private isCurrent(run: Run) {
    return this.token === run.t && this.view?.record.id === run.id;
  }

  private ctx(): Run {
    return { id: this.view!.record.id, t: this.token };
  }

  /** Leave the current card; its media jobs keep running and resume on reopen. */
  detach() {
    this.token++;
    this.saved = null;
    this.abort.abort();
    this.abort = new AbortController();
    this.running.clear();
    audioController.stop();
    release(this.view);
    this.view = null;
    this.emit();
  }

  // ── Creating ────────────────────────────────────────────────────

  async create(request: CardRequest, extras: Extras, lettering: LetteringId, catalogs: Catalogs) {
    this.detach();
    const now = new Date().toISOString();
    const image = extras.art ? planImage(catalogs.image) : null;
    const voice = extras.voice ? planVoice(catalogs.tts, request.language) : null;
    const song = extras.song ? planSong(catalogs.music, request.language) : null;
    const effective = { art: !!image, voice: !!voice, song: !!song };
    const record: CardRecord = {
      v: 2,
      id: newCardId(),
      createdAt: now,
      updatedAt: now,
      request,
      extras: effective,
      lettering,
      words: null,
      stages: initialStages(effective),
      jobs: {},
      attempts: { art: 0, song: 0 },
      plans: { image, voice, song },
      files: {},
    };
    this.view = { record, art: null, voice: null, song: null, card: null, dirty: false, voiceStale: false, exporting: false };
    this.emit();
    this.persist();
    await this.run(this.ctx());
    return record.id;
  }

  /** Run every unfinished step of the current card, in order. */
  private async run(run: Run) {
    const r = () => this.view?.record;
    if (!r()) return;
    if (r()!.stages.words.state !== "done") {
      await this.runWords(run);
      if (!this.isCurrent(run) || r()!.stages.words.state !== "done") return;
    }
    const pending = (s: StageId) => ["waiting", "working"].includes(r()!.stages[s].state);
    await Promise.allSettled([
      pending("art") ? this.runArt(run) : this.loadDone(run, "art"),
      pending("voice") ? this.runVoice(run) : this.loadDone(run, "voice"),
      pending("song") ? this.runSong(run) : this.loadDone(run, "song"),
    ]);
    if (!this.isCurrent(run)) return;
    if (r()!.stages.card.state !== "done" || !r()!.files.card) await this.runCard(run);
    else await this.loadDone(run, "card");
    this.onCredits();
  }

  private async step<T>(run: Run, stage: StageId, fn: () => Promise<T>): Promise<T | null> {
    if (this.running.has(stage)) return null;
    this.running.add(stage);
    this.setStage(stage, "working");
    try {
      const out = await fn();
      if (this.isCurrent(run)) this.setStage(stage, "done");
      return out;
    } catch (e: any) {
      if (!this.isCurrent(run)) return null;
      if (e?.code === "aborted" || e?.code === "cancelled") {
        this.setStage(stage, "failed", "Stopped. Try again when you're ready.");
      } else {
        console.warn(`[wishcraft] ${stage} failed`, e);
        this.setStage(stage, "failed", problemText(e));
      }
      return null;
    } finally {
      if (this.token === run.t) this.running.delete(stage);
    }
  }

  private runWords(run: Run) {
    return this.step(run, "words", async () => {
      const rec = this.view!.record;
      const words = await writeWords(rec.request, lyricsSpec(rec.plans.song ?? null));
      if (this.isCurrent(run)) this.patchRecord({ words, lyrics: words.lyrics });
      return words;
    });
  }

  private runArt(run: Run) {
    const id = run.id;
    return this.step(run, "art", async () => {
      const rec = this.view!.record;
      const plan = rec.plans.image;
      if (!plan || !rec.words) throw new Error("Card art isn't available on your Anna account.");
      let jobId = rec.jobs.art;
      if (!jobId) {
        jobId = await submitArt(buildArtPrompt(rec.words, rec.request), plan, `${id}-art-${rec.attempts.art}`);
        if (!this.isCurrent(run)) return;
        this.patchRecord({ jobs: { ...this.view!.record.jobs, art: jobId } });
      }
      let view;
      try {
        view = await awaitJob("image", jobId, { signal: this.abort.signal });
      } catch (e: any) {
        // Keep the job id only when we stopped polling; a failed or cancelled job can't be resumed.
        if (e?.code !== "aborted" && this.isCurrent(run)) this.patchRecord({ jobs: { ...this.view!.record.jobs, art: undefined } });
        throw e;
      }
      const blob = await artFromJob(view);
      const bmp = await createImageBitmap(blob);
      if (!this.isCurrent(run)) return;
      this.patch({ art: bmp });
      const path = await saveFile(`cards/${id}/art.jpg`, await imageToJpeg(bmp));
      if (this.isCurrent(run)) this.patchRecord({ files: { ...this.view!.record.files, art: path } });
    });
  }

  private runVoice(run: Run) {
    const id = run.id;
    return this.step(run, "voice", async () => {
      const rec = this.view!.record;
      const plan = rec.plans.voice;
      if (!plan || !rec.words) throw new Error("Voice notes aren't available in this language yet.");
      const script = voiceScript(rec.words);
      // A reopened card joins the recording that is already paid for instead of starting another.
      const key = `${id}:${script}`;
      let pending = inflightVoice.get(key);
      if (!pending) {
        pending = speak(script, plan);
        inflightVoice.set(key, pending);
        pending.then(
          (blob) => this.keepDetachedVoice(id, blob).finally(() => inflightVoice.delete(key)),
          () => inflightVoice.delete(key),
        );
      }
      const blob = await pending;
      if (!this.isCurrent(run)) return;
      audioController.stop(`${id}:voice`);
      if (this.view!.voice) URL.revokeObjectURL(this.view!.voice.url);
      this.patch({ voice: media(blob), voiceStale: false });
      const path = await saveFile(`cards/${id}/voice.mp3`, blob);
      if (this.isCurrent(run)) this.patchRecord({ files: { ...this.view!.record.files, voice: path } });
    });
  }

  private runSong(run: Run) {
    const id = run.id;
    return this.step(run, "song", async () => {
      const rec = this.view!.record;
      const plan = rec.plans.song;
      if (!plan || !rec.words) throw new Error("Songs aren't available on your Anna account.");
      let jobId = rec.jobs.song;
      if (!jobId) {
        jobId = await submitSong(rec.words, plan, `${id}-song-${rec.attempts.song}`);
        if (!this.isCurrent(run)) return;
        this.patchRecord({ jobs: { ...this.view!.record.jobs, song: jobId } });
      }
      let view;
      try {
        view = await awaitJob("music", jobId, { signal: this.abort.signal });
      } catch (e: any) {
        if (e?.code !== "aborted" && this.isCurrent(run)) this.patchRecord({ jobs: { ...this.view!.record.jobs, song: undefined } });
        throw e;
      }
      const { blob, lyrics } = await songFromJob(view);
      if (!this.isCurrent(run)) return;
      audioController.stop(`${id}:song`);
      if (this.view!.song) URL.revokeObjectURL(this.view!.song.url);
      this.patch({ song: media(blob) });
      const path = await saveFile(`cards/${id}/song.mp3`, blob);
      if (this.isCurrent(run)) this.patchRecord({ files: { ...this.view!.record.files, song: path }, lyrics: rec.words.lyrics || lyrics || rec.lyrics });
    });
  }

  private runCard(run: Run) {
    const id = run.id;
    return this.step(run, "card", async () => {
      const blob = await renderCardBlob(this.view!.art, contentOf(this.view!.record));
      if (!this.isCurrent(run)) return;
      if (this.view!.card) URL.revokeObjectURL(this.view!.card.url);
      this.saved = null;
      this.patch({ card: media(blob), dirty: false });
      const path = await saveFile(`cards/${id}/card.jpg`, blob);
      if (this.isCurrent(run)) this.patchRecord({ files: { ...this.view!.record.files, card: path } });
    });
  }

  /** Bring finished media back from Anna storage. */
  private async loadDone(run: Run, stage: "art" | "voice" | "song" | "card") {
    const rec = this.view?.record;
    const path = rec?.files[stage];
    if (!rec || rec.stages[stage].state !== "done" || !path) return;
    try {
      const blob = await loadFile(path);
      if (!this.isCurrent(run)) return;
      if (stage === "art") this.patch({ art: await createImageBitmap(blob) });
      else this.patch({ [stage]: media(blob) } as Partial<CardView>);
    } catch (e) {
      if (!this.isCurrent(run)) return;
      if (stage === "card") return; // re-rendered from the record below
      this.setStage(stage, "failed", "This file couldn't be loaded. " + problemText(e));
    }
  }

  // ── Opening & resuming ──────────────────────────────────────────

  async open(record: CardRecord) {
    if (this.view?.record.id === record.id) return;
    this.detach();
    this.view = { record, art: null, voice: null, song: null, card: null, dirty: false, voiceStale: false, exporting: false };
    this.emit();
    const run = this.ctx();
    if (needsResume(record) || !record.files.card) {
      await this.run(run);
    } else {
      await Promise.all([this.loadDone(run, "art"), this.loadDone(run, "voice"), this.loadDone(run, "song"), this.loadDone(run, "card")]);
      // v0.1 cards have no saved art-free re-render: rebuild the card image if it failed to load.
      if (this.isCurrent(run) && !this.view?.card) await this.runCard(run);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────

  async retry(stage: StageId) {
    const v = this.view;
    if (!v) return;
    const run = this.ctx();
    if (this.abort.signal.aborted) this.abort = new AbortController();
    if (stage === "words") {
      await this.run(run);
      return;
    }
    if (stage === "art" || stage === "song") {
      // A finished (paid) job whose file wasn't saved is fetched again, not paid for twice.
      const reuse = !!v.record.jobs[stage] && !v.record.files[stage];
      if (!reuse) {
        const attempts = { ...v.record.attempts, [stage]: v.record.attempts[stage] + 1 };
        this.patchRecord({ attempts, jobs: { ...v.record.jobs, [stage]: undefined }, files: { ...v.record.files, [stage]: undefined } });
      }
    }
    if (stage === "art") await this.runArt(run);
    if (stage === "voice") await this.runVoice(run);
    if (stage === "song") await this.runSong(run);
    if (stage === "art" || stage === "card") await this.runCard(run);
    this.onCredits();
  }

  async addExtra(stage: "art" | "voice" | "song", catalogs: Catalogs) {
    const v = this.view;
    if (!v || v.record.stages.words.state !== "done") return;
    const run = this.ctx();
    const lang = v.record.request.language;
    const plans = { ...v.record.plans };
    if (stage === "art") plans.image = planImage(catalogs.image);
    if (stage === "voice") plans.voice = planVoice(catalogs.tts, lang);
    if (stage === "song") {
      plans.song = planSong(catalogs.music, lang);
      // Lyrics were not written for a card created without a song.
      if (plans.song && !v.record.words?.lyrics) {
        this.patchRecord({ plans, extras: { ...v.record.extras, song: true }, stages: { ...v.record.stages, song: { state: "working" } } });
        try {
          const words = await writeWords(v.record.request, lyricsSpec(plans.song));
          if (!this.isCurrent(run)) return;
          this.patchRecord({ words: { ...this.view!.record.words!, lyrics: words.lyrics, songStyle: words.songStyle }, lyrics: words.lyrics });
        } catch (e) {
          if (this.isCurrent(run)) this.setStage("song", "failed", problemText(e));
          return;
        }
      }
    }
    if (!this.isCurrent(run)) return;
    this.patchRecord({ plans, extras: { ...this.view!.record.extras, [stage]: true } });
    await this.retry(stage);
  }

  /** Remember what the saved card.jpg shows, so unsaved edits are never written to storage. */
  private keepSaved() {
    const v = this.view;
    if (v && !v.dirty && v.record.words) this.saved = { words: v.record.words, lettering: v.record.lettering };
  }

  editWords(patch: Partial<CardWords>) {
    const v = this.view;
    if (!v?.record.words) return;
    this.keepSaved();
    this.patchRecord({ words: { ...v.record.words, ...patch } }, false);
    this.patch({ dirty: true, voiceStale: !!v.voice || v.voiceStale });
  }

  setLettering(lettering: LetteringId) {
    if (!this.view) return;
    this.keepSaved();
    this.patchRecord({ lettering }, false);
    this.patch({ dirty: true });
  }

  async saveEdits() {
    if (!this.view) return;
    await this.runCard(this.ctx());
    this.persist();
  }

  /** Stop painting/composing. Jobs still queued are cancelled and refunded by Anna. */
  async stop() {
    const v = this.view;
    if (!v) return;
    const run = this.ctx();
    const { jobs, stages } = v.record;
    const cancel = (["art", "song"] as const).filter((s) => jobs[s] && stages[s].state === "working");
    this.abort.abort();
    this.abort = new AbortController();
    await Promise.allSettled(
      cancel.map((s) => (s === "art" ? anna().image.cancelJob({ jobId: jobs.art }) : anna().music.cancelJob({ jobId: jobs.song }))),
    );
    // Cancelled jobs can't be resumed; Try again starts a fresh one.
    if (cancel.length && this.isCurrent(run)) {
      const left = { ...this.view!.record.jobs };
      for (const s of cancel) delete left[s];
      this.patchRecord({ jobs: left });
    }
  }

  async download(kind: ExportKind) {
    const v = this.view;
    if (!v) return;
    const name = exportFileName(v.record.request, kind);
    if (kind === "all") {
      this.patch({ exporting: true });
      try {
        const zip = await buildZip({
          request: v.record.request,
          words: v.record.words!,
          card: (await this.cardBlob())!,
          voice: v.voice?.blob,
          song: v.song?.blob,
          lyrics: v.record.words?.lyrics || v.record.lyrics,
        });
        let path: string | null = null;
        try {
          path = await saveFile(`cards/${v.record.id}/everything.zip`, zip);
        } catch {
          path = null;
        }
        await downloadFile(path, zip, name);
      } finally {
        this.patch({ exporting: false });
      }
      return;
    }
    if (kind === "card") {
      const fresh = !v.dirty && v.record.files.card;
      const blob = fresh ? v.card?.blob ?? null : await renderCardBlob(v.art, contentOf(v.record));
      await downloadFile(fresh ? v.record.files.card! : null, blob, name);
      return;
    }
    const m = kind === "voice" ? v.voice : v.song;
    await downloadFile(v.record.files[kind] ?? null, m?.blob ?? null, name);
  }

  async cardBlob(): Promise<Blob | null> {
    const v = this.view;
    if (!v) return null;
    if (!v.dirty && v.card) return v.card.blob;
    return renderCardBlob(v.art, contentOf(v.record));
  }
}

export const studio = new Studio();

export function useStudio(): CardView | null {
  return useSyncExternalStore(studio.subscribe, studio.get, studio.get);
}
