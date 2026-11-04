import { describe, expect, it } from 'vitest';
import type { Cue, WordTiming } from '@reelmaker/shared';
import { activeCues, cueEndFrame, cueStartFrame, isMorph, mainBefore, MORPH_FRAMES, propDelay } from './cues.ts';

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

  describe('line mood drives the face', () => {
    // 20 words as 4 lines of 5 words; line k starts at word 5k = frame 75k
    const lines = [0, 1, 2, 3].map((k) => ({
      id: `l${k + 1}`,
      caption: 'a b c d e',
      spoken: 'a b c d e',
      ...(k === 1 ? { mood: 'funny' as const } : k === 2 ? { mood: 'shocked' as const } : {}),
    }));

    it('uses the current line mood when no expression cue is set inside that line', () => {
      expect(activeCues([], words, 80, lines).expression).toBe('laughing'); // line 2, funny
      expect(activeCues([], words, 160, lines).expression).toBe('shocked'); // line 3
      expect(activeCues([], words, 10, lines).expression).toBe('happy'); // line 1, no mood
    });

    it('an expression cue inside the line overrides its mood', () => {
      const cues = [face('f', 7, 'wink')]; // word 7 is in line 2
      expect(activeCues(cues, words, 90, lines).expression).toBe('laughing'); // before the cue
      expect(activeCues(cues, words, 110, lines).expression).toBe('wink');
    });

    it('a line without mood keeps the latest earlier expression cue', () => {
      const cues = [face('f', 2, 'thinking')];
      expect(activeCues(cues, words, 230, lines).expression).toBe('thinking'); // line 4 has no mood
    });
  });

  it('falls back to ~2.3 words/s when a word has no timing', () => {
    expect(cueStartFrame(title('a', 23), [])).toBe(300);
  });
});

describe('scene to scene', () => {
  const scene = (id: string, block: Partial<Extract<Cue['block'], { type: 'scene' }>>): Cue => ({
    id,
    atWord: 0,
    block: { type: 'scene', ...block },
  });

  it('isMorph: back-to-back scenes with poses keep the stickman', () => {
    expect(MORPH_FRAMES).toBe(8);
    expect(isMorph(scene('a', { pose: 'thinking' }), scene('b', { pose: 'idea', props: ['bulb'] }))).toBe(true);
    expect(isMorph(scene('a', { pose: 'thinking' }), title('t', 0))).toBe(false);
    expect(isMorph(title('t', 0), scene('b', { pose: 'idea' }))).toBe(false);
    expect(isMorph(scene('a', { props: ['coins'] }), scene('b', { pose: 'idea' }))).toBe(false);
    expect(isMorph(scene('a', { pose: 'wave' }), scene('b', { props: ['coins'] }))).toBe(false);
    expect(isMorph(undefined, scene('b', { pose: 'idea' }))).toBe(false);
    expect(isMorph(scene('a', { pose: 'wave' }), undefined)).toBe(false);
  });

  it('propDelay staggers props, after the stickman when there is one', () => {
    expect([0, 1, 2].map((k) => propDelay({ type: 'scene', props: ['coins', 'clock', 'star'] }, k))).toEqual([0, 6, 12]);
    expect([0, 1].map((k) => propDelay({ type: 'scene', pose: 'explain', props: ['coins', 'clock'] }, k))).toEqual([6, 12]);
  });

  it('mainBefore: the main block a cue replaced, if it was still showing', () => {
    const a = scene('a', { pose: 'wave' });
    const b = { ...scene('b', { pose: 'idea' }), atWord: 4 };
    const gone = { ...scene('g', { pose: 'sad' }), atWord: 8, untilWord: 9 };
    const c = { ...scene('c', { pose: 'shrug' }), atWord: 12 };
    const s = sticker('s', 6);
    const cues = [b, s, a, gone, c];
    expect(mainBefore(cues, words, b)?.id).toBe('a');
    expect(mainBefore(cues, words, a)).toBeUndefined();
    expect(mainBefore(cues, words, gone)?.id).toBe('b');
    expect(mainBefore(cues, words, c)).toBeUndefined(); // g ended at word 9, before c started
  });
});
