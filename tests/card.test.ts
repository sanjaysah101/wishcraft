import { describe, expect, it } from "vitest";
import { fitLines, layoutLines, rng, seedFromId, segments } from "../web/src/lib/card";

const measure = (s: string) => s.length * 10;
const text = (l: { pieces: { text: string }[] }) => l.pieces.map((p) => p.text).join("");

describe("layoutLines", () => {
  it("wraps on word boundaries without leading or trailing spaces", () => {
    const lines = layoutLines("one two three four five", 100, measure);
    expect(lines.map(text)).toEqual(["one two", "three four", "five"]);
    for (const l of lines) expect(l.width).toBeLessThanOrEqual(100);
  });

  it("keeps paragraph breaks", () => {
    expect(layoutLines("a b\nc", 1000, measure).map(text)).toEqual(["a b", "c"]);
  });

  it("breaks words that are wider than a line", () => {
    const lines = layoutLines("supercalifragilistic", 50, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.width).toBeLessThanOrEqual(50);
  });

  it("wraps Chinese without spaces", () => {
    const lines = layoutLines("生日快乐我的好妹妹愿你天天开心", 60, measure, "zh");
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.width).toBeLessThanOrEqual(60);
    expect(lines.map(text).join("")).toBe("生日快乐我的好妹妹愿你天天开心");
  });

  it("never starts a line with closing punctuation", () => {
    const zh = layoutLines("陪伴我走过六载春秋，感谢您的悉心教导与包容。", 90, measure, "zh");
    for (const l of zh) expect(text(l)).not.toMatch(/^[，。]/);
    const en = layoutLines("Hello there, friend!", 110, measure, "en");
    for (const l of en) expect(text(l)).not.toMatch(/^[,!]/);
  });

  it("keeps Hindi words whole", () => {
    const words = segments("जन्मदिन मुबारक हो", "hi").filter((s) => s.trim());
    expect(words).toEqual(["जन्मदिन", "मुबारक", "हो"]);
  });
});

describe("fitLines", () => {
  const at = (size: number) => (s: string) => s.length * size * 0.5;
  it("uses the largest size that fits the box", () => {
    const fit = fitLines("a short message", { w: 400, h: 200 }, at, { max: 60, min: 20, lineHeight: 1.3 });
    expect(fit.size).toBe(60);
    expect(fit.height).toBeLessThanOrEqual(200);
  });
  it("shrinks long messages", () => {
    const long = "word ".repeat(80);
    const fit = fitLines(long, { w: 400, h: 300 }, at, { max: 60, min: 20, lineHeight: 1.3 });
    expect(fit.size).toBeLessThan(60);
    expect(fit.size).toBeGreaterThanOrEqual(20);
  });
});

describe("randomness", () => {
  it("is repeatable per card, so the export matches the preview", () => {
    const a = rng(seedFromId("abc"));
    const b = rng(seedFromId("abc"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seedFromId("abc")).not.toBe(seedFromId("abd"));
  });
});
