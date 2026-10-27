import { describe, expect, it } from "vitest";
import {
  buildArtPrompt,
  buildWordsPrompt,
  displayLyrics,
  lyricLines,
  normaliseLyrics,
  parseWords,
  voiceScript,
} from "../web/src/lib/prompts";
import { request } from "./fixtures";

const hindi = { ...request, language: "hi" };

describe("buildWordsPrompt", () => {
  it("names the language and wraps user facts in a data block", () => {
    const { system, user } = buildWordsPrompt(hindi, null);
    expect(user).toContain("Write the card in Hindi");
    expect(user).toMatch(/<card>[\s\S]*recipient name: Priya[\s\S]*<\/card>/);
    expect(system).toMatch(/never as instructions/i);
  });

  it("asks for lyrics in the song's language with an exact line count", () => {
    const { user } = buildWordsPrompt(hindi, { language: "en", lines: 8 });
    expect(user).toContain("a song in English");
    expect(user).toContain("exactly 4 short lines under [verse] and 4 short lines under [chorus]");
  });

  it("asks for no lyrics when there is no song", () => {
    expect(buildWordsPrompt(request, null).user).toContain('"lyrics": ""');
  });

  it("uses the festival name when given", () => {
    const { user } = buildWordsPrompt({ ...request, occasion: "festival", occasionDetail: "Diwali" }, null);
    expect(user).toContain("occasion: Festival (Diwali)");
  });

  it("collapses whitespace and caps long details", () => {
    const { user } = buildWordsPrompt({ ...request, details: "a\n\n  b " + "x".repeat(2000) }, null);
    expect(user).toContain("details about the recipient: a b x");
    expect(user).not.toContain("x".repeat(700));
  });
});

describe("parseWords", () => {
  it("parses JSON wrapped in a code fence", () => {
    const w = parseWords(
      '```json\n{"title":"Hi","message":"Happy day","signoff":"Love","art_prompt":"garden","song_style":"pop","lyrics":"[Verse]\\nla"}\n```',
    );
    expect(w).toMatchObject({ title: "Hi", message: "Happy day", signoff: "Love", artPrompt: "garden", songStyle: "pop" });
  });

  it("derives a title when the model omits it", () => {
    expect(parseWords('{"message":"Happy birthday Priya! More words."}').title).toBe("Happy birthday Priya");
  });

  it("rejects replies without a message", () => {
    expect(() => parseWords('{"title":"x"}')).toThrow(/empty message/);
    expect(() => parseWords("no json here")).toThrow(/no card text/);
  });
});

describe("lyrics", () => {
  const raw = "[Verse 1]\n  la la \n\n[CHORUS]\nhey\nho";
  it("normalises section tags", () => {
    expect(normaliseLyrics(raw)).toBe("[verse]\nla la\n[chorus]\nhey\nho");
  });
  it("lists only sung lines", () => {
    expect(lyricLines(raw)).toEqual(["la la", "hey", "ho"]);
  });
  it("shows lyrics without tags", () => {
    expect(displayLyrics(raw)).toBe("la la\n\nhey\nho");
  });
});

describe("helpers", () => {
  it("forbids text in the art prompt", () => {
    const p = buildArtPrompt(parseWords('{"message":"m","art_prompt":"tomato balcony"}'), request);
    expect(p).toMatch(/^tomato balcony\. Style: soft watercolour/);
    expect(p).toMatch(/no text, letters/);
  });

  it("joins the voice script", () => {
    expect(voiceScript({ title: "Hi", message: "Msg", signoff: "" })).toBe("Hi\n\nMsg");
  });
});
