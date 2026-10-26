import { describe, expect, it } from "vitest";
import { estimateCu, planImage, planSong, planVoice, songCu, type Catalogs } from "../web/src/lib/pricing";

// Shapes and prices as returned by anna.llm.catalog on 2026-10-27.
const catalogs: Catalogs = {
  remainingCU: 800,
  image: [
    {
      modelName: "openai/gpt-image-2",
      pricing: { unit: "per_image", cuPerImage: 182, cuBySizeQuality: { "1024x1536": { low: 4, medium: 36, high: 142 } } },
    },
    { modelName: "bytedance/seedream/v5/pro/text-to-image", pricing: { unit: "per_image", cuPerImage: 58, cuByMaxPixels: [{ maxPixels: 2359296, cu: 58 }] } },
  ],
  tts: [
    {
      modelName: "qwen3-tts-flash-realtime",
      pricing: { cuPer1kChars: 1 },
      capabilities: { maxCharsPerCall: 2000, voices: [{ id: "Cherry", languages: ["zh", "en"] }] },
    },
    {
      modelName: "xai/tts/v1",
      pricing: { cuPer1kChars: 13 },
      capabilities: { maxCharsPerCall: 2000, voices: [{ id: "Ara", languages: ["en", "hi"] }] },
    },
  ],
  music: [
    { modelName: "fal-ai/minimax-music/v2.6", pricing: { unit: "per_song", cuPerSong: 129 }, capabilities: { lyrics: true, lyricsMode: "field", duration: { type: "fixed" } } },
    {
      modelName: "fal-ai/ace-step",
      pricing: { unit: "per_second", cuPerSecond: 1, cuExample: { durationSec: 60, cu: 10 } },
      capabilities: { lyrics: true, lyricsMode: "field", duration: { type: "range", min: 5, max: 240, default: 60 } },
    },
    { modelName: "fal-ai/stable-audio-25/text-to-audio", pricing: { unit: "per_song", cuPerSong: 172 }, capabilities: { lyrics: false, instrumentalOnly: true } },
  ],
};

describe("planImage", () => {
  it("picks GPT Image 2 at low quality, portrait", () => {
    expect(planImage(catalogs.image)).toEqual({ model: "openai/gpt-image-2", size: "1024x1536", quality: "low", cu: 4 });
  });
  it("falls back to the cheapest model", () => {
    expect(planImage(catalogs.image.slice(1))?.model).toBe("bytedance/seedream/v5/pro/text-to-image");
    expect(planImage([])).toBeNull();
  });
});

describe("planVoice", () => {
  it("uses the cheapest model whose voices speak the language", () => {
    expect(planVoice(catalogs.tts, "en")).toMatchObject({ model: "qwen3-tts-flash-realtime", voice: "Cherry" });
    expect(planVoice(catalogs.tts, "hi")).toMatchObject({ model: "xai/tts/v1", voice: "Ara" });
  });
});

describe("planSong", () => {
  it("chooses ACE-Step for a 30-second sung song", () => {
    expect(planSong(catalogs.music)).toEqual({ model: "fal-ai/ace-step", durationSec: 30, lyricsField: true, cu: 5 });
  });
  it("prices per-minute models by started minute", () => {
    expect(songCu({ modelName: "x", pricing: { unit: "per_minute", cuPerMinute: 517 } }, 30)).toBe(517);
  });
});

describe("estimateCu", () => {
  it("adds words, art, voice and song", () => {
    expect(estimateCu(catalogs, { art: true, voice: true, song: true }, "en")).toBe(11);
    expect(estimateCu(catalogs, { art: false, voice: false, song: false }, "en")).toBe(1);
  });
});
