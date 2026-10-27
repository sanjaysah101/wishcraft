import { afterEach, describe, expect, it } from "vitest";
import { setRuntime } from "../web/src/lib/anna";
import { getRecord, isFinished, needsResume } from "../web/src/lib/records";
import { request } from "./fixtures";

function withStorage(kv: Record<string, unknown>) {
  setRuntime({
    storage: { get: async ({ key }: any) => (key in kv ? { exists: true, value: kv[key] } : { exists: false }) },
  } as any);
}

afterEach(() => setRuntime(null));

describe("cards saved by WishCraft 0.1", () => {
  it("open as finished cards with every file", async () => {
    withStorage({
      "cards/old": {
        id: "old",
        createdAt: "2026-10-26T10:00:00.000Z",
        request,
        title: "Happy birthday, Priya",
        message: "Old message",
        signoff: "Love, Sanjay",
        font: "hand",
        files: { card: "cards/old/card.png", art: "cards/old/art.png", voice: "cards/old/voice.mp3" },
      },
    });
    const r = (await getRecord("old"))!;
    expect(r.v).toBe(2);
    expect(r.files).toMatchObject({ card: "cards/old/card.png", art: "cards/old/art.png", voice: "cards/old/voice.mp3" });
    expect(r.words).toMatchObject({ title: "Happy birthday, Priya", message: "Old message" });
    expect(r.extras).toEqual({ art: true, voice: true, song: false });
    expect(r.stages.song.state).toBe("skipped");
    expect(isFinished(r)).toBe(true);
    expect(needsResume(r)).toBe(false);
  });

  it("returns null for missing or broken records", async () => {
    withStorage({ "cards/bad": { nope: true } });
    expect(await getRecord("missing")).toBeNull();
    expect(await getRecord("bad")).toBeNull();
  });
});
