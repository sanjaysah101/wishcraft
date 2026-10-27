import { lyricLines, type LyricsSpec } from "./prompts";

export interface CatalogModel {
  modelName: string;
  displayName?: string;
  isPlatformDefault?: boolean;
  isUserPreferred?: boolean;
  capabilities?: Record<string, any>;
  pricing?: Record<string, any>;
}

export interface Catalogs {
  image: CatalogModel[];
  tts: CatalogModel[];
  music: CatalogModel[];
  remainingCU: number | null;
}

export const IMAGE_MODEL = "openai/gpt-image-2";
export const IMAGE_SIZE = "1024x1536";
export const IMAGE_QUALITY = "low";
/** Upper bound for one words call (usually well under 1 credit). */
export const WORDS_CU = 1;

// ── Image ────────────────────────────────────────────────────────────

export interface ImagePlan {
  model: string;
  size: string;
  quality?: string;
  cu: number;
}

function imageCu(m: CatalogModel): number {
  const p = m.pricing || {};
  if (p.cuByMaxPixels?.[0]?.cu) return Number(p.cuByMaxPixels[0].cu);
  if (p.cuByResolution?.["1K"]) return Number(p.cuByResolution["1K"]);
  return Number(p.cuPerImage ?? 999);
}

export function planImage(models: CatalogModel[]): ImagePlan | null {
  if (!models.length) return null;
  const gpt = models.find((m) => m.modelName === IMAGE_MODEL);
  if (gpt) {
    const cu = Number(gpt.pricing?.cuBySizeQuality?.[IMAGE_SIZE]?.[IMAGE_QUALITY] ?? 4);
    return { model: gpt.modelName, size: IMAGE_SIZE, quality: IMAGE_QUALITY, cu };
  }
  const cheapest = [...models].sort((a, b) => imageCu(a) - imageCu(b))[0];
  return { model: cheapest.modelName, size: IMAGE_SIZE, cu: imageCu(cheapest) };
}

// ── Voice ────────────────────────────────────────────────────────────

export interface VoicePlan {
  model: string;
  voice: string;
  cuPer1kChars: number;
  maxChars: number;
}

function speaks(languages: unknown, lang: string): boolean {
  if (!Array.isArray(languages)) return false;
  return languages.some((l) => {
    const code = String(l).toLowerCase();
    return code === lang || code.startsWith(lang + "-");
  });
}

/** Cheapest model with a voice that really speaks the card language; null when none does. */
export function planVoice(models: CatalogModel[], lang: string): VoicePlan | null {
  const ranked = [...models].sort(
    (a, b) => Number(a.pricing?.cuPer1kChars ?? 999) - Number(b.pricing?.cuPer1kChars ?? 999),
  );
  for (const m of ranked) {
    const voices: any[] = Array.isArray(m.capabilities?.voices) ? m.capabilities!.voices : [];
    // Prefer voices whose first language is the card language (native speaker).
    const native = voices.find((v) => String(v.languages?.[0] ?? "").toLowerCase().startsWith(lang));
    const any = native ?? voices.find((v) => speaks(v.languages, lang));
    if (any) {
      return {
        model: m.modelName,
        voice: String(any.id),
        cuPer1kChars: Number(m.pricing?.cuPer1kChars ?? 1),
        maxChars: Number(m.capabilities?.maxCharsPerCall ?? 1000),
      };
    }
  }
  return null;
}

export function voiceCu(plan: VoicePlan, chars: number): number {
  return Math.max(1, Math.ceil((plan.cuPer1kChars * chars) / 1000));
}

// ── Song ─────────────────────────────────────────────────────────────

export interface SongPlan {
  model: string;
  /** Language the lyrics are written in (falls back to English). */
  language: string;
  lines: number;
  /** Model takes an explicit length (we size it to the lyrics) vs. decides itself. */
  variableLength: boolean;
  minSec: number;
  maxSec: number;
  /** Fixed-length models: how long the song typically is. */
  typicalSec: number;
  lyricsField: boolean;
  formats: string[];
  /** Estimated cost for a typical song. */
  cu: number;
}

