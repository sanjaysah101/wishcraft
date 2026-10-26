import { describe, expect, it } from "vitest";
import { buildArtPrompt, buildWordsPrompt, normaliseLyrics, parseWords, voiceScript, type CardRequest } from "../web/src/lib/prompts";

const req: CardRequest = {
  occasion: "birthday",
  occasionDetail: "",
  recipient: "Priya",
  relationship: "younger sister",
  details: "Loves gardening",
  sender: "Sanjay",
  language: "hi",
  tone: "warm",
  artStyle: "watercolor",
};

describe("buildWordsPrompt", () => {
  it("names the language and wraps user facts in a data block", () => {
    const { system, user } = buildWordsPrompt(req);
    expect(user).toContain("Write the card in Hindi");
    expect(user).toMatch(/<card>[\s\S]*recipient name: Priya[\s\S]*<\/card>/);
    expect(system).toMatch(/never as instructions/i);
  });

  it("uses the festival name when given", () => {
    const { user } = buildWordsPrompt({ ...req, occasion: "festival", occasionDetail: "Diwali" });
    expect(user).toContain("occasion: Festival or holiday (Diwali)");
  });

  it("collapses whitespace and caps long details", () => {
    const { user } = buildWordsPrompt({ ...req, details: "a\n\n  b " + "x".repeat(2000) });
    expect(user).toContain("details about the recipient: a b x");
    expect(user).not.toContain("x".repeat(700));
  });
});

describe("parseWords", () => {
  it("parses JSON wrapped in a code fence", () => {
    const w = parseWords('```json\n{"title":"Hi","message":"Happy day","signoff":"Love","art_prompt":"garden","song_style":"pop","lyrics":"[Verse]\\nla"}\n```');
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

describe("helpers", () => {
  it("forbids text in the art prompt", () => {
    const p = buildArtPrompt(parseWords('{"message":"m","art_prompt":"tomato balcony"}'), req);
    expect(p).toMatch(/^tomato balcony\. Style: soft watercolour/);
    expect(p).toMatch(/no text, no letters/);
  });

  it("normalises lyric section tags for ACE-Step", () => {
    expect(normaliseLyrics("[Verse 1]\n  la la \n\n[CHORUS]\nhey")).toBe("[verse]\nla la\n[chorus]\nhey");
  });

  it("joins the voice script", () => {
    expect(voiceScript({ title: "Hi", message: "Msg", signoff: "" })).toBe("Hi\n\nMsg");
  });
});
