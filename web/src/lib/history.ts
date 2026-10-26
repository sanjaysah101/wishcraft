import { anna } from "./anna";
import type { CardFontId } from "./data";
import type { CardRequest } from "./prompts";
import { deleteFile } from "./services";

export interface SavedCard {
  id: string;
  createdAt: string;
  request: CardRequest;
  title: string;
  message: string;
  signoff: string;
  lyrics?: string;
  font: CardFontId;
  files: {
    card?: string;
    art?: string;
    voice?: string;
    song?: string;
  };
}

const PREFIX = "cards/";
const PREFS_KEY = "prefs";

export function newCardId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

export async function saveCard(card: SavedCard) {
  await anna().storage.set({
    key: PREFIX + card.id,
    value: card,
    metadata: { title: card.title.slice(0, 80), occasion: card.request.occasion, createdAt: card.createdAt },
  });
}

export async function listCards(): Promise<SavedCard[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await anna().storage.list({ prefix: PREFIX, limit: 100, cursor });
    for (const it of res.items ?? []) keys.push(it.key);
    cursor = res.next_cursor ?? undefined;
    if (!cursor) break;
  }
  const rows = await Promise.all(
    keys.map(async (key) => {
      try {
        const r = await anna().storage.get({ key });
        return r.exists === false ? null : (r.value as SavedCard);
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((c): c is SavedCard => !!c?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeCard(card: SavedCard) {
  await Promise.all(Object.values(card.files).filter(Boolean).map((p) => deleteFile(p as string)));
  await anna().storage.delete({ key: PREFIX + card.id });
}

export interface Prefs {
  sender?: string;
  language?: string;
  artStyle?: string;
  tone?: string;
  font?: CardFontId;
  extras?: { art: boolean; voice: boolean; song: boolean };
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const r = await anna().storage.get({ key: PREFS_KEY });
    return (r?.value as Prefs) ?? {};
  } catch {
    return {};
  }
}

export async function savePrefs(p: Prefs) {
  try {
    await anna().storage.set({ key: PREFS_KEY, value: p });
  } catch {
    /* non-critical */
  }
}
