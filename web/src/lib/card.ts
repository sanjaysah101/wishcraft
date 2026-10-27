import { language, occasionById, type LetteringId } from "./data";
import { cardFonts, loadCardFonts, type CardFonts } from "./fonts";

export const CARD_W = 1080;
export const CARD_H = 1620;

export interface CardContent {
  title: string;
  message: string;
  signoff: string;
  language: string;
  lettering: LetteringId;
  occasion: string;
  seed: number;
  /** Preview mode draws ruled lines instead of a message. */
  placeholder?: boolean;
}

type Img = CanvasImageSource & { width: number; height: number };
type Measure = (s: string) => number;

// ── Text layout ──────────────────────────────────────────────────────

const NO_SPACE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0e7f]/;
const NO_LINE_START = /^[,.!?;:%)\]}'"’”»，。、！？；：）》〉」』】〕〗…‥·・ー々〜।॥،؛؟]+$/;

/** Wrap-able pieces: words (plus their trailing spaces) or single CJK characters. */
export function segments(text: string, lang: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (Seg) {
    const seg = new Seg(lang, { granularity: "word" });
    return Array.from(seg.segment(text) as Iterable<{ segment: string }>, (s) => s.segment);
  }
  if (NO_SPACE.test(text)) return Array.from(text);
  return text.split(/(\s+)/).filter((s) => s.length);
}

export interface Piece {
  text: string;
  w: number;
  space: boolean;
}

export interface Line {
  pieces: Piece[];
  width: number;
}

function trimLine(pieces: Piece[]): Line {
  while (pieces.length && pieces[pieces.length - 1].space) pieces.pop();
  while (pieces.length && pieces[0].space) pieces.shift();
  return { pieces, width: pieces.reduce((a, p) => a + p.w, 0) };
}

export function layoutLines(text: string, maxWidth: number, measure: Measure, lang = "en"): Line[] {
  const lines: Line[] = [];
  for (const para of text.split(/\n+/)) {
    let cur: Piece[] = [];
    let width = 0;
    const pieces = segments(para, lang).flatMap((s): Piece[] => {
      const w = measure(s);
      // Split anything wider than a line (very long words) into characters.
      if (w > maxWidth && !/^\s+$/.test(s)) return Array.from(s).map((ch) => ({ text: ch, w: measure(ch), space: false }));
      return [{ text: s, w, space: /^\s+$/.test(s) }];
    });
    for (const p of pieces) {
      // Closing punctuation never starts a line; it hangs at the end of the previous one.
      const hangs = NO_LINE_START.test(p.text) && cur.some((c) => !c.space) && !cur[cur.length - 1]?.space;
      if (!p.space && !hangs && width + p.w > maxWidth && cur.some((c) => !c.space)) {
        lines.push(trimLine(cur));
        cur = [];
        width = 0;
      }
      if (p.space && cur.length === 0) continue;
      cur.push(p);
      width += p.w;
    }
    if (cur.some((c) => !c.space)) lines.push(trimLine(cur));
  }
  return lines;
}

export interface Fit {
  size: number;
  lines: Line[];
  height: number;
  lineHeight: number;
}

export function fitLines(
  text: string,
  box: { w: number; h: number },
  measureAt: (size: number) => Measure,
  opts: { max: number; min: number; lineHeight: number; lang?: string; step?: number },
): Fit {
  let best: Fit | null = null;
  for (let size = opts.max; size >= opts.min; size -= opts.step ?? 2) {
    const lines = layoutLines(text, box.w, measureAt(size), opts.lang);
    const lineHeight = size * opts.lineHeight;
    best = { size, lines, height: lines.length * lineHeight, lineHeight };
    if (best.height <= box.h) return best;
  }
  return best!;
}

// ── Drawing helpers ──────────────────────────────────────────────────

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawCover(ctx: CanvasRenderingContext2D, img: Img, h: number) {
  const scale = Math.max(CARD_W / img.width, h / img.height);
  const w = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, (CARD_W - w) / 2, (h - ih) / 2.6, w, ih);
}

