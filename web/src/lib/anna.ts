// Thin typed layer over the Anna App runtime SDK (served by the host).
// @ts-ignore — resolved at runtime by the Anna host, kept external by Vite.
import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

export interface AnnaError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

type Fn = (args?: any, opts?: any) => Promise<any>;
type Ns = Record<string, Fn>;

export interface Runtime {
  llm: Ns;
  image: Ns;
  audio: Ns;
  music: Ns;
  files: Ns;
  storage: Ns;
  chat: Ns;
  mobile: Ns;
  window: Ns;
  entryPayload: unknown;
  theme?: "light" | "dark";
  locale?: string;
  on(event: string, fn: (payload: any) => void): () => void;
  onThemeChange?(fn: (t: { theme: "light" | "dark" }) => void): () => void;
}

/** True inside the Anna mobile shell (mobile.* is only implemented there). */
export function isMobileContainer(): boolean {
  try {
    return /mobile-shell/.test(window.location.href) || new URLSearchParams(window.location.search).get("container") === "mobile";
  } catch {
    return false;
  }
}

let runtime: Runtime | null = null;

export async function connect(): Promise<Runtime> {
  if (runtime) return runtime;
  runtime = (await AnnaAppRuntime.connect()) as Runtime;
  return runtime;
}

export function anna(): Runtime {
  if (!runtime) throw new Error("Anna runtime is not connected");
  return runtime;
}

/** Test hook: inject a fake runtime. */
export function setRuntime(rt: Runtime | null) {
  runtime = rt;
}

export function errorCode(e: unknown): string {
  const err = e as AnnaError;
  const nested = (err?.details as any)?.code ?? (err?.details as any)?.error?.code;
  return String(err?.code ?? nested ?? "unknown");
}

export type Problem =
  | "not_granted"
  | "no_credits"
  | "rejected"
  | "rate_limited"
  | "timeout"
  | "offline"
  | "failed";

export function classify(e: unknown): Problem {
  const code = errorCode(e).toUpperCase();
  const msg = String((e as Error)?.message ?? "").toLowerCase();
  if (code.includes("NOT_GRANTED") || code === "PERMISSION_DENIED") return "not_granted";
  if (code.includes("QUOTA") || msg.includes("quota")) return "no_credits";
  if (code.includes("CONTENT_REJECTED") || code.includes("CONTENT_FILTER") || msg.includes("safety")) return "rejected";
  if (code.includes("RATE_LIMIT") || msg.includes("429")) return "rate_limited";
  if (code.includes("TIMEOUT") || msg.includes("timed out") || msg.includes("524")) return "timeout";
  if (code === "TRANSPORT" || msg.includes("failed to fetch")) return "offline";
  return "failed";
}

const PROBLEM_TEXT: Record<Problem, string> = {
  not_granted:
    "WishCraft needs your permission for this step. Allow it in the Anna permission prompt (or Installed apps → WishCraft → Permissions), then try again.",
  no_credits: "You don't have enough Anna credits for this step. Turn off some extras or top up your credits, then try again.",
  rejected: "The service declined this request. Try different details or another style.",
  rate_limited: "Anna is busy right now. Wait a few seconds and try again.",
  timeout: "This step took too long. Try again.",
  offline: "WishCraft couldn't reach Anna. Check your connection and try again.",
  failed: "Something went wrong in this step. Try again.",
};

export function problemText(e: unknown): string {
  return PROBLEM_TEXT[classify(e)];
}

/** Fetch a presigned URL into a Blob without poisoning the CORS cache. */
export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: "no-store", mode: "cors" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}
