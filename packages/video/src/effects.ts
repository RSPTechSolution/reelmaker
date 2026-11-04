import {
  audioSettings,
  effectSettings,
  FPS,
  splitWords,
  wordFrame,
  type Anim,
  type EffectSettings,
  type Line,
  type Reel,
  type SfxName,
  type WordTiming,
} from '@reelmaker/shared';
import { countFrom } from './blocks/BigNumber.tsx';
import { cueStartFrame } from './cues.ts';
import { END_CARD_FRAMES } from './EndCard.tsx';

export const TRANSITION_FRAMES = 10;
const FALLBACK_WPS = 2.3;
const MIN_SFX_GAP = 6;
const COUNT_FRAMES = 24;

const isMain = (t: string) => t === 'title' || t === 'card' || t === 'bigNumber' || t === 'list';
const norm = (w: string) => w.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '');

/** Frame each script line starts at (its first word). */
export function lineStartFrames(lines: Pick<Line, 'caption' | 'mood'>[], words: WordTiming[]) {
  let first = 0;
  return lines.map((l) => {
    const start = wordFrame(words, first, first / FALLBACK_WPS);
    first += splitWords(l.caption).length;
    return { mood: l.mood, start };
  });
}

// ---------- sound effects ----------

export type SfxEvent = { frame: number; sound: SfxName; volume: number };
const LEVEL: Record<SfxName, number> = { whoosh: 0.7, pop: 0.8, ding: 0.7, boom: 1, riser: 0.6 };

/** Which sound effect plays when: scene changes, numbers landing, stickers, shocked lines, end card. */
export function sfxEvents(reel: Reel, words: WordTiming[], total: number): SfxEvent[] {
  const audio = audioSettings(reel);
  if (!audio.sfx) return [];
  const raw: { frame: number; sound: SfxName }[] = [];
  const timed = reel.cues.map((c) => ({ c, start: cueStartFrame(c, words) })).sort((a, b) => a.start - b.start);
  let sawMain = false;
  for (const { c, start } of timed) {
    if (isMain(c.block.type)) {
      raw.push({ frame: start, sound: sawMain ? 'whoosh' : 'pop' });
      sawMain = true;
      if (c.block.type === 'bigNumber') {
        const counts = countFrom(c.block.to) !== c.block.to;
        raw.push({ frame: start + (counts ? COUNT_FRAMES : 4), sound: 'ding' });
      }
    } else if (c.block.type === 'sticker') {
      raw.push({ frame: start, sound: 'pop' });
    }
  }
  for (const l of lineStartFrames(reel.lines, words)) if (l.mood === 'shocked') raw.push({ frame: l.start, sound: 'boom' });
  raw.push({ frame: Math.max(0, total - END_CARD_FRAMES), sound: 'whoosh' });

  const out: SfxEvent[] = [];
  for (const e of raw.sort((a, b) => a.frame - b.frame)) {
    if (out.length && e.frame - out[out.length - 1].frame < MIN_SFX_GAP) continue;
    out.push({ ...e, volume: LEVEL[e.sound] * audio.sfxVolume });
  }
  return out;
}

// ---------- music ----------

const FADE_IN = 20;
const FADE_OUT = 45;
const DUCK = 0.65;
const DUCK_WINDOW = 6;

/** Music volume at a frame: fades in/out and dips while the voice is speaking. */
export function musicVolume(frame: number, loudness: number[], base: number, total: number): number {
  const fade = Math.min(1, frame / FADE_IN, Math.max(0, (total - 1 - frame) / FADE_OUT));
  let sum = 0;
  let n = 0;
  for (let f = frame - DUCK_WINDOW; f <= frame + DUCK_WINDOW; f++) {
    if (f >= 0 && f < loudness.length) {
      sum += loudness[f];
      n++;
    }
  }
  const voice = n ? Math.min(1, sum / n / 0.25) : 0;
  return Math.max(0, base * (1 - DUCK * voice) * fade);
}

// ---------- entrances and transitions ----------

type Style = { opacity: number; transform: string };
const REST: Style = { opacity: 1, transform: 'none' };

