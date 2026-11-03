import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Reel, WordTiming } from './schema.ts';
import { chunkWords, durationInFrames, FPS, sha1Hex, spokenHash, wordFrame } from './timing.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = (): Reel =>
  JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'example-reel.json'), 'utf8'));

const word = (i: number, start: number, end: number): WordTiming => ({
  i,
  caption: `w${i}`,
  spoken: `w${i}`,
  start,
  end,
  filled: false,
});

describe('wordFrame', () => {
  it('returns the frame of the word start', () => {
    expect(wordFrame([word(0, 0, 0.5), word(1, 1.0, 1.4)], 1, 0)).toBe(30);
  });

  it('wordFrame uses fallback when index missing', () => {
    expect(wordFrame([word(0, 0, 0.5)], 7, 2.5)).toBe(2.5 * FPS);
  });
});

describe('durationInFrames', () => {
  it('durationInFrames adds tail', () => {
    expect(durationInFrames([word(0, 0, 4), word(1, 9.5, 10.0)])).toBe(369);
  });

  it('has a minimum of 90 frames', () => {
    expect(durationInFrames([])).toBe(90);
    expect(durationInFrames([word(0, 0, 0.1)])).toBe(90);
  });
});

describe('spokenHash', () => {
  it('spokenHash changes when spoken text changes but not when caption changes', () => {
    const base = example();
    const h = spokenHash(base);

    const captionEdit = example();
    captionEdit.lines[0].caption = captionEdit.lines[0].caption.toUpperCase();
    expect(spokenHash(captionEdit)).toBe(h);

    const spokenEdit = example();
    spokenEdit.lines[0].spoken = spokenEdit.lines[0].spoken + ' नया';
    expect(spokenHash(spokenEdit)).not.toBe(h);
  });

  it('changes when voice settings change', () => {
    const r = example();
    const h = spokenHash(r);
    r.voice.speed = 1.2;
    expect(spokenHash(r)).not.toBe(h);
  });

  it('sha1Hex matches known vectors', () => {
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    const long = 'नमस्ते दोस्तों '.repeat(20); // multi-byte UTF-8, spans several 64-byte blocks
    expect(sha1Hex(long)).toBe(createHash('sha1').update(long, 'utf8').digest('hex'));
  });
});

describe('chunkWords', () => {
  it('chunkWords splits 10 words into 4,4,2', () => {
    const words = Array.from({ length: 10 }, (_, i) => word(i, i, i + 0.5));
    expect(chunkWords(words).map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it('respects perChunk', () => {
    const words = Array.from({ length: 5 }, (_, i) => word(i, i, i + 0.5));
    expect(chunkWords(words, 2).map((c) => c.length)).toEqual([2, 2, 1]);
  });
});
