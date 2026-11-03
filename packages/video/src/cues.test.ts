import { describe, expect, it } from 'vitest';
import type { Cue, WordTiming } from '@reelmaker/shared';
import { activeCues, cueEndFrame, cueStartFrame } from './cues.ts';

// 20 words, word k spoken from k*0.5 s to k*0.5+0.4 s  → word k starts at frame 15k
const words: WordTiming[] = Array.from({ length: 20 }, (_, i) => ({
  i,
  caption: `w${i}`,
  spoken: `w${i}`,
  start: i * 0.5,
  end: i * 0.5 + 0.4,
  filled: false,
}));

const title = (id: string, atWord: number, untilWord?: number): Cue => ({
  id,
  atWord,
  ...(untilWord !== undefined ? { untilWord } : {}),
  block: { type: 'title', text: id },
});
const sticker = (id: string, atWord: number, untilWord?: number): Cue => ({
  id,
  atWord,
  ...(untilWord !== undefined ? { untilWord } : {}),
  block: { type: 'sticker', text: id },
});
const face = (id: string, atWord: number, expression: 'thinking' | 'wink'): Cue => ({
  id,
  atWord,
  block: { type: 'expression', expression },
});

describe('cue frames', () => {
  it('start at the cue word and end at the end of untilWord', () => {
    expect(cueStartFrame(title('a', 4), words)).toBe(60);
    expect(cueEndFrame(title('a', 4, 6), words)).toBe(Math.round(3.4 * 30));
    expect(cueEndFrame(title('a', 4), words)).toBe(Infinity);
  });
});

describe('activeCues', () => {
  it('activeCues picks latest main cue', () => {
    const cues = [title('a', 0), title('b', 4), title('c', 8)];
    expect(activeCues(cues, words, 0).main?.id).toBe('a');
    expect(activeCues(cues, words, 59).main?.id).toBe('a');
    expect(activeCues(cues, words, 60).main?.id).toBe('b');
    expect(activeCues(cues, words, 500).main?.id).toBe('c');
  });

  it('order in the array does not matter', () => {
    const cues = [title('c', 8), title('a', 0), title('b', 4)];
    expect(activeCues(cues, words, 70).main?.id).toBe('b');
  });

  it('nothing before the first cue', () => {
    expect(activeCues([title('a', 2)], words, 10)).toEqual({ main: undefined, stickers: [], expression: 'happy' });
  });

  it('activeCues keeps sticker overlays alongside main', () => {
    const cues = [title('a', 0), sticker('s', 2), title('b', 10)];
    const at = activeCues(cues, words, 40);
    expect(at.main?.id).toBe('a');
    expect(at.stickers.map((c) => c.id)).toEqual(['s']);
    // a sticker without untilWord lasts until the next main cue starts
    expect(activeCues(cues, words, 150).stickers).toEqual([]);
  });

  it('activeCues ends cue after untilWord', () => {
    const cues = [title('a', 0, 3), sticker('s', 1, 2)];
    expect(activeCues(cues, words, 30).main?.id).toBe('a');
    expect(activeCues(cues, words, 40).stickers.map((c) => c.id)).toEqual(['s']); // word 2 ends at 1.4 s = frame 42
    expect(activeCues(cues, words, 43).stickers).toEqual([]);
    expect(activeCues(cues, words, 60).main).toBeUndefined(); // word 3 ended at 1.9 s = frame 57
  });

  it('a newer main cue replaces the old one even after the newer one ends', () => {
    const cues = [title('a', 0), title('b', 4, 5)];
    expect(activeCues(cues, words, 100).main).toBeUndefined();
  });

  it('expression defaults to happy', () => {
    expect(activeCues([title('a', 0)], words, 100).expression).toBe('happy');
    const cues = [face('f1', 2, 'thinking'), face('f2', 6, 'wink')];
    expect(activeCues(cues, words, 40).expression).toBe('thinking');
    expect(activeCues(cues, words, 95).expression).toBe('wink');
    expect(activeCues(cues, words, 95).main).toBeUndefined(); // expressions are not main blocks
  });

  it('falls back to ~2.3 words/s when a word has no timing', () => {
    expect(cueStartFrame(title('a', 23), [])).toBe(300);
  });
});