function drawWash(ctx: CanvasRenderingContext2D, occasion: string, seed: number, h: number) {
  const o = occasionById(occasion);
  const g = ctx.createLinearGradient(0, 0, CARD_W, h);
  g.addColorStop(0, o.wash[0]);
  g.addColorStop(1, o.wash[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, h);
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.12 + r() * 0.22;
    ctx.fillStyle = "#ffffff";
    const rad = 30 + r() * 140;
    ctx.beginPath();
    ctx.arc(r() * CARD_W, r() * h, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.font = `220px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(o.emoji, CARD_W / 2, h * 0.42);
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

/** A torn, deckled top edge so the note reads as real paper laid on the art. */
function paperPath(ctx: CanvasRenderingContext2D, top: number, seed: number) {
  const r = rng(seed * 7 + 3);
  ctx.beginPath();
  ctx.moveTo(-10, CARD_H + 10);
  ctx.lineTo(-10, top + 6);
  const a1 = r() * 6;
  const a2 = r() * 6;
  for (let x = 0; x <= CARD_W + 12; x += 6) {
    const wave = Math.sin(x / 90 + a1) * 5 + Math.sin(x / 31 + a2) * 2.2;
    ctx.lineTo(x, top + wave + (r() - 0.5) * 3.2);
  }
  ctx.lineTo(CARD_W + 10, CARD_H + 10);
  ctx.closePath();
}

function drawPaper(ctx: CanvasRenderingContext2D, top: number, seed: number) {
  ctx.save();
  ctx.shadowColor = "rgba(30, 20, 40, 0.32)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = -4;
  paperPath(ctx, top, seed);
  const g = ctx.createLinearGradient(0, top, 0, CARD_H);
  g.addColorStop(0, "#FDFAF4");
  g.addColorStop(1, "#F7F1E6");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Fibres and specks give the paper a tactile grain without an image asset.
  ctx.save();
  paperPath(ctx, top, seed);
  ctx.clip();
  const r = rng(seed * 13 + 5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 520; i++) {
    const x = r() * CARD_W;
    const y = top + r() * (CARD_H - top);
    const len = 4 + r() * 16;
    const ang = r() * Math.PI;
    ctx.strokeStyle = r() > 0.5 ? "rgba(120, 96, 70, 0.07)" : "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(90, 70, 50, ${0.03 + r() * 0.05})`;
    ctx.fillRect(r() * CARD_W, top + r() * (CARD_H - top), 1.4, 1.4);
  }
  ctx.restore();
}

interface InkOptions {
  fonts: CardFonts;
  size: number;
  weight: number;
  color: string;
  rtl: boolean;
  /** 0 = printed (no jitter), 1 = natural handwriting. */
  hand: number;
  rand: () => number;
}

/**
 * Draw one line word by word. Handwriting gets the small irregularities of a
 * real pen: an uneven baseline, slight tilt per word, a gentle line slope and
 * varying ink density. Words are shaped whole, so Indic and Arabic joining is
 * preserved.
 */
function drawLine(ctx: CanvasRenderingContext2D, line: Line, x0: number, y: number, maxW: number, align: "start" | "center" | "end", o: InkOptions) {
  const slack = maxW - line.width;
  let offset = align === "center" ? slack / 2 : align === "end" ? slack : 0;
  if (o.hand) offset += (o.rand() - 0.5) * 10;
  const slope = o.hand ? (o.rand() - 0.5) * 0.006 : 0;
  ctx.font = `${o.weight} ${o.size}px ${o.fonts.body}`;
  let cursor = 0;
  for (const p of line.pieces) {
    if (!p.space) {
      const along = offset + cursor;
      const px = o.rtl ? x0 + maxW - along - p.w : x0 + along;
      const py = y + along * slope + (o.hand ? (o.rand() - 0.5) * o.size * 0.05 : 0);
      ctx.save();
      ctx.translate(px + p.w / 2, py);
      if (o.hand) {
        ctx.rotate((o.rand() - 0.5) * 0.022);
        const s = 1 + (o.rand() - 0.5) * 0.035;
        ctx.scale(s, s);
        ctx.globalAlpha = 0.86 + o.rand() * 0.12;
      }
      ctx.fillStyle = o.color;
      ctx.textAlign = "center";
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    cursor += p.w;
  }
}

// ── Card ─────────────────────────────────────────────────────────────

export async function prepareFonts(c: CardContent): Promise<CardFonts> {
  const fonts = cardFonts(c.language, c.lettering);
  await loadCardFonts(fonts, `${c.title} ${c.message} ${c.signoff} Made with WishCraft`);
  return fonts;
}

const INK = { hand: "#22305E", print: "#2A2233", title: "#8C1D45", rule: "rgba(70, 90, 140, 0.16)" };

export function renderCard(canvas: HTMLCanvasElement, art: Img | null, c: CardContent, fonts = cardFonts(c.language, c.lettering)) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const lang = language(c.language);
  const rtl = !!lang.rtl;
  const hand = fonts.handwritten ? 1 : 0;
  const pad = 96;
  const innerW = CARD_W - pad * 2;
  const measureAt = (family: string, weight: number) => (size: number) => {
    ctx.font = `${weight} ${size}px ${family}`;
    return (s: string) => ctx.measureText(s).width;
  };

  const title = fitLines(c.title || " ", { w: innerW, h: 190 }, measureAt(fonts.title, fonts.titleWeight), {
    max: 86,
    min: 44,
    lineHeight: lang.script === "urdu" ? 1.9 : 1.18,
    lang: c.language,
  });
  const sigSize = Math.round(46 * fonts.bodyScale);
  const sig = fitLines(c.signoff || " ", { w: innerW * 0.8, h: sigSize * 2.6 }, measureAt(fonts.signature, fonts.signatureWeight), {
    max: sigSize,
    min: Math.round(sigSize * 0.6),
    lineHeight: 1.3,
    lang: c.language,
  });
  const bodyLH = lang.script === "urdu" ? 2.1 : hand ? 1.36 : 1.5;
  const maxBodyH = CARD_H * 0.58 - title.height - sig.height - 300;
  const body = c.placeholder
    ? { size: 40, lines: [] as Line[], height: 4 * 40 * bodyLH, lineHeight: 40 * bodyLH }
    : fitLines(c.message || " ", { w: innerW, h: maxBodyH }, measureAt(fonts.body, fonts.bodyWeight), {
        max: Math.round(48 * fonts.bodyScale),
        min: Math.round(26 * fonts.bodyScale),
        lineHeight: bodyLH,
        lang: c.language,
      });

  const gapTitle = 34;
  const gapSig = 30;
  const footer = 64;
  const contentH = 70 + title.height + gapTitle + body.height + gapSig + sig.height + footer;
  const paperTop = Math.round(Math.max(CARD_H * 0.42, Math.min(CARD_H * 0.62, CARD_H - contentH)));

  if (art) drawCover(ctx, art, paperTop + 40);
  else drawWash(ctx, c.occasion, c.seed, paperTop + 40);
  drawPaper(ctx, paperTop, c.seed);

  const rand = rng(c.seed * 31 + 7);
  ctx.textBaseline = "alphabetic";
  let y = paperTop + 70;

  // Title: printed, centred, in the script's display face.
  ctx.font = `${fonts.titleWeight} ${title.size}px ${fonts.title}`;
  for (const line of title.lines) {
    y += title.lineHeight;
    drawLine(ctx, line, pad, y - title.lineHeight * 0.18, innerW, "center", {
      fonts: { ...fonts, body: fonts.title },
      size: title.size,
      weight: fonts.titleWeight,
      color: INK.title,
      rtl,
      hand: 0,
      rand,
    });
  }

  y += gapTitle;
  if (c.placeholder) {
    ctx.strokeStyle = INK.rule;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const ly = y + body.lineHeight * (i + 1) - 10;
      ctx.beginPath();
      ctx.moveTo(pad, ly);
      ctx.lineTo(pad + innerW * (i === 3 ? 0.55 : 1), ly);
      ctx.stroke();
    }
    y += body.height;
  } else {
    for (const line of body.lines) {
      y += body.lineHeight;
      drawLine(ctx, line, pad, y - (body.lineHeight - body.size) * 0.45, innerW, hand ? "start" : "center", {
        fonts,
        size: body.size,
        weight: fonts.bodyWeight,
        color: hand ? INK.hand : INK.print,
        rtl,
        hand,
        rand,
      });
    }
  }

  y += gapSig;
  for (const line of sig.lines) {
    y += sig.lineHeight;
    drawLine(ctx, line, pad, y - sig.lineHeight * 0.2, innerW, "end", {
      fonts: { ...fonts, body: fonts.signature },
      size: sig.size,
      weight: fonts.signatureWeight,
      color: hand ? INK.hand : INK.print,
      rtl,
      hand,
      rand,
    });
  }

  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(60, 48, 72, 0.42)";
  ctx.font = `500 21px "Figtree Variable", "Figtree", system-ui, sans-serif`;
  ctx.fillText("Made with WishCraft on Anna", CARD_W / 2, CARD_H - 34);
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export the card."))), type, quality),
  );
}

export async function renderCardBlob(art: Img | null, c: CardContent): Promise<Blob> {
  const fonts = await prepareFonts(c);
  const canvas = document.createElement("canvas");
  renderCard(canvas, art, c, fonts);
  return canvasToBlob(canvas);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function imageToJpeg(bmp: ImageBitmap): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  return canvasToBlob(c, "image/jpeg", 0.9);
}

export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
