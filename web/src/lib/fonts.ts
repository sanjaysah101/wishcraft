import { language, type LetteringId, type Script } from "./data";

/**
 * Card lettering is chosen per writing system so the whole card uses one
 * coordinated family (a Hindi card never mixes a Latin handwriting face with a
 * system Devanagari fallback). Every family here is bundled with the app, so
 * the card looks the same on every device.
 */
interface ScriptFonts {
  hand: string;
  print: string;
  title: string;
  titleWeight: number;
  handWeight: number;
  /** Handwriting faces differ a lot in x-height; scale to a common optical size. */
  handScale: number;
}

const SYSTEM_SERIF_ZH = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif';
const SYSTEM_SERIF_JA = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif';

const FONTS: Record<Script, ScriptFonts> = {
  latin: { hand: "Caveat", print: "Lora", title: "Fraunces", titleWeight: 600, handWeight: 500, handScale: 1.22 },
  cyrillic: { hand: "Caveat", print: "Lora", title: "Lora", titleWeight: 600, handWeight: 500, handScale: 1.22 },
  vietnamese: { hand: "Patrick Hand", print: "Lora", title: "Lora", titleWeight: 600, handWeight: 400, handScale: 1.08 },
  devanagari: { hand: "Kalam", print: "Tiro Devanagari Hindi", title: "Tiro Devanagari Hindi", titleWeight: 400, handWeight: 400, handScale: 1 },
  bengali: { hand: "Atma", print: "Noto Serif Bengali", title: "Noto Serif Bengali", titleWeight: 600, handWeight: 500, handScale: 1 },
  tamil: { hand: "Kavivanar", print: "Noto Serif Tamil", title: "Noto Serif Tamil", titleWeight: 600, handWeight: 400, handScale: 0.96 },
  telugu: { hand: "Gurajada", print: "Noto Serif Telugu", title: "Noto Serif Telugu", titleWeight: 600, handWeight: 400, handScale: 1.25 },
  gujarati: { hand: "Farsan", print: "Noto Serif Gujarati", title: "Noto Serif Gujarati", titleWeight: 600, handWeight: 400, handScale: 1.1 },
  arabic: { hand: "Aref Ruqaa", print: "Amiri", title: "Amiri", titleWeight: 700, handWeight: 400, handScale: 1.05 },
  urdu: { hand: "Noto Nastaliq Urdu", print: "Noto Nastaliq Urdu", title: "Noto Nastaliq Urdu", titleWeight: 600, handWeight: 400, handScale: 0.86 },
  zh: { hand: "Ma Shan Zheng", print: SYSTEM_SERIF_ZH, title: "Ma Shan Zheng", titleWeight: 400, handWeight: 400, handScale: 1 },
  ja: { hand: "Klee One", print: SYSTEM_SERIF_JA, title: "Klee One", titleWeight: 600, handWeight: 400, handScale: 0.96 },
  ko: { hand: "Nanum Pen Script", print: "Gowun Batang", title: "Gowun Batang", titleWeight: 700, handWeight: 400, handScale: 1.3 },
};

/** Fallbacks keep Latin names inside non-Latin cards in a matching style. */
const LATIN_HAND = '"Caveat"';
const LATIN_PRINT = '"Lora"';
const GENERIC = '"Noto Sans", system-ui, sans-serif';

function quote(f: string): string {
  return f.includes(",") || f.includes('"') ? f : `"${f}"`;
}

export interface CardFonts {
  body: string;
  bodyWeight: number;
  bodyScale: number;
  title: string;
  titleWeight: number;
  signature: string;
  signatureWeight: number;
  /** Family names to preload with document.fonts.load. */
  families: { family: string; weight: number }[];
  handwritten: boolean;
}

export function cardFonts(langCode: string, lettering: LetteringId): CardFonts {
  const f = FONTS[language(langCode).script];
  const hand = lettering === "hand";
  const bodyFamily = hand ? f.hand : f.print;
  const bodyFallback = hand ? LATIN_HAND : LATIN_PRINT;
  const body = `${quote(bodyFamily)}, ${bodyFallback}, ${GENERIC}`;
  const title = `${quote(f.title)}, ${LATIN_PRINT}, ${GENERIC}`;
  const bodyWeight = hand ? f.handWeight : 400;
  const families = [
    { family: f.title, weight: f.titleWeight },
    { family: bodyFamily, weight: bodyWeight },
    { family: hand ? "Caveat" : "Lora", weight: hand ? 500 : 400 },
  ].filter((x) => !x.family.includes(","));
  return {
    body,
    bodyWeight,
    bodyScale: hand ? f.handScale : 1,
    title,
    titleWeight: f.titleWeight,
    signature: body,
    signatureWeight: hand ? Math.max(bodyWeight, 600) : 600,
    families,
    handwritten: hand,
  };
}

/** Load exactly the glyph slices the text needs (fonts are split by unicode-range). */
export async function loadCardFonts(fonts: CardFonts, text: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const sample = text || "Aa";
  await Promise.allSettled(
    fonts.families.map(({ family, weight }) => document.fonts.load(`${weight} 48px "${family}"`, sample)),
  );
}
