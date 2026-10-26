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
export const SONG_SECONDS = 30;
/** Rough ceiling for one words call; real cost is usually well under 1 CU. */
export const WORDS_CU = 1;

export interface ImagePlan {
  model: string;
  size: string;
  quality?: string;
  cu: number;
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

function imageCu(m: CatalogModel): number {
  const p = m.pricing || {};
  if (p.cuByMaxPixels?.[0]?.cu) return Number(p.cuByMaxPixels[0].cu);
  if (p.cuByResolution?.["1K"]) return Number(p.cuByResolution["1K"]);
  return Number(p.cuPerImage ?? 999);
}

export interface VoiceOption {
  id: string;
  label: string;
  languages: string[];
}

export interface VoicePlan {
  model: string;
  voice?: string;
  cuPer1kChars: number;
  maxChars: number;
}

export function voicesFor(model: CatalogModel | undefined): VoiceOption[] {
  const list = model?.capabilities?.voices;
  if (!Array.isArray(list)) return [];
  return list.map((v: any) => ({
    id: String(v.id),
    label: String(v.label ?? v.id),
    languages: Array.isArray(v.languages) ? v.languages.map((l: string) => l.toLowerCase()) : [],
  }));
}

function supports(v: VoiceOption, lang: string): boolean {
  return v.languages.length === 0 || v.languages.some((l) => l === lang || l.startsWith(lang + "-") || l === "multilingual" || l === "auto");
}

/** Cheapest TTS model with a voice that speaks the card language. */
export function planVoice(models: CatalogModel[], lang: string): VoicePlan | null {
  const ranked = [...models].sort(
    (a, b) => Number(a.pricing?.cuPer1kChars ?? 999) - Number(b.pricing?.cuPer1kChars ?? 999),
  );
  for (const m of ranked) {
    const voices = voicesFor(m);
    const match = voices.find((v) => v.languages.some((l) => l === lang || l.startsWith(lang + "-")));
    if (match || voices.some((v) => supports(v, lang))) {
      return {
        model: m.modelName,
        voice: match?.id,
        cuPer1kChars: Number(m.pricing?.cuPer1kChars ?? 1),
        maxChars: Number(m.capabilities?.maxCharsPerCall ?? 1000),
      };
    }
  }
  const fallback = ranked[0];
  return fallback
    ? {
        model: fallback.modelName,
        cuPer1kChars: Number(fallback.pricing?.cuPer1kChars ?? 1),
        maxChars: Number(fallback.capabilities?.maxCharsPerCall ?? 1000),
      }
    : null;
}

export function voiceCu(plan: VoicePlan, chars: number): number {
  return Math.max(1, Math.ceil((plan.cuPer1kChars * chars) / 1000));
}

export interface SongPlan {
  model: string;
  durationSec?: number;
  lyricsField: boolean;
  cu: number;
}

export function songCu(m: CatalogModel, seconds = SONG_SECONDS): number {
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

/** Cheapest model that can sing lyrics. */
export function planSong(models: CatalogModel[]): SongPlan | null {
  const singers = models.filter((m) => m.capabilities?.lyrics && !m.capabilities?.instrumentalOnly);
  if (!singers.length) return null;
  const best = [...singers].sort((a, b) => songCu(a) - songCu(b))[0];
  const dur = best.capabilities?.duration;
  return {
    model: best.modelName,
    durationSec: dur?.type === "range" ? Math.min(Math.max(SONG_SECONDS, dur.min ?? 1), dur.max ?? SONG_SECONDS) : undefined,
    lyricsField: best.capabilities?.lyricsMode !== "prompt_embedded",
    cu: songCu(best),
  };
}

export interface Extras {
  art: boolean;
  voice: boolean;
  song: boolean;
}

export function estimateCu(c: Catalogs, extras: Extras, lang: string, chars = 450): number {
  let total = WORDS_CU;
  if (extras.art) total += planImage(c.image)?.cu ?? 0;
  if (extras.voice) {
    const v = planVoice(c.tts, lang);
    if (v) total += voiceCu(v, chars);
  }
  if (extras.song) total += planSong(c.music)?.cu ?? 0;
  return Math.ceil(total);
}
