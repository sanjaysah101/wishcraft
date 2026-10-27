import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../web/src/lib/card", async (orig) => ({
  ...(await orig<typeof import("../web/src/lib/card")>()),
  renderCardBlob: vi.fn(async () => new Blob([new Uint8Array([9])], { type: "image/jpeg" })),
  imageToJpeg: vi.fn(async () => new Blob([new Uint8Array([8])], { type: "image/jpeg" })),
}));
vi.mock("../web/src/lib/mp3", () => ({ ensureMp3: vi.fn(async (b: Blob) => new Blob([b], { type: "audio/mpeg" })) }));

import { setRuntime } from "../web/src/lib/anna";
import { getRecord, type CardRecord } from "../web/src/lib/records";
import { studio } from "../web/src/lib/studio";
import { catalogs, request } from "./fixtures";

const WORDS = JSON.stringify({
  title: "Happy birthday, Priya",
  message: "Your balcony tomatoes are the stuff of legend.",
  signoff: "Love, Sanjay",
  art_prompt: "sunlit balcony garden with ripe tomatoes",
  song_style: "bright acoustic pop",
  lyrics: "[verse]\nPriya grows tomatoes red\nOn the balcony\n[chorus]\nHappy birthday Priya\nShine today",
});

/** A fake Anna host: in-memory storage and files, and media jobs we finish on demand. */
function fakeHost() {
  const kv = new Map<string, unknown>();
  const files = new Map<string, Blob>();
  const jobs = new Map<string, { ns: string; state: string; args: any }>();
  let next = 0;
  const job = (ns: string) => async (args: any) => {
    const jobId = `${ns}-${++next}`;
    jobs.set(jobId, { ns, state: "running", args });
    return { jobId, state: "queued" };
  };
  const getJob = async ({ jobId }: { jobId: string }) => {
    const j = jobs.get(jobId);
    if (!j) throw Object.assign(new Error("not found"), { code: "JOB_NOT_FOUND" });
    if (j.state !== "succeeded") return { state: j.state };
    return j.ns === "image"
      ? { state: "succeeded", result: { images: [{ url: "https://r2.test/art.png" }] } }
      : { state: "succeeded", result: { url: "https://r2.test/song.wav", lyrics: j.args.lyrics ?? "Caption: soft acoustic folk.\nBPM: 100.0" } };
  };
  const rt = {
    llm: { complete: vi.fn(async () => ({ content: { type: "text", text: WORDS } })), catalog: vi.fn() },
    image: { generateAsync: vi.fn(job("image")), getJob: vi.fn(getJob), cancelJob: vi.fn(async () => ({})) },
    music: { generate: vi.fn(job("music")), getJob: vi.fn(getJob), cancelJob: vi.fn(async () => ({})) },
    audio: { speak: vi.fn(async () => ({ audioBase64: btoa("ID3voice"), mimeType: "audio/mpeg" })) },
    storage: {
      get: vi.fn(async ({ key }: any) => (kv.has(key) ? { exists: true, value: structuredClone(kv.get(key)) } : { exists: false })),
      set: vi.fn(async ({ key, value }: any) => void kv.set(key, structuredClone(value))),
      delete: vi.fn(async ({ key }: any) => void kv.delete(key)),
      list: vi.fn(async ({ prefix }: any) => ({ items: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) })),
    },
    files: {
      upload_init: vi.fn(async ({ path }: any) => ({ put_url: `https://put.test/${path}`, upload_id: path })),
      upload_finalize: vi.fn(async () => ({})),
      download_url: vi.fn(async ({ path }: any) => ({ get_url: `https://get.test/${path}` })),
      download: vi.fn(async () => ({})),
      delete: vi.fn(async ({ path }: any) => void files.delete(path)),
    },
    chat: {},
    mobile: {},
    window: {},
    entryPayload: null,
    on: () => () => {},
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      files.set(url.replace("https://put.test/", ""), init.body as Blob);
      return new Response(null, { status: 200 });
    }
    if (url.startsWith("https://get.test/")) {
      const f = files.get(url.replace("https://get.test/", ""));
      return f ? new Response(f, { status: 200 }) : new Response(null, { status: 404 });
    }
    return new Response(new Blob([new Uint8Array([1, 2, 3])]), { status: 200 });
  });
  const finish = (ns: string) => {
    for (const j of jobs.values()) if (j.ns === ns) j.state = "succeeded";
  };
  return { rt, kv, files, jobs, fetchMock, finish };
}

let host: ReturnType<typeof fakeHost>;

/** Let polling timers run until the promise settles. */
async function settle<T>(p: Promise<T>, ms = 60_000): Promise<T> {
  let done = false;
  let out!: T;
  let err: unknown;
  p.then((v) => ((out = v), (done = true))).catch((e) => ((err = e), (done = true)));
  for (let t = 0; !done && t < ms; t += 500) await vi.advanceTimersByTimeAsync(500);
  if (!done) throw new Error("timed out waiting");
  if (err) throw err;
  return out;
}

async function until(cond: () => boolean, ms = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting");
    await vi.advanceTimersByTimeAsync(500);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  host = fakeHost();
  setRuntime(host.rt as any);
  vi.stubGlobal("fetch", host.fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1024, height: 1536, close() {} })));
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(async () => {
  studio.detach();
  await studio.flush();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setRuntime(null);
});

