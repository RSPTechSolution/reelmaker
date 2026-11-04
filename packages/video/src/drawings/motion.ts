import type { Prop } from '@reelmaker/shared';

export type PropMotion = { x: number; y: number; scale: number; rotate: number; opacity: number; progress: number };

/** By this many frames every prop is at rest (apart from its small idle loop). */
export const SETTLE_FRAMES = 30;
/** Props that keep moving a little after they settle (≤ 6 % scale, ≤ 6 px). */
export const IDLE_PROPS: Prop[] = ['heart', 'fire', 'coins', 'clock'];

const REST: PropMotion = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, progress: 1 };
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2);
/** 0→1 with a little overshoot. */
const backOut = (t: number) => {
  const k = clamp01(t);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const pop = (since: number, frames = 12): PropMotion => ({
  ...REST,
  scale: since >= frames ? 1 : backOut(since / frames),
  opacity: clamp01(since / (frames / 2)),
});
const round = (m: PropMotion): PropMotion => ({
  x: +m.x.toFixed(2),
  y: +m.y.toFixed(2),
  scale: +m.scale.toFixed(4),
  rotate: +m.rotate.toFixed(2),
  opacity: +m.opacity.toFixed(3),
  progress: +m.progress.toFixed(3),
});

/** How a prop moves `since` frames after it appeared. Pure function of the frame. */
export function propMotion(prop: Prop, since: number): PropMotion {
  const s = Math.max(0, since);
  const settled = s >= SETTLE_FRAMES;
  switch (prop) {
    case 'coins': {
      // fall in (0–12), one bounce (12–22), then a slow glint wobble
      if (s <= 12) return round({ ...REST, y: -160 * (1 - easeIn(s / 12)), opacity: clamp01(s / 3) });
      if (s < 22) return round({ ...REST, y: -26 * Math.sin((Math.PI * (s - 12)) / 10) });
      return round({ ...REST, rotate: settled ? Math.sin(s / 9) * 4 : 0 });
    }
    case 'rocket':
      return round(s >= 16 ? REST : { ...REST, y: 150 * (1 - easeOut(s / 16)), rotate: -8 * (1 - s / 16), opacity: clamp01(s / 4) });
    case 'chartUp':
    case 'chartDown':
    case 'check':
    case 'cross': {
      const frames = prop === 'check' || prop === 'cross' ? 12 : 18;
      return round({ ...REST, progress: easeOut(s / frames), opacity: clamp01(s / 2 + 0.5) });
    }
    case 'bulb': {
      // flickers on: off, half, dim, on
      const steps = [0, 0.7, 0.25, 0.9, 0.5, 1];
      const v = s >= 12 ? 1 : steps[Math.floor(s / 2)];
      return round({ ...pop(s, 8), progress: v }); // progress = how brightly it glows
    }
    case 'heart': {
      const beat = settled ? 0.05 * Math.max(0, Math.sin((2 * Math.PI * s) / 24)) : 0;
      return round(s < 12 ? pop(s) : { ...REST, scale: 1 + beat });
    }
    case 'fire': {
      const flicker = settled ? 0.04 * Math.sin(s / 2.2) : 0;
      return round(s < 12 ? pop(s) : { ...REST, scale: 1 + flicker, y: settled ? 3 * Math.sin(s / 3) : 0 });
    }
    case 'clock':
      // hands spin inside the drawing; the body only pops in
      return round(s < 12 ? pop(s) : REST);
    case 'lock':
      // drops in (0–8), then the shackle clicks shut (8–16)
      if (s < 8) return round({ ...REST, y: -60 * (1 - easeOut(s / 8)), opacity: clamp01(s / 4), progress: 0 });
      return round({ ...REST, progress: easeIn((s - 8) / 8) });
    case 'warning': {
      if (s < 10) return round(pop(s, 10));
      const flash = s < 22 && Math.floor((s - 10) / 3) % 2 === 0 ? 0.55 : 1;
      return round({ ...REST, opacity: flash });
    }
    case 'gift':
      // pops in, then the lid jumps (progress 0→1 drives the lid)
      return round(s < 12 ? { ...pop(s), progress: 0 } : { ...REST, progress: clamp01((s - 12) / 12) });
    case 'search': {
      if (s >= 18) return REST;
      const k = easeOut(s / 18);
      return round({ ...REST, x: -70 * (1 - k) + 18 * Math.sin(Math.PI * k), rotate: -15 * (1 - k), opacity: clamp01(s / 4) });
    }
    default:
      return round(s < 12 ? pop(s) : REST);
  }
}
