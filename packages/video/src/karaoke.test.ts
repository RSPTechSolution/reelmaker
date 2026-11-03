import { describe, expect, it } from 'vitest';
import type { WordTiming } from '@reelmaker/shared';
import { captionChunks } from './captions.ts';

const words = (n: number): WordTiming[] =>
  Array.from({ length: n }, (_, i) => ({ i, caption: `w${i}`, spoken: `w${i}`, start: i, end: i + 0.5, filled: false }));
const line = (caption: string) => ({ id: 'x', caption, spoken: caption });
const sizes = (c: WordTiming[][]) => c.map((x) => x.length);

describe('captionChunks', () => {
  it('never crosses a line boundary', () => {
    const lines = [line('a b c d e f'), line('g h')];
    const chunks = captionChunks(words(8), lines);
    expect(chunks.map((c) => c.map((w) => w.i))).toEqual([[0, 1, 2], [3, 4, 5], [6, 7]]);
  });

  it('balances chunks instead of leaving an orphan word', () => {
    expect(sizes(captionChunks(words(5), [line('a b c d e')]))).toEqual([3, 2]);
    expect(sizes(captionChunks(words(9), [line('a b c d e f g h i')]))).toEqual([3, 3, 3]);
    expect(sizes(captionChunks(words(4), [line('a b c d')]))).toEqual([4]);
    expect(sizes(captionChunks(words(1), [line('a')]))).toEqual([1]);
  });

  it('respects perChunk', () => {
    expect(sizes(captionChunks(words(6), [line('a b c d e f')], 2))).toEqual([2, 2, 2]);
  });

  it('falls back to plain chunks when words and lines disagree', () => {
    expect(sizes(captionChunks(words(10), [line('a b')]))).toEqual([4, 4, 2]);
  });
});