describe("making a card", () => {
  it("writes, paints, records, sings and saves every part", async () => {
    const run = studio.create(request, { art: true, voice: true, song: true }, "hand", catalogs);
    await until(() => host.jobs.size === 2);
    host.finish("image");
    host.finish("music");
    const id = await settle(run);
    await studio.flush();

    const v = studio.get()!;
    expect(Object.values(v.record.stages).map((s) => s.state)).toEqual(["done", "done", "done", "done", "done"]);
    expect(v.record.files).toEqual({
      art: `cards/${id}/art.jpg`,
      voice: `cards/${id}/voice.mp3`,
      song: `cards/${id}/song.mp3`,
      card: `cards/${id}/card.jpg`,
    });
    expect(v.voice?.blob.type).toBe("audio/mpeg");
    expect(v.song?.blob.type).toBe("audio/mpeg");

    const art = host.rt.image.generateAsync.mock.calls[0][0];
    expect(art).toMatchObject({ model: "openai/gpt-image-2", size: "1024x1536", quality: "low", idempotencyKey: `${id}-art-0` });
    const song = host.rt.music.generate.mock.calls[0][0];
    expect(song).toMatchObject({ model: "fal-ai/ace-step", idempotencyKey: `${id}-song-0` });
    expect(song.lyrics).toContain("Priya grows tomatoes red");
    expect(song.durationSec).toBeGreaterThanOrEqual(35);

    const saved = await getRecord(id);
    expect(saved?.stages.card.state).toBe("done");
    expect(saved?.words?.title).toBe("Happy birthday, Priya");
  });

  it("asks for Hindi lyrics only from a model that sings Hindi", async () => {
    const run = studio.create({ ...request, language: "hi" }, { art: false, voice: false, song: true }, "hand", catalogs);
    await until(() => host.jobs.size === 1);
    host.finish("music");
    await settle(run);
    expect(host.rt.music.generate.mock.calls[0][0].model).toBe("google/lyria-3");
    // Lyria returns production notes in `lyrics`; the card keeps the words that were sung.
    expect(studio.get()!.record.lyrics).toContain("Priya grows tomatoes red");
    expect((host.rt.llm.complete.mock.calls as any)[0][0].messages[0].content.text).toContain("a song in Hindi");
  });
});

describe("closing the app mid-way", () => {
  it("resumes saved jobs instead of starting (and paying for) new ones", async () => {
    const run = studio.create(request, { art: true, voice: false, song: true }, "hand", catalogs);
    await until(() => host.jobs.size === 2);
    await studio.flush();
    const id = studio.get()!.record.id;

    // The user closes WishCraft while art and song are still being made.
    studio.detach();
    await run;
    await studio.flush();
    const saved = (await getRecord(id)) as CardRecord;
    expect(saved.stages.art.state).toBe("working");
    expect(saved.jobs.art).toBeTruthy();
    expect(saved.jobs.song).toBeTruthy();

    // Anna keeps working while the app is closed.
    host.finish("image");
    host.finish("music");

    // Reopening picks the same jobs back up.
    await settle(studio.open(saved));
    await studio.flush();
    const v = studio.get()!;
    expect(v.record.stages.art.state).toBe("done");
    expect(v.record.stages.song.state).toBe("done");
    expect(v.record.stages.card.state).toBe("done");
    expect(host.rt.image.generateAsync).toHaveBeenCalledTimes(1);
    expect(host.rt.music.generate).toHaveBeenCalledTimes(1);
    expect(host.rt.llm.complete).toHaveBeenCalledTimes(1);
  });

  it("re-opens a finished card from storage without generating anything", async () => {
    const run = studio.create(request, { art: true, voice: true, song: false }, "print", catalogs);
    await until(() => host.jobs.size === 1);
    host.finish("image");
    const id = await settle(run);
    await studio.flush();
    studio.detach();

    const calls = host.rt.image.generateAsync.mock.calls.length + host.rt.audio.speak.mock.calls.length;
    await settle(studio.open((await getRecord(id))!));
    const v = studio.get()!;
    expect(v.voice).not.toBeNull();
    expect(v.card).not.toBeNull();
    expect(v.art).not.toBeNull();
    expect(host.rt.image.generateAsync.mock.calls.length + host.rt.audio.speak.mock.calls.length).toBe(calls);
  });
});

describe("stopping and retrying", () => {
  it("cancels running jobs and uses a fresh job on retry", async () => {
    const run = studio.create(request, { art: true, voice: false, song: false }, "hand", catalogs);
    await until(() => host.jobs.size === 1);
    await studio.stop();
    await vi.advanceTimersByTimeAsync(6000);
    await run;
    expect(host.rt.image.cancelJob).toHaveBeenCalled();
    expect(studio.get()!.record.stages.art.state).toBe("failed");

    const retry = studio.retry("art");
    await until(() => host.jobs.size === 2);
    host.finish("image");
    await settle(retry);
    const keys = host.rt.image.generateAsync.mock.calls.map((c: any[]) => c[0].idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
    expect(studio.get()!.record.stages.art.state).toBe("done");
  });

  it("marks edited words as unsaved and the voice note as stale", async () => {
    const run = studio.create(request, { art: false, voice: true, song: false }, "hand", catalogs);
    await run;
    studio.editWords({ message: "A brand new message." });
    expect(studio.get()!.dirty).toBe(true);
    expect(studio.get()!.voiceStale).toBe(true);
    await studio.saveEdits();
    await studio.flush();
    expect(studio.get()!.dirty).toBe(false);
    expect((await getRecord(studio.get()!.record.id))?.words?.message).toBe("A brand new message.");
  });
});
