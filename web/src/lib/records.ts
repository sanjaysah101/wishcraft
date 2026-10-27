import { anna } from "./anna";
import type { LetteringId } from "./data";
import type { Extras, ImagePlan, SongPlan, VoicePlan } from "./pricing";
import type { CardRequest, CardWords } from "./prompts";
import { deleteFile } from "./services";

export type StageId = "words" | "art" | "voice" | "song" | "card";
export type StageState = "waiting" | "working" | "done" | "failed" | "skipped";

export interface Stage {
  state: StageState;
  error?: string;
}

export type Stages = Record<StageId, Stage>;

/**
 * Everything needed to show OR resume a card. It is written to Anna storage
 * after every step, so closing the window never loses progress.
 */
export interface CardRecord {
  v: 2;
  id: string;
  createdAt: string;
  updatedAt: string;
  request: CardRequest;
  extras: Extras;
  lettering: LetteringId;
  words: CardWords | null;
  stages: Stages;
  /** Host job ids for async media; they keep running while the app is closed. */
  jobs: { art?: string; song?: string };
  /** Attempt counters, part of each job's idempotency key. */
  attempts: { art: number; song: number };
  plans: { image?: ImagePlan | null; voice?: VoicePlan | null; song?: SongPlan | null };
  files: { card?: string; art?: string; voice?: string; song?: string };
  lyrics?: string;
}

const PREFIX = "cards/";
const SESSION_KEY = "session";
const PREFS_KEY = "prefs";

export function newCardId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initialStages(extras: Extras): Stages {
  return {
    words: { state: "waiting" },
    art: { state: extras.art ? "waiting" : "skipped" },
    voice: { state: extras.voice ? "waiting" : "skipped" },
    song: { state: extras.song ? "waiting" : "skipped" },
    card: { state: "waiting" },
  };
}

export function isFinished(r: Pick<CardRecord, "stages">): boolean {
  return Object.values(r.stages).every((s) => s.state === "done" || s.state === "skipped" || s.state === "failed");
}

export function needsResume(r: Pick<CardRecord, "stages">): boolean {
  return Object.values(r.stages).some((s) => s.state === "working" || s.state === "waiting");
}

export async function saveRecord(r: CardRecord): Promise<void> {
  await anna().storage.set({
    key: PREFIX + r.id,
    value: r,
    metadata: { title: (r.words?.title ?? "").slice(0, 80), occasion: r.request.occasion, createdAt: r.createdAt },
  });
}

export async function getRecord(id: string): Promise<CardRecord | null> {
  try {
    const res = await anna().storage.get({ key: PREFIX + id });
    if (res?.exists === false || !res?.value) return null;
    return upgrade(res.value);
  } catch {
    return null;
  }
}

/** Cards saved by v0.1 used a flatter shape; show them read-only. */
function upgrade(v: any): CardRecord | null {
  if (!v?.id) return null;
  if (v.v === 2) return v as CardRecord;
  const extras = { art: !!v.files?.art, voice: !!v.files?.voice, song: !!v.files?.song };
  const done: Stage = { state: "done" };
  const skipped: Stage = { state: "skipped" };
  return {
    v: 2,
    id: v.id,
    createdAt: v.createdAt,
    updatedAt: v.createdAt,
    request: v.request,
    extras,
    lettering: v.font === "hand" ? "hand" : "print",
    words: { title: v.title ?? "", message: v.message ?? "", signoff: v.signoff ?? "", artPrompt: "", songStyle: "", lyrics: v.lyrics ?? "" },
    stages: {
      words: done,
      art: extras.art ? done : skipped,
      voice: extras.voice ? done : skipped,
      song: extras.song ? done : skipped,
      card: v.files?.card ? done : { state: "waiting" },
    },
    jobs: {},
    attempts: { art: 0, song: 0 },
    plans: {},
    files: { card: v.files?.card, art: v.files?.art, voice: v.files?.voice, song: v.files?.song },
    lyrics: v.lyrics,
  };
}

export async function listRecords(): Promise<CardRecord[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await anna().storage.list({ prefix: PREFIX, limit: 100, cursor });
    for (const it of res.items ?? []) keys.push(it.key);
    cursor = res.next_cursor ?? undefined;
    if (!cursor) break;
  }
  const rows = await Promise.all(keys.map((k) => getRecord(k.slice(PREFIX.length))));
  return rows.filter((r): r is CardRecord => !!r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeRecord(r: CardRecord): Promise<void> {
  const paths = [...Object.values(r.files), `cards/${r.id}/everything.zip`].filter(Boolean) as string[];
  await Promise.all(paths.map((p) => deleteFile(p)));
  await anna().storage.delete({ key: PREFIX + r.id });
}

// ── Session: what the user was doing when the window closed ─────────

export interface Draft {
  request: CardRequest;
  extras: Extras;
  lettering: LetteringId;
}

export interface Session {
  view: "create" | "cards";
  /** Card shown in the studio (finished or still generating). */
  openCardId: string | null;
  draft: Draft | null;
}

export async function loadSession(): Promise<Session | null> {
  try {
    const r = await anna().storage.get({ key: SESSION_KEY });
    return (r?.value as Session) ?? null;
  } catch {
    return null;
  }
}

let sessionTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSession: Session | null = null;

/** Debounced so typing in the form doesn't hammer storage. */
export function saveSession(s: Session, immediate = false) {
  pendingSession = s;
  clearTimeout(sessionTimer);
  const flush = () => {
    const value = pendingSession;
    pendingSession = null;
    if (value) anna().storage.set({ key: SESSION_KEY, value }).catch(() => {});
  };
  if (immediate) flush();
  else sessionTimer = setTimeout(flush, 600);
}

export interface Prefs {
  sender?: string;
  language?: string;
  tone?: string;
  artStyle?: string;
  lettering?: LetteringId;
  extras?: Extras;
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const r = await anna().storage.get({ key: PREFS_KEY });
    return (r?.value as Prefs) ?? {};
  } catch {
    return {};
  }
}

export function savePrefs(p: Prefs) {
  anna().storage.set({ key: PREFS_KEY, value: p }).catch(() => {});
}