export function songCu(m: CatalogModel, seconds: number): number {
  const p = m.pricing || {};
  if (p.unit === "per_song") return Number(p.cuPerSong ?? 0);
  if (p.unit === "per_minute") return Number(p.cuPerMinute ?? 0) * Math.ceil(seconds / 60);
  if (p.unit === "per_second") {
    const ex = p.cuExample;
    if (ex?.durationSec && ex?.cu) return Math.max(1, Math.ceil((ex.cu * seconds) / ex.durationSec));
    return Math.max(1, Math.ceil(Number(p.cuPerSecond ?? 1) * seconds));
  }
  return Number(p.cuPerSong ?? 999);
}

/** Seconds needed to sing these lyrics without cutting them off. */
export function songSeconds(lyrics: string, plan: Pick<SongPlan, "minSec" | "maxSec">): number {
  const lines = lyricLines(lyrics);
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  // CJK has no spaces: count characters as syllables instead.
  const chars = lines.join("").replace(/\s/g, "").length;
  const syllables = Math.max(words * 1.6, /[\u3040-\u9fff\uac00-\ud7af]/.test(lines.join("")) ? chars : 0);
  // ~2.6 sung syllables per second, plus an intro, a breath per line and an outro.
  const seconds = Math.ceil(14 + syllables / 2.6 + lines.length * 1.2);
  return Math.min(plan.maxSec, Math.max(plan.minSec, seconds));
}

function describe(m: CatalogModel, lang: string): SongPlan {
  const caps = m.capabilities || {};
  const dur = caps.duration || {};
  const variableLength = dur.type === "range";
  const typicalSec = Number(dur.typicalMaxSec ?? dur.default ?? 60);
  // Fixed-length models (e.g. 30 s) need short lyrics so nothing is cut.
  const lines = variableLength ? 8 : typicalSec <= 40 ? 4 : 8;
  const plan: SongPlan = {
    model: m.modelName,
    language: lang,
    lines,
    variableLength,
    minSec: variableLength ? Math.max(Number(dur.min ?? 5), 35) : typicalSec,
    maxSec: variableLength ? Math.min(Number(dur.max ?? 120), 120) : typicalSec,
    typicalSec,
    lyricsField: caps.lyricsMode !== "prompt_embedded",
    formats: Array.isArray(caps.formats) ? caps.formats.map(String) : [],
    cu: 0,
  };
  plan.cu = songCu(m, variableLength ? 55 : typicalSec);
  return plan;
}

/**
 * Cheapest singing model that supports the card language. If none does,
 * the song is sung in English so it is never garbled or cut short.
 */
export function planSong(models: CatalogModel[], lang: string): SongPlan | null {
  const singers = models.filter((m) => m.capabilities?.lyrics && !m.capabilities?.instrumentalOnly);
  if (!singers.length) return null;
  const forLang = (code: string) =>
    singers
      .filter((m) => Array.isArray(m.capabilities?.lyricsLanguages) && m.capabilities!.lyricsLanguages.includes(code))
      .map((m) => describe(m, code))
      .sort((a, b) => a.cu - b.cu)[0];
  return forLang(lang) ?? forLang("en") ?? describe(singers[0], "en");
}

export function lyricsSpec(plan: SongPlan | null): LyricsSpec | null {
  return plan ? { language: plan.language, lines: plan.lines } : null;
}

export interface Extras {
  art: boolean;
  voice: boolean;
  song: boolean;
}

export interface Estimate {
  total: number;
  parts: { words: number; art: number; voice: number; song: number };
}

export function estimate(c: Catalogs, extras: Extras, lang: string, chars = 420): Estimate {
  const art = extras.art ? planImage(c.image)?.cu ?? 0 : 0;
  const v = extras.voice ? planVoice(c.tts, lang) : null;
  const voice = v ? voiceCu(v, chars) : 0;
  const song = extras.song ? planSong(c.music, lang)?.cu ?? 0 : 0;
  const parts = { words: WORDS_CU, art, voice, song };
  return { total: Math.ceil(WORDS_CU + art + voice + song), parts };
}
