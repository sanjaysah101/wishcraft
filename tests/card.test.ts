import { describe, expect, it } from "vitest";
import { fitText, wrapLines } from "../web/src/lib/card";

// Monospace-ish measure: each character is 10px wide at size 20.
const measureAt = (size: number) => (s: string) => Array.from(s).length * (size / 2);
const measure = measureAt(20);

describe("wrapLines", () => {
  it("wraps on word boundaries", () => {
    expect(wrapLines("happy birthday dear friend", 150, measure)).toEqual(["happy birthday", "dear friend"]);
  });

  it("keeps explicit paragraphs", () => {
    expect(wrapLines("one\ntwo", 500, measure)).toEqual(["one", "two"]);
  });

  it("breaks CJK text by character", () => {
    const lines = wrapLines("生日快乐我的朋友祝你幸福", 60, measure, "zh");
    expect(lines.every((l) => measure(l) <= 60)).toBe(true);
    expect(lines.join("")).toBe("生日快乐我的朋友祝你幸福");
  });

  it("splits a single over-long word", () => {
    const lines = wrapLines("supercalifragilistic", 80, measure);
    expect(lines.every((l) => measure(l) <= 80)).toBe(true);
    expect(lines.join("")).toBe("supercalifragilistic");
  });
});

describe("fitText", () => {
  it("returns the largest size that fits the box", () => {
    const r = fitText("happy birthday dear friend", { w: 300, h: 40 }, measureAt, { max: 40, min: 10, lineHeight: 1 });
    expect(r.height).toBeLessThanOrEqual(40);
    expect(r.size).toBeGreaterThanOrEqual(20);
  });

  it("falls back to the minimum size when nothing fits", () => {
    const r = fitText("a ".repeat(200), { w: 50, h: 10 }, measureAt, { max: 20, min: 10, lineHeight: 1 });
    expect(r.size).toBe(10);
  });
});
