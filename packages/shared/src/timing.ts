import type { Reel, WordTiming } from './schema.ts';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const SAFE = { top: 220, bottom: 380, right: 120, left: 60 } as const;

/** Seconds after the last word before the end card starts. */
const TAIL_SEC = 0.8;
/** End card length in seconds. */
const END_CARD_SEC = 1.5;
const MIN_FRAMES = 90;

/** Frame at which word `i` starts; `fallbackSec` when the word has no timing. */
export function wordFrame(words: WordTiming[], i: number, fallbackSec: number): number {
  const w = words.find((x) => x.i === i);
  return Math.round((w ? w.start : fallbackSec) * FPS);
}

export function durationInFrames(words: WordTiming[]): number {
  const lastEnd = words.reduce((m, w) => Math.max(m, w.end), 0);
  // toFixed guards against float noise like 368.99999999 or 369.0000001 before ceil.
  const frames = Math.ceil(Number(((lastEnd + TAIL_SEC + END_CARD_SEC) * FPS).toFixed(6)));
  return Math.max(MIN_FRAMES, frames);
}

/** Hash of everything the voice audio depends on: spoken text and mood of every line + voice settings. */
export function spokenHash(reel: Reel): string {
  const { engine, voiceId, speed } = reel.voice;
  return sha1Hex(
    JSON.stringify({
      // mood changes pace and pauses, so it belongs to the voice too
      lines: reel.lines.map((l) => (l.mood ? [l.id, l.spoken, l.mood] : [l.id, l.spoken])),
      voice: [engine, voiceId, speed],
    }),
  );
}

export function chunkWords(words: WordTiming[], perChunk = 4): WordTiming[][] {
  const chunks: WordTiming[][] = [];
  for (let k = 0; k < words.length; k += perChunk) chunks.push(words.slice(k, k + perChunk));
  return chunks;
}

/**
 * SHA-1 of a string's UTF-8 bytes, as hex. Plain JS so this package also runs in the
 * browser (web Player) without node:crypto.
 */
export function sha1Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
      else if (t < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
      else if (t < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
      else [f, k] = [b ^ c ^ d, 0xca62c1d6];
      const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30) >>> 0;
      b = a;
      a = tmp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, '0')).join('');
}