/** Style of a block entering, at spring progress p (0 → 1). */
export function entrance(anim: Anim | undefined, p: number): Style {
  if (p >= 1) return REST;
  const q = Math.max(0, p);
  switch (anim) {
    case 'slide':
      return { opacity: Math.min(1, q * 2), transform: `translateX(${(1 - q) * 140}px)` };
    case 'zoom':
      return { opacity: q, transform: `scale(${+(1.35 - 0.35 * q).toFixed(4)})` };
    case 'bounce':
      return { opacity: Math.min(1, q * 3), transform: `translateY(-${((1 - q) * 180).toFixed(2)}px)` };
    case 'typewriter':
      return { opacity: 1, transform: 'none' }; // the text itself types in (see Title)
    default:
      return { opacity: Math.min(1, q * 1.5), transform: `scale(${+(0.6 + 0.4 * q).toFixed(4)})` };
  }
}

/** Old and new main block during a scene change, at t (0 → 1) through the overlap. */
export function transitionStyles(kind: EffectSettings['transition'], t: number): { out: Style; in: Style } {
  const k = Math.max(0, Math.min(1, t));
  switch (kind) {
    case 'slide':
      return {
        out: { opacity: 1 - k, transform: `translateX(-${(k * 110).toFixed(1)}%)` },
        in: { opacity: Math.min(1, k * 2), transform: `translateX(${((1 - k) * 110).toFixed(1)}%)` },
      };
    case 'whip':
      return {
        out: { opacity: 1 - k, transform: `translateX(-${(k * 160).toFixed(1)}%) skewX(${(-14 * k).toFixed(1)}deg)` },
        in: { opacity: Math.min(1, k * 2), transform: `translateX(${((1 - k) * 160).toFixed(1)}%) skewX(${(14 * (1 - k)).toFixed(1)}deg)` },
      };
    case 'zoom':
      return {
        out: { opacity: 1 - k, transform: `scale(${(1 + 0.5 * k).toFixed(3)})` },
        in: { opacity: k, transform: `scale(${(0.7 + 0.3 * k).toFixed(3)})` },
      };
    default:
      return { out: { opacity: 0, transform: 'none' }, in: REST };
  }
}

// ---------- kinetic captions ----------

/** Motion of the word being spoken, `since` frames after it started. */
export function wordKinetics(style: EffectSettings['captions'], since: number): { scale: number; y: number } {
  if (style === 'color' || since < 0) return { scale: 1, y: 0 };
  if (style === 'pop') return { scale: 1 + 0.18 * Math.exp(-since / 4), y: 0 };
  if (since >= 8) return { scale: 1, y: 0 };
  return { scale: 1, y: -14 * Math.sin((Math.PI * since) / 8) };
}

// ---------- emotion effects ----------

/** Frames where the screen shakes (shocked lines), confetti bursts (excited lines) and keywords punch in. */
export function emotionMoments(reel: Reel, words: WordTiming[]) {
  if (!effectSettings(reel).emotion) return { shake: [], confetti: [], punch: [] };
  const starts = lineStartFrames(reel.lines, words);
  const keys = new Set(reel.keywords.map(norm));
  return {
    shake: starts.filter((l) => l.mood === 'shocked').map((l) => l.start),
    confetti: starts.filter((l) => l.mood === 'excited').map((l) => l.start),
    punch: words.filter((w) => keys.has(norm(w.caption))).map((w) => Math.round(w.start * FPS)),
  };
}

const SHAKE_FRAMES = 14;
const PUNCH_FRAMES = 10;
export const CONFETTI_FRAMES = 45;

export function shakeOffset(frame: number, start: number): { x: number; y: number } {
  const d = frame - start;
  if (d < 0 || d >= SHAKE_FRAMES) return { x: 0, y: 0 };
  const amp = 10 * (1 - d / SHAKE_FRAMES); // ≤ 10 px: barely touches the safe-zone margins
  return { x: amp * Math.sin(d * 2.7), y: amp * 0.6 * Math.cos(d * 3.3) };
}

export function punchScale(frame: number, start: number): number {
  const d = frame - start;
  return d < 0 || d >= PUNCH_FRAMES ? 1 : 1 + 0.03 * (1 - d / PUNCH_FRAMES); // edges move ≤ ~14 px
}

export type ConfettiPiece = { x: number; delay: number; fall: number; drift: number; size: number; spin: number; color: number };

/** Same pieces for the same seed, so a render always looks the same. */
export function confettiPieces(seed: number, n = 28): ConfettiPiece[] {
  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, () => ({
    x: 80 + rnd() * 920,
    delay: Math.floor(rnd() * 8),
    fall: 900 + rnd() * 700,
    drift: (rnd() - 0.5) * 220,
    size: 14 + rnd() * 16,
    spin: (rnd() - 0.5) * 900,
    color: Math.floor(rnd() * 4),
  }));
}
