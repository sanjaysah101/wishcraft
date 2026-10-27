import type { Catalogs } from "../web/src/lib/pricing";
import type { CardRequest } from "../web/src/lib/prompts";

/**
 * Catalogue entries in the shape returned by anna.llm.catalog (trimmed to
 * the fields WishCraft reads). Prices and languages as listed on 2026-10-27.
 */
export const catalogs: Catalogs = {
  remainingCU: 800,
  image: [
    {
      modelName: "openai/gpt-image-2",
      pricing: { unit: "per_image", cuPerImage: 182, cuBySizeQuality: { "1024x1536": { low: 4, medium: 36, high: 142 } } },
    },
    {
      modelName: "bytedance/seedream/v5/pro/text-to-image",
      pricing: { unit: "per_image", cuPerImage: 58, cuByMaxPixels: [{ maxPixels: 2359296, cu: 58 }] },
    },
  ],
  tts: [
    {
      modelName: "qwen3-tts-flash-realtime",
      pricing: { cuPer1kChars: 1 },
      capabilities: {
        maxCharsPerCall: 2000,
        voices: [
          { id: "Cherry", languages: ["zh", "en"] },
          { id: "Ethan", languages: ["en", "zh"] },
          { id: "Sonrisa", languages: ["es", "en"] },
        ],
      },
    },
    {
      modelName: "xai/tts/v1",
      pricing: { cuPer1kChars: 13 },
      capabilities: { maxCharsPerCall: 2000, voices: [{ id: "Ara", languages: ["en", "ar", "zh", "fr", "de", "hi", "ja", "ko", "pt", "ru", "es"] }] },
    },
  ],
  music: [
    {
      modelName: "fal-ai/minimax-music/v2.6",
      pricing: { unit: "per_song", cuPerSong: 129 },
      capabilities: { lyrics: true, lyricsMode: "field", duration: { type: "range", min: 10, max: 240 }, formats: ["mp3", "wav"] },
    },
    {
      modelName: "fal-ai/ace-step",
      pricing: { unit: "per_second", cuPerSecond: 1, cuExample: { durationSec: 60, cu: 10 } },
      capabilities: {
        lyrics: true,
        lyricsMode: "field",
        duration: { type: "range", min: 5, max: 240, default: 60 },
        lyricsLanguages: ["en", "zh", "ru", "es", "ja", "de", "fr", "pt", "it", "ko"],
        formats: ["wav"],
      },
    },
    {
      modelName: "google/lyria-3",
      pricing: { unit: "per_song", cuPerSong: 34 },
      capabilities: {
        lyrics: true,
        lyricsMode: "prompt_embedded",
        duration: { type: "fixed", typicalMaxSec: 30 },
        lyricsLanguages: ["en", "de", "es", "fr", "hi", "ja", "ko", "pt"],
        formats: ["mp3"],
      },
    },
    {
      modelName: "fal-ai/stable-audio-25/text-to-audio",
      pricing: { unit: "per_song", cuPerSong: 172 },
      capabilities: { lyrics: false, instrumentalOnly: true },
    },
  ],
};

export const request: CardRequest = {
  occasion: "birthday",
  occasionDetail: "",
  recipient: "Priya",
  relationship: "younger sister",
  details: "Loves gardening and grows tomatoes on her balcony",
  sender: "Sanjay",
  language: "en",
  tone: "warm",
  artStyle: "watercolor",
};
