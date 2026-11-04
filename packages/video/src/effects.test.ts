import { describe, expect, it } from 'vitest';
import type { Reel, WordTiming } from '@reelmaker/shared';
import { activeCues } from './cues.ts';
import {
  confettiPieces,
  emotionMoments,
  entrance,
  musicVolume,
  punchScale,
  sfxEvents,
  shakeOffset,
  transitionStyles,
  TRANSITION_FRAMES,
  wordKinetics,
} from './effects.ts';

// 20 words; word k from k*0.5 s → starts at frame 15k
const words: WordTiming[] = Array.from({ length: 20 }, (_, i) => ({
  i,
  caption: i === 6 ? 'AI' : `w${i}`,
  spoken: `w${i}`,
  start: i * 0.5,
  end: i * 0.5 + 0.4,
  filled: false,
}));
const lines = [0, 1, 2, 3].map((k) => ({
  id: `l${k + 1}`,
  caption: 'a b c d e',
  spoken: 'a b c d e',
  ...(k === 1 ? { mood: 'shocked' as const } : k === 2 ? { mood: 'excited' as const } : {}),
}));
function reel(over: Partial<Reel> = {}): Reel {
  return {
    id: 'r',
    title: 't',
    topic: 't',
    targetSeconds: 30,
    lines,
    voice: { engine: 'kokoro', voiceId: 'hf_alpha', speed: 1 },
    cues: [
      { id: 'c1', atWord: 0, block: { type: 'title', text: 'T' } },
      { id: 'c2', atWord: 3, block: { type: 'bigNumber', to: 90, suffix: '%' } },
      { id: 'c3', atWord: 8, block: { type: 'sticker', text: 'Wow' } },
      { id: 'c4', atWord: 12, block: { type: 'card', title: 'C' } },
    ],
    keywords: ['AI'],
    hashes: {},
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}
const TOTAL = 400;

describe('sfxEvents', () => {
  it('fires effects on scene changes, numbers, stickers, shocked lines and the end card', () => {
    const ev = sfxEvents(reel(), words, TOTAL);
    expect(ev.map((e) => [e.frame, e.sound])).toEqual([
      [0, 'tick'], // first title
      [45, 'swipe'], // big number appears
      [69, 'ding'], // ... and lands after counting up
      [75, 'boom'], // shocked line starts (word 5)
      [120, 'bubble'], // sticker
      [180, 'swipe'], // card replaces the number
      [355, 'swipe'], // into the end card (last 45 frames)
    ]);
    // the scene-change swipe plays most often, so it sits a little lower than the rest
    const vol = Object.fromEntries(ev.map((e) => [e.sound, e.volume]));
    expect(vol.swipe).toBeLessThan(vol.tick);
    for (const e of ev) expect(e.volume).toBeGreaterThan(0);
  });

  it('keeps effects at least 6 frames apart and is empty when sound effects are off', () => {
    const crowded = reel({
      cues: [
        { id: 'a', atWord: 0, block: { type: 'title', text: 'T' } },
        { id: 'b', atWord: 0, block: { type: 'sticker', text: 'S' } },
      ],
    });
    const ev = sfxEvents(crowded, words, TOTAL);
    for (let k = 1; k < ev.length; k++) expect(ev[k].frame - ev[k - 1].frame).toBeGreaterThanOrEqual(6);
    expect(sfxEvents(reel({ audio: { sfx: false, sfxVolume: 0.6 } }), words, TOTAL)).toEqual([]);
  });

  it('scales with the reel sound-effect volume', () => {
    const loud = sfxEvents(reel({ audio: { sfx: true, sfxVolume: 1 } }), words, TOTAL)[0].volume;
    const quiet = sfxEvents(reel({ audio: { sfx: true, sfxVolume: 0.25 } }), words, TOTAL)[0].volume;
    expect(quiet).toBeCloseTo(loud / 4);
  });
});

describe('sfxEvents with scene blocks', () => {
  it('sfxEvents treats a scene block as a main block', () => {
    const ev = sfxEvents(
      reel({
        cues: [
          { id: 's1', atWord: 0, block: { type: 'scene', pose: 'wave' } },
          { id: 's2', atWord: 4, block: { type: 'scene', pose: 'thinking' } },
        ],
      }),
      words,
      TOTAL,
    );
    expect(ev.slice(0, 2).map((e) => [e.frame, e.sound])).toEqual([
      [0, 'tick'],
      [60, 'swipe'],
    ]);
  });

  it('coins, rockets and ticks pop with a bubble when they appear', () => {
    const ev = sfxEvents(
      reel({ cues: [{ id: 's1', atWord: 4, block: { type: 'scene', pose: 'explain', props: ['star', 'coins'] } }] }),
      words,
      TOTAL,
    );
    // scene at frame 60 (tick), star at +6 (no sound), coins at +12 (bubble); the shocked line's
    // boom at 75 is within 6 frames of the bubble, so it is dropped
    expect(ev.filter((e) => e.frame < 100).map((e) => [e.frame, e.sound])).toEqual([
      [60, 'tick'],
      [72, 'bubble'],
    ]);
  });
});

describe('musicVolume', () => {
  const silent = new Array(TOTAL).fill(0);
  const talking = silent.map((_, f) => (f >= 100 && f < 200 ? 0.8 : 0));
  it('fades in and out', () => {
    expect(musicVolume(0, silent, 0.4, TOTAL)).toBe(0);
    expect(musicVolume(60, silent, 0.4, TOTAL)).toBeCloseTo(0.4);
    expect(musicVolume(TOTAL - 1, silent, 0.4, TOTAL)).toBeLessThan(0.05);
  });
  it('ducks under the voice and comes back in the gaps', () => {
    const during = musicVolume(150, talking, 0.4, TOTAL);
    const gap = musicVolume(260, talking, 0.4, TOTAL);
    expect(during).toBeCloseTo(0.4 * 0.35, 2);
    expect(gap).toBeCloseTo(0.4);
  });
});

describe('entrance', () => {
  it('every style ends at rest and starts away from it', () => {
    for (const anim of ['pop', 'slide', 'zoom', 'bounce', 'typewriter'] as const) {
      expect(entrance(anim, 1), anim).toEqual({ opacity: 1, transform: 'none' });
    }
    expect(entrance('slide', 0).transform).toContain('translateX(');
    expect(entrance('zoom', 0).transform).toContain('scale(1.35)');
    expect(entrance('bounce', 0).transform).toContain('translateY(-');
    expect(entrance('pop', 0).opacity).toBe(0);
  });
});

describe('transitions', () => {
  it('old block leaves while the new one arrives', () => {
    const s = transitionStyles('slide', 0.5);
    expect(s.out.transform).toContain('translateX(-');
    expect(s.in.transform).toContain('translateX(');
    expect(transitionStyles('zoom', 1).out.opacity).toBe(0);
    expect(transitionStyles('none', 0.3).out.opacity).toBe(0);
  });
  it('activeCues reports the previous main block during the overlap only', () => {
    const cues = reel().cues;
    expect(activeCues(cues, words, 45 + 2).previous?.id).toBe('c1');
    expect(activeCues(cues, words, 45 + TRANSITION_FRAMES).previous).toBeUndefined();
    expect(activeCues(cues, words, 5).previous).toBeUndefined();
  });
});

describe('kinetic captions', () => {
  it('pop and bounce move the spoken word, then settle', () => {
    expect(wordKinetics('color', 0)).toEqual({ scale: 1, y: 0 });
    expect(wordKinetics('pop', 0).scale).toBeGreaterThan(1.1);
    expect(wordKinetics('pop', 30).scale).toBeCloseTo(1, 2);
    expect(wordKinetics('bounce', 4).y).toBeLessThan(-5);
    expect(wordKinetics('bounce', 12)).toEqual({ scale: 1, y: 0 });
  });
});

describe('emotion effects', () => {
  it('finds shake (shocked), confetti (excited) and punch (keyword) moments', () => {
    const m = emotionMoments(reel(), words);
    expect(m.shake).toEqual([75]);
    expect(m.confetti).toEqual([150]);
    expect(m.punch).toEqual([90]); // "AI" is word 6
    expect(emotionMoments(reel({ effects: { transition: 'slide', captions: 'pop', emotion: false } }), words)).toEqual({
      shake: [],
      confetti: [],
      punch: [],
    });
  });
  it('shake and punch decay to rest; confetti is the same every render', () => {
    expect(shakeOffset(70, 75)).toEqual({ x: 0, y: 0 });
    expect(Math.abs(shakeOffset(77, 75).x) + Math.abs(shakeOffset(77, 75).y)).toBeGreaterThan(1);
    expect(shakeOffset(75 + 20, 75)).toEqual({ x: 0, y: 0 });
    expect(punchScale(90, 90)).toBeGreaterThan(1.02);
    expect(punchScale(105, 90)).toBe(1);
    expect(confettiPieces(3)).toEqual(confettiPieces(3));
    expect(confettiPieces(3)).not.toEqual(confettiPieces(4));
    expect(confettiPieces(3)).toHaveLength(28);
  });
});
