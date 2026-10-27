import { useSyncExternalStore } from "react";

/**
 * The whole app shares ONE <audio> element, so two tracks can never play at
 * the same time (the voice note and the song used to overlap). Starting any
 * track replaces the previous one; switching cards or screens stops playback.
 */
export interface AudioState {
  trackId: string | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  error: string | null;
}

const IDLE: AudioState = { trackId: null, playing: false, loading: false, time: 0, duration: 0, error: null };

class AudioController {
  private el: HTMLAudioElement | null = null;
  private state: AudioState = IDLE;
  private listeners = new Set<() => void>();
  private src: string | null = null;

  private audio(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = "metadata";
    const sync = () =>
      this.set({
        playing: !el.paused && !el.ended,
        time: el.currentTime || 0,
        duration: Number.isFinite(el.duration) ? el.duration : this.state.duration,
      });
    el.addEventListener("timeupdate", sync);
    el.addEventListener("durationchange", sync);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("play", sync);
    el.addEventListener("pause", sync);
    el.addEventListener("playing", () => this.set({ loading: false }));
    el.addEventListener("waiting", () => this.set({ loading: true }));
    el.addEventListener("ended", () => this.set({ playing: false, time: 0 }));
    el.addEventListener("error", () => this.set({ playing: false, loading: false, error: "This audio couldn't be played." }));
    this.el = el;
    return el;
  }

  private set(patch: Partial<AudioState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  async toggle(trackId: string, url: string) {
    const el = this.audio();
    if (this.state.trackId === trackId && this.src === url) {
      if (el.paused) await this.safePlay(el);
      else el.pause();
      return;
    }
    el.pause();
    this.src = url;
    el.src = url;
    this.set({ trackId, playing: false, loading: true, time: 0, duration: 0, error: null });
    await this.safePlay(el);
  }

  private async safePlay(el: HTMLAudioElement) {
    try {
      await el.play();
    } catch (e) {
      if ((e as Error).name !== "AbortError") this.set({ playing: false, loading: false, error: "This audio couldn't be played." });
    }
  }

  seek(trackId: string, seconds: number) {
    if (this.state.trackId !== trackId || !this.el) return;
    this.el.currentTime = Math.max(0, Math.min(seconds, this.el.duration || seconds));
    this.set({ time: this.el.currentTime });
  }

  /** Stop playback; with an id, only if that track is the current one. */
  stop(trackId?: string) {
    if (trackId && this.state.trackId !== trackId) return;
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute("src");
      this.el.load();
    }
    this.src = null;
    this.set(IDLE);
  }
}

export const audioController = new AudioController();

export function useAudio(): AudioState {
  return useSyncExternalStore(audioController.subscribe, audioController.getState, audioController.getState);
}

export function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
