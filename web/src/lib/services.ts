import { anna, fetchBlob } from "./anna";
import { buildWordsPrompt, normaliseLyrics, parseWords, type CardRequest, type CardWords } from "./prompts";
import type { CatalogModel, Catalogs, ImagePlan, SongPlan, VoicePlan } from "./pricing";

export async function loadCatalogs(): Promise<Catalogs> {
  const get = async (serviceType: string) => {
    try {
      return await anna().llm.catalog({ serviceType });
    } catch {
      return { models: [], quota: null };
    }
  };
  const [image, tts, music] = await Promise.all([get("image_gen"), get("tts"), get("music_gen")]);
  return {
    image: (image.models ?? []) as CatalogModel[],
    tts: (tts.models ?? []) as CatalogModel[],
    music: (music.models ?? []) as CatalogModel[],
    remainingCU: image.quota?.remainingCU ?? tts.quota?.remainingCU ?? music.quota?.remainingCU ?? null,
  };
}

export async function refreshCredits(): Promise<number | null> {
  try {
    const r = await anna().llm.catalog({ serviceType: "image_gen" });
    return r.quota?.remainingCU ?? null;
  } catch {
    return null;
  }
}

export async function writeWords(req: CardRequest): Promise<CardWords> {
  const { system, user } = buildWordsPrompt(req);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anna().llm.complete({
      systemPrompt: system,
      messages: [{ role: "user", content: { type: "text", text: user } }],
      maxTokens: 1400,
      temperature: attempt === 0 ? 0.9 : 0.6,
    });
    try {
      return parseWords(String(res?.content?.text ?? ""));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export interface Art {
  blob: Blob;
  r2Key?: string;
}

export async function paintArt(prompt: string, plan: ImagePlan, signal?: AbortSignal): Promise<Art> {
  const args: Record<string, unknown> = { prompt, model: plan.model, size: plan.size, n: 1, clientTag: "card-art" };
  if (plan.quality) args.quality = plan.quality;
  const view = await anna().image.generateAwait(args, { signal, timeoutMs: 6 * 60 * 1000 });
  const img = view?.result?.images?.[0];
  if (!img?.url) throw new Error("The art service returned no image.");
  return { blob: await fetchBlob(img.url), r2Key: img.r2Key };
}

export interface Clip {
  blob: Blob;
  mimeType: string;
}

export async function speak(text: string, plan: VoicePlan, language: string): Promise<Clip> {
  const args: Record<string, unknown> = { text: text.slice(0, plan.maxChars), model: plan.model, format: "mp3" };
  if (plan.voice) args.voice = plan.voice;
  if (language) args.language = language;
  let res: any;
  try {
    res = await anna().audio.speak(args, { timeoutMs: 150_000 });
  } catch (e: any) {
    // Some models reject an explicit language; retry with the model's defaults.
    if (String(e?.code ?? "").includes("OPTION") || String(e?.code ?? "").includes("INVALID")) {
      delete args.language;
      res = await anna().audio.speak(args, { timeoutMs: 150_000 });
    } else throw e;
  }
  if (res?.audioBase64) {
    const bin = atob(res.audioBase64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { blob: new Blob([bytes], { type: res.mimeType || "audio/mpeg" }), mimeType: res.mimeType || "audio/mpeg" };
  }
  if (!res?.url) throw new Error("The voice service returned no audio.");
  const blob = await fetchBlob(res.url);
  return { blob, mimeType: res.mimeType || blob.type || "audio/mpeg" };
}

export async function composeSong(words: CardWords, plan: SongPlan, signal?: AbortSignal): Promise<Clip & { lyrics: string }> {
  const lyrics = normaliseLyrics(words.lyrics);
  const style = words.songStyle || "cheerful acoustic celebration song, warm vocals, claps";
  const args: Record<string, unknown> = { model: plan.model, clientTag: "card-song" };
  if (plan.lyricsField) {
    args.prompt = style;
    if (lyrics) args.lyrics = lyrics;
  } else {
    args.prompt = lyrics ? `${style}\n\nLyrics:\n${lyrics}` : style;
  }
  if (plan.durationSec) args.durationSec = plan.durationSec;
  const view = await anna().music.generateAwait(args, { signal, timeoutMs: 8 * 60 * 1000 });
  const url = view?.result?.url;
  if (!url) throw new Error("The music service returned no song.");
  const blob = await fetchBlob(url);
  return { blob, mimeType: view.result.mimeType || blob.type || "audio/wav", lyrics: view.result.lyrics || lyrics };
}

// ── APS files ──────────────────────────────────────────────────────────

export async function saveFile(path: string, blob: Blob): Promise<string> {
  const type = blob.type || "application/octet-stream";
  const init = await anna().files.upload_init({ path, size: blob.size, content_type: type });
  const put = await fetch(init.put_url, { method: "PUT", body: blob, headers: init.headers ?? { "Content-Type": type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  await anna().files.upload_finalize({ path, upload_id: init.upload_id });
  return path;
}

export async function fileUrl(path: string): Promise<string> {
  const r = await anna().files.download_url({ path, ttl_seconds: 1800 });
  return r.get_url;
}

export async function loadFile(path: string): Promise<Blob> {
  return fetchBlob(await fileUrl(path));
}

export async function deleteFile(path: string) {
  try {
    await anna().files.delete({ path });
  } catch {
    /* already gone */
  }
}

/** Host-mediated download; falls back to a local anchor when the host can't. */
export async function downloadFile(path: string | null, blob: Blob | null, filename: string) {
  if (path) {
    try {
      await anna().files.download({ path, filename });
      return;
    } catch {
      /* fall through */
    }
  }
  if (!blob) throw new Error("Nothing to download yet.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
