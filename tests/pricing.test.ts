import { describe, expect, it } from "vitest";
import { estimate, lyricsSpec, planImage, planSong, planVoice, songCu, songSeconds } from "../web/src/lib/pricing";
import { catalogs } from "./fixtures";

describe("planImage", () => {
  it("uses GPT Image 2 at low quality in portrait", () => {
    expect(planImage(catalogs.image)).toEqual({ model: "openai/gpt-image-2", size: "1024x1536", quality: "low", cu: 4 });
  });
  it("falls back to the cheapest model, or nothing", () => {
    expect(planImage(catalogs.image.slice(1))?.model).toBe("bytedance/seedream/v5/pro/text-to-image");
    expect(planImage([])).toBeNull();
  });
});

describe("planVoice", () => {
  it("picks the cheapest voice that speaks the language", () => {
    expect(planVoice(catalogs.tts, "en")).toMatchObject({ model: "qwen3-tts-flash-realtime" });
    expect(planVoice(catalogs.tts, "es")).toMatchObject({ model: "qwen3-tts-flash-realtime", voice: "Sonrisa" });
  });
  it("prefers a native speaker", () => {
    expect(planVoice(catalogs.tts, "en")?.voice).toBe("Ethan");
  });
  it("never reads Hindi with a Chinese/English voice", () => {
    expect(planVoice(catalogs.tts, "hi")).toMatchObject({ model: "xai/tts/v1", voice: "Ara" });
  });
  it("returns null when no voice speaks the language", () => {
    expect(planVoice(catalogs.tts, "bn")).toBeNull();
    expect(planVoice(catalogs.tts, "sw")).toBeNull();
  });
});

describe("planSong", () => {
  it("uses ACE-Step for English with a length sized to the lyrics", () => {
    const p = planSong(catalogs.music, "en")!;
    expect(p).toMatchObject({ model: "fal-ai/ace-step", language: "en", variableLength: true, lines: 8, lyricsField: true });
    expect(p.minSec).toBeGreaterThanOrEqual(35);
  });
  it("sings Hindi with a model that supports Hindi lyrics", () => {
    const p = planSong(catalogs.music, "hi")!;
    expect(p).toMatchObject({ model: "google/lyria-3", language: "hi", variableLength: false, lyricsField: false });
    expect(p.lines).toBe(4);
  });
  it("falls back to English lyrics when no model sings the language", () => {
    expect(planSong(catalogs.music, "bn")).toMatchObject({ model: "fal-ai/ace-step", language: "en" });
  });
  it("ignores instrumental-only models", () => {
    expect(planSong(catalogs.music.filter((m) => m.capabilities?.instrumentalOnly), "en")).toBeNull();
  });
  it("lyricsSpec follows the plan", () => {
    expect(lyricsSpec(planSong(catalogs.music, "hi"))).toEqual({ language: "hi", lines: 4 });
    expect(lyricsSpec(null)).toBeNull();
  });
});

describe("songSeconds", () => {
  const plan = { minSec: 35, maxSec: 120 };
  it("gives eight lines enough time to be sung in full", () => {
    const lyrics =
      "[verse]\nPriya grows the reddest tomatoes\nOn her sunny balcony each spring\nLittle sister with the greenest fingers\nEvery leaf is dancing when you sing\n[chorus]\nHappy birthday Priya shine today\nAll the flowers turn to say hooray\nMay your garden grow forever bright\nHappy birthday sister, sleep tonight";
    const s = songSeconds(lyrics, plan);
    expect(s).toBeGreaterThanOrEqual(45);
    expect(s).toBeLessThanOrEqual(80);
  });
  it("counts characters for scripts without spaces", () => {
    const zh = "[verse]\n" + Array(8).fill("生日快乐我的好妹妹").join("\n");
    expect(songSeconds(zh, plan)).toBeGreaterThan(45);
  });
  it("stays inside the model limits", () => {
    expect(songSeconds("", plan)).toBe(35);
    expect(songSeconds(Array(80).fill("a very long line of words to sing").join("\n"), plan)).toBe(120);
  });
});

describe("costs", () => {
  it("prices per-minute models by started minute", () => {
    expect(songCu({ modelName: "x", pricing: { unit: "per_minute", cuPerMinute: 517 } }, 30)).toBe(517);
  });
  it("adds up the parts the user turned on", () => {
    const all = estimate(catalogs, { art: true, voice: true, song: true }, "en");
    expect(all.parts).toMatchObject({ words: 1, art: 4, voice: 1 });
    expect(all.parts.song).toBeGreaterThan(0);
    expect(all.total).toBe(Math.ceil(1 + 4 + 1 + all.parts.song));
    expect(estimate(catalogs, { art: false, voice: false, song: false }, "en").total).toBe(1);
  });
  it("charges nothing for a voice that isn't available", () => {
    expect(estimate(catalogs, { art: false, voice: true, song: false }, "bn").parts.voice).toBe(0);
  });
});
