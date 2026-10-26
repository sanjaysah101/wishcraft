import { CARD_FONTS, RTL_LANGS, type CardFontId } from "./data";

export const CARD_W = 1080;
export const CARD_H = 1620;

export interface CardContent {
  title: string;
  message: string;
  signoff: string;
  language: string;
  font: CardFontId;
  wash: [string, string];
  seed: number;
}

/** Sans fallbacks that cover Indic, CJK, Arabic etc. on Windows, macOS, Android and iOS. */
const SCRIPT_FALLBACK =
  '"Nirmala UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Segoe UI", "Geeza Pro", "Kohinoor Devanagari", system-ui, sans-serif';

export function fontStack(primary: string): string {
  return `"${primary}", ${SCRIPT_FALLBACK}`;
}

const NO_SPACE_SCRIPTS = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0e7f\uac00-\ud7af]/;

/** Break text into wrap-able pieces: words for spaced scripts, characters for CJK/Thai. */
export function segments(text: string, lang: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (Seg) {
    const seg = new Seg(lang, { granularity: "word" });
    return Array.from(seg.segment(text) as Iterable<{ segment: string }>, (s) => s.segment);
  }
  if (NO_SPACE_SCRIPTS.test(text)) return Array.from(text);
  return text.split(/(\s+)/).filter((s) => s.length);
}

type Measure = (s: string) => number;

export function wrapLines(text: string, maxWidth: number, measure: Measure, lang = "en"): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const piece of segments(para, lang)) {
      const next = line + piece;
      if (measure(next.trimEnd()) <= maxWidth || !line.trim()) {
        line = next;
        // Single pieces wider than the line (very long words) are split by character.
        if (measure(line.trimEnd()) > maxWidth) {
          let chunk = "";
          for (const ch of Array.from(line)) {
            if (measure(chunk + ch) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        }
      } else {
        lines.push(line.trim());
        line = piece.trimStart();
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

export interface FitResult {
  size: number;
  lines: string[];
  height: number;
}

/** Largest font size (in px) whose wrapped lines fit inside the box. */
export function fitText(
  text: string,
  box: { w: number; h: number },
  measureAt: (size: number) => Measure,
  opts: { max: number; min: number; lineHeight: number; lang?: string },
): FitResult {
  let best: FitResult | null = null;
  for (let size = opts.max; size >= opts.min; size -= 2) {
    const lines = wrapLines(text, box.w, measureAt(size), opts.lang);
    const height = lines.length * size * opts.lineHeight;
    best = { size, lines, height };
    if (height <= box.h) return best;
  }
  return best ?? { size: opts.min, lines: [text], height: opts.min * opts.lineHeight };
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawFallbackArt(ctx: CanvasRenderingContext2D, wash: [string, string], seed: number) {
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, wash[0]);
  g.addColorStop(1, wash[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const rnd = mulberry(seed);
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.18 + rnd() * 0.35;
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : wash[rnd() > 0.5 ? 0 : 1];
    const r = 6 + rnd() * 26;
    ctx.beginPath();
    ctx.arc(rnd() * CARD_W, rnd() * CARD_H * 0.62, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }) {
  const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function ensureFonts(font: CardFontId) {
  const family = CARD_FONTS.find((f) => f.id === font)?.family ?? "Caveat";
  if (!("fonts" in document)) return;
  await Promise.allSettled([
    document.fonts.load(`700 64px "Caprasimo"`),
    document.fonts.load(`400 40px "${family}"`),
    document.fonts.load(`700 40px "${family}"`),
    document.fonts.load(`400 24px "Atkinson Hyperlegible"`),
  ]);
}

export function renderCard(
  canvas: HTMLCanvasElement,
  art: (CanvasImageSource & { width: number; height: number }) | null,
  c: CardContent,
) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rtl = RTL_LANGS.has(c.language);
  const family = CARD_FONTS.find((f) => f.id === c.font)?.family ?? "Caveat";
  const bodyWeight = c.font === "hand" ? 500 : 400;
  const bodyScale = c.font === "hand" ? 1.18 : 1;

  if (art) drawCover(ctx, art);
  else drawFallbackArt(ctx, c.wash, c.seed);

  const inset = 56;
  const pad = 56;
  const innerW = CARD_W - inset * 2 - pad * 2;
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textBaseline = "alphabetic";

  const measureAt = (stack: string, weight: number) => (size: number) => {
    ctx.font = `${weight} ${size}px ${stack}`;
    return (s: string) => ctx.measureText(s).width;
  };

  const title = fitText(c.title, { w: innerW, h: 170 }, measureAt(fontStack("Caprasimo"), 400), {
    max: 82,
    min: 40,
    lineHeight: 1.1,
    lang: c.language,
  });
  const signoffFit = fitText(c.signoff, { w: innerW, h: 90 }, measureAt(fontStack(family), bodyWeight), {
    max: Math.round(40 * bodyScale),
    min: 24,
    lineHeight: 1.25,
    lang: c.language,
  });
  // Keep the paper panel to about half the card so the art stays the hero.
  const maxBodyH = CARD_H * 0.52 - title.height - signoffFit.height - pad * 2 - 100;
  const body = fitText(c.message, { w: innerW, h: maxBodyH }, measureAt(fontStack(family), bodyWeight), {
    max: Math.round(46 * bodyScale),
    min: Math.round(24 * bodyScale),
    lineHeight: c.font === "hand" ? 1.22 : 1.42,
    lang: c.language,
  });

  const gap = 26;
  const footer = 40;
  const panelH = pad + title.height + gap + body.height + gap + signoffFit.height + footer + pad * 0.6;
  const panelY = CARD_H - inset - panelH;

  ctx.save();
  ctx.shadowColor = "rgba(43, 30, 69, 0.28)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, inset, panelY, CARD_W - inset * 2, panelH, 34);
  ctx.fillStyle = "rgba(250, 246, 255, 0.94)";
  ctx.fill();
  ctx.restore();

  const x = rtl ? CARD_W - inset - pad : inset + pad;
  ctx.textAlign = rtl ? "right" : "left";
  let y = panelY + pad;

  ctx.fillStyle = "#D6336C";
  ctx.font = `400 ${title.size}px ${fontStack("Caprasimo")}`;
  for (const line of title.lines) {
    y += title.size;
    ctx.fillText(line, x, y);
    y += title.size * 0.1;
  }

  y += gap;
  ctx.fillStyle = "#2B1E45";
  ctx.font = `${bodyWeight} ${body.size}px ${fontStack(family)}`;
  const bodyLine = body.size * (c.font === "hand" ? 1.22 : 1.42);
  for (const line of body.lines) {
    y += bodyLine;
    ctx.fillText(line, x, y - (bodyLine - body.size) / 2);
  }

  y += gap;
  ctx.font = `${c.font === "hand" ? 700 : 600} ${signoffFit.size}px ${fontStack(family)}`;
  ctx.textAlign = rtl ? "left" : "right";
  const sx = rtl ? inset + pad : CARD_W - inset - pad;
  for (const line of signoffFit.lines) {
    y += signoffFit.size * 1.25;
    ctx.fillText(line, sx, y);
  }

  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillStyle = "rgba(43, 30, 69, 0.45)";
  ctx.font = `400 22px ${fontStack("Atkinson Hyperlegible")}`;
  ctx.fillText("Made with WishCraft on Anna", CARD_W / 2, panelY + panelH - pad * 0.45);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export the card"))), type, quality),
  );
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
