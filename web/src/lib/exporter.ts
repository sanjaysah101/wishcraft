import { occasionById } from "./data";
import { displayLyrics, plainText, type CardRequest, type CardWords } from "./prompts";

/**
 * One export standard everywhere:
 *   card  → JPEG (.jpg), 1080 × 1620
 *   voice → MP3  (.mp3)
 *   song  → MP3  (.mp3)
 *   all   → ZIP  (.zip) with the three files + message.txt (+ lyrics.txt)
 * File names share one pattern: WishCraft-<Recipient>-<Occasion>-<part>.<ext>
 */
export type ExportKind = "card" | "voice" | "song" | "all";

export const EXPORT_FORMATS: Record<ExportKind, { ext: string; mime: string; label: string }> = {
  card: { ext: "jpg", mime: "image/jpeg", label: "Card image (JPG)" },
  voice: { ext: "mp3", mime: "audio/mpeg", label: "Voice note (MP3)" },
  song: { ext: "mp3", mime: "audio/mpeg", label: "Song (MP3)" },
  all: { ext: "zip", mime: "application/zip", label: "Everything (ZIP)" },
};

function slug(s: string): string {
  return (
    (s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || ""
  );
}

export function exportBaseName(req: Pick<CardRequest, "recipient" | "occasion">): string {
  const who = slug(req.recipient) || "Card";
  const what = slug(occasionById(req.occasion).label);
  return ["WishCraft", who, what].filter(Boolean).join("-");
}

const PART_SUFFIX: Record<ExportKind, string> = { card: "card", voice: "voice-note", song: "song", all: "" };

export function exportFileName(req: Pick<CardRequest, "recipient" | "occasion">, kind: ExportKind): string {
  const base = exportBaseName(req);
  const suffix = PART_SUFFIX[kind];
  return `${suffix ? `${base}-${suffix}` : base}.${EXPORT_FORMATS[kind].ext}`;
}

export interface ZipInput {
  request: CardRequest;
  words: CardWords;
  card: Blob;
  voice?: Blob | null;
  song?: Blob | null;
  lyrics?: string;
}

export async function buildZip(input: ZipInput): Promise<Blob> {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const add = async (kind: ExportKind, blob: Blob | null | undefined) => {
    if (blob) files[exportFileName(input.request, kind)] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  };
  await add("card", input.card);
  await add("voice", input.voice);
  await add("song", input.song);
  files["message.txt"] = strToU8(plainText(input.words) + "\n");
  if (input.song && input.lyrics) files["lyrics.txt"] = strToU8(displayLyrics(input.lyrics) + "\n");
  const zipped = zipSync(files as any, { level: 6 });
  return new Blob([zipped], { type: EXPORT_FORMATS.all.mime });
}
