export interface Occasion {
  id: string;
  label: string;
  emoji: string;
  /** Default headline used by the live preview before the AI writes one. */
  greeting: string;
  /** Two colours for the preview / art-less fallback. */
  wash: [string, string];
}

export const OCCASIONS: Occasion[] = [
  { id: "birthday", label: "Birthday", emoji: "🎂", greeting: "Happy birthday", wash: ["#F9D3DF", "#F6B48F"] },
  { id: "anniversary", label: "Anniversary", emoji: "💞", greeting: "Happy anniversary", wash: ["#F5C6D6", "#CDB6F2"] },
  { id: "thank-you", label: "Thank you", emoji: "🌷", greeting: "Thank you", wash: ["#FBE3B8", "#BFE3D3"] },
  { id: "congrats", label: "Congrats", emoji: "🎉", greeting: "Congratulations", wash: ["#FCEFAE", "#A8D4F2"] },
  { id: "get-well", label: "Get well", emoji: "🌼", greeting: "Get well soon", wash: ["#E2F2CC", "#FFF1C4"] },
  { id: "wedding", label: "Wedding", emoji: "💍", greeting: "To the happy couple", wash: ["#FBF1E8", "#EDD0E2"] },
  { id: "new-baby", label: "New baby", emoji: "🍼", greeting: "Welcome, little one", wash: ["#D6EAFB", "#FBDDEA"] },
  { id: "festival", label: "Festival", emoji: "🪔", greeting: "Warm wishes", wash: ["#FBD08C", "#F59AAE"] },
  { id: "farewell", label: "Farewell", emoji: "👋", greeting: "Farewell and good luck", wash: ["#D6E0FA", "#E7D8FA"] },
  { id: "sorry", label: "Sorry", emoji: "🤍", greeting: "I'm sorry", wash: ["#E8EEF5", "#F4E6EE"] },
  { id: "love", label: "Love note", emoji: "❤️", greeting: "With all my love", wash: ["#F8A5BC", "#FBD2BF"] },
  { id: "just-because", label: "Just because", emoji: "✨", greeting: "Thinking of you", wash: ["#E3F4EE", "#E5DEFB"] },
];

export function occasionById(id: string): Occasion {
  return OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[OCCASIONS.length - 1];
}

export const TONES = [
  { id: "warm", label: "Warm" },
  { id: "funny", label: "Funny" },
  { id: "poetic", label: "Poetic" },
  { id: "short", label: "Short" },
  { id: "formal", label: "Formal" },
] as const;
export type ToneId = (typeof TONES)[number]["id"];

export type Script =
  | "latin"
  | "cyrillic"
  | "vietnamese"
  | "devanagari"
  | "bengali"
  | "tamil"
  | "telugu"
  | "gujarati"
  | "arabic"
  | "urdu"
  | "zh"
  | "ja"
  | "ko";

export interface Language {
  code: string;
  /** Native name first so people spot their own language. */
  label: string;
  english: string;
  script: Script;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", label: "English", english: "English", script: "latin" },
  { code: "hi", label: "हिन्दी", english: "Hindi", script: "devanagari" },
  { code: "es", label: "Español", english: "Spanish", script: "latin" },
  { code: "fr", label: "Français", english: "French", script: "latin" },
  { code: "pt", label: "Português", english: "Portuguese", script: "latin" },
  { code: "de", label: "Deutsch", english: "German", script: "latin" },
  { code: "it", label: "Italiano", english: "Italian", script: "latin" },
  { code: "zh", label: "中文", english: "Chinese (Simplified)", script: "zh" },
  { code: "ja", label: "日本語", english: "Japanese", script: "ja" },
  { code: "ko", label: "한국어", english: "Korean", script: "ko" },
  { code: "ar", label: "العربية", english: "Arabic", script: "arabic", rtl: true },
  { code: "ru", label: "Русский", english: "Russian", script: "cyrillic" },
  { code: "bn", label: "বাংলা", english: "Bengali", script: "bengali" },
  { code: "ta", label: "தமிழ்", english: "Tamil", script: "tamil" },
  { code: "te", label: "తెలుగు", english: "Telugu", script: "telugu" },
  { code: "mr", label: "मराठी", english: "Marathi", script: "devanagari" },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati", script: "gujarati" },
  { code: "ur", label: "اردو", english: "Urdu", script: "urdu", rtl: true },
  { code: "ne", label: "नेपाली", english: "Nepali", script: "devanagari" },
  { code: "id", label: "Bahasa Indonesia", english: "Indonesian", script: "latin" },
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese", script: "vietnamese" },
  { code: "tr", label: "Türkçe", english: "Turkish", script: "latin" },
  { code: "nl", label: "Nederlands", english: "Dutch", script: "latin" },
  { code: "pl", label: "Polski", english: "Polish", script: "latin" },
  { code: "sw", label: "Kiswahili", english: "Swahili", script: "latin" },
];

export function language(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function guessLanguage(locale?: string): string {
  const base = (locale || "en").toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((l) => l.code === base) ? base : "en";
}

export const ART_STYLES = [
  { id: "watercolor", label: "Watercolour", prompt: "soft watercolour painting, loose brush strokes, visible paper texture, gentle natural light" },
  { id: "papercut", label: "Paper-cut", prompt: "layered paper-cut craft art, crisp soft shadows between paper layers, handmade" },
  { id: "storybook", label: "Storybook", prompt: "warm storybook illustration, gouache texture, cosy and whimsical" },
  { id: "folk", label: "Folk art", prompt: "vibrant folk-art illustration with decorative motifs and rich colours" },
  { id: "vintage", label: "Vintage", prompt: "vintage postcard illustration, retro print grain, muted inks" },
  { id: "photo", label: "Dreamy photo", prompt: "dreamy soft-focus photograph, bokeh lights, shallow depth of field, cinematic colour" },
] as const;
export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

export const LETTERINGS = [
  { id: "hand", label: "Handwritten" },
  { id: "print", label: "Printed" },
] as const;
export type LetteringId = (typeof LETTERINGS)[number]["id"];
