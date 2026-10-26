export interface Occasion {
  id: string;
  label: string;
  emoji: string;
  /** Colours for the art-less fallback card. */
  wash: [string, string];
}

export const OCCASIONS: Occasion[] = [
  { id: "birthday", label: "Birthday", emoji: "🎂", wash: ["#FFD6E7", "#FFB37A"] },
  { id: "anniversary", label: "Anniversary", emoji: "💞", wash: ["#FFC2D1", "#C9A7FF"] },
  { id: "thank-you", label: "Thank you", emoji: "🌷", wash: ["#FFE7B3", "#BDE8D6"] },
  { id: "congrats", label: "Congrats", emoji: "🎉", wash: ["#FFF1A8", "#9FD8FF"] },
  { id: "get-well", label: "Get well soon", emoji: "🌼", wash: ["#E3F6C8", "#FFF4C2"] },
  { id: "wedding", label: "Wedding", emoji: "💍", wash: ["#FFF6EC", "#F2D0E4"] },
  { id: "new-baby", label: "New baby", emoji: "🍼", wash: ["#D8EEFF", "#FFE0EE"] },
  { id: "festival", label: "Festival or holiday", emoji: "🪔", wash: ["#FFD38A", "#FF8FA3"] },
  { id: "farewell", label: "Farewell", emoji: "👋", wash: ["#D7E3FF", "#E9D9FF"] },
  { id: "sorry", label: "Sorry", emoji: "🤍", wash: ["#EAF0F7", "#F7E8EF"] },
  { id: "love", label: "Love note", emoji: "❤️", wash: ["#FF9DB5", "#FFD0B8"] },
  { id: "just-because", label: "Just because", emoji: "✨", wash: ["#E6F7F1", "#E8E1FF"] },
];

export function occasionById(id: string): Occasion {
  return OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[OCCASIONS.length - 1];
}

export const TONES = [
  { id: "warm", label: "Warm" },
  { id: "funny", label: "Funny" },
  { id: "poetic", label: "Poetic" },
  { id: "short", label: "Short and sweet" },
  { id: "formal", label: "Formal" },
] as const;
export type ToneId = (typeof TONES)[number]["id"];

export interface Language {
  code: string;
  label: string;
}

// Native names so people find their own language at a glance.
export const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "fr", label: "Français (French)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "it", label: "Italiano (Italian)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "ur", label: "اردو (Urdu)" },
  { code: "ne", label: "नेपाली (Nepali)" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "tr", label: "Türkçe (Turkish)" },
  { code: "nl", label: "Nederlands (Dutch)" },
  { code: "pl", label: "Polski (Polish)" },
  { code: "sw", label: "Kiswahili (Swahili)" },
];

export const RTL_LANGS = new Set(["ar", "ur", "fa", "he"]);

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** English name for prompts ("हिन्दी (Hindi)" → "Hindi"). */
export function languageName(code: string): string {
  const label = languageLabel(code);
  const m = label.match(/\(([^)]+)\)/);
  return m ? m[1] : label;
}

export function guessLanguage(locale?: string): string {
  const base = (locale || "en").toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((l) => l.code === base) ? base : "en";
}

export const ART_STYLES = [
  { id: "watercolor", label: "Watercolour", prompt: "soft watercolour painting, loose brush strokes, paper texture, gentle light" },
  { id: "papercut", label: "Paper-cut", prompt: "layered paper-cut craft art, crisp shadows between paper layers, handmade feel" },
  { id: "storybook", label: "Storybook", prompt: "warm children's storybook illustration, gouache texture, cosy and whimsical" },
  { id: "folk", label: "Folk art", prompt: "vibrant folk-art pattern illustration, decorative motifs, rich colours" },
  { id: "vintage", label: "Vintage postcard", prompt: "vintage postcard illustration, retro print grain, muted inks" },
  { id: "dreamy", label: "Dreamy photo", prompt: "dreamy soft-focus photograph, bokeh lights, shallow depth of field, cinematic colour" },
] as const;
export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

export const CARD_FONTS = [
  { id: "hand", label: "Handwritten", family: "Caveat" },
  { id: "classic", label: "Classic", family: "Cormorant Garamond" },
  { id: "clean", label: "Clean", family: "Atkinson Hyperlegible" },
] as const;
export type CardFontId = (typeof CARD_FONTS)[number]["id"];
