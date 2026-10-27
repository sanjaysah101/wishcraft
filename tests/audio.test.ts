import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioController, formatTime } from "../web/src/lib/audio";

const created: HTMLAudioElement[] = [];

beforeEach(() => {
  audioController.stop();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const Real = window.Audio;
  vi.stubGlobal(
    "Audio",
    vi.fn(() => {
      const el = new Real();
      created.push(el);
      return el;
    }),
  );
});

describe("one audio player for the whole app", () => {
  it("starting the song stops the voice note", async () => {
    await audioController.toggle("card:voice", "blob:voice");
    expect(audioController.getState()).toMatchObject({ trackId: "card:voice", playing: true });

    await audioController.toggle("card:song", "blob:song");
    expect(audioController.getState()).toMatchObject({ trackId: "card:song", playing: true });
    // Never more than one element, so two tracks can't overlap.
    expect(new Set(created).size).toBeLessThanOrEqual(1);
  });

  it("toggling the same track pauses and resumes it", async () => {
    await audioController.toggle("a", "blob:a");
    await audioController.toggle("a", "blob:a");
    expect(audioController.getState().playing).toBe(false);
    await audioController.toggle("a", "blob:a");
    expect(audioController.getState().playing).toBe(true);
  });

  it("stop(id) only stops that track", async () => {
    await audioController.toggle("a", "blob:a");
    audioController.stop("b");
    expect(audioController.getState().trackId).toBe("a");
    audioController.stop("a");
    expect(audioController.getState()).toMatchObject({ trackId: null, playing: false });
  });

  it("formats times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.4)).toBe("1:05");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
