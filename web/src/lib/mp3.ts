const SAMPLE_RATE = 44100;
const KBPS = 160;
const FRAME = 1152;

/** Trust the bytes, not the label: storage often serves audio as octet-stream. */
async function isMp3(blob: Blob): Promise<boolean> {
  if (/mpeg|mp3/i.test(blob.type)) return true;
  const b = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
  return b[0] === 0xff && (b[1] & 0xe0) === 0xe0; // MPEG frame sync
}

function toInt16(data: Float32Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  const Ctx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx: OfflineAudioContext = new Ctx(2, 1, SAMPLE_RATE);
  return ctx.decodeAudioData(bytes);
}

/**
 * Every WishCraft audio download is MP3. Some music models only return WAV,
 * so convert in the browser. Work is chunked to keep the UI responsive.
 */
export async function ensureMp3(blob: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  if (await isMp3(blob)) return blob.type === "audio/mpeg" ? blob : new Blob([blob], { type: "audio/mpeg" });
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const audio = await decode(blob);
  const stereo = audio.numberOfChannels > 1;
  const left = toInt16(audio.getChannelData(0));
  const right = stereo ? toInt16(audio.getChannelData(1)) : undefined;
  const encoder = new Mp3Encoder(stereo ? 2 : 1, audio.sampleRate, KBPS);
  const parts: BlobPart[] = [];
  const total = left.length;
  for (let i = 0, n = 0; i < total; i += FRAME, n++) {
    const l = left.subarray(i, i + FRAME);
    const chunk = right ? encoder.encodeBuffer(l, right.subarray(i, i + FRAME)) : encoder.encodeBuffer(l);
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if (n % 200 === 0) {
      onProgress?.(i / total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const end = encoder.flush();
  if (end.length) parts.push(new Uint8Array(end));
  onProgress?.(1);
  return new Blob(parts, { type: "audio/mpeg" });
}
