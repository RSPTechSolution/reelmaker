import { HEIGHT, SAFE, WIDTH } from '@reelmaker/shared';

export type Box = { x: number; y: number; w: number; h: number };

/** Everything visible (text, mascot) stays inside this box. */
export const SAFE_BOX: Box = {
  x: SAFE.left,
  y: SAFE.top,
  w: WIDTH - SAFE.left - SAFE.right,
  h: HEIGHT - SAFE.top - SAFE.bottom,
};

/** Blocks: top half of the safe box. */
export const BLOCK_SLOT: Box = { x: SAFE_BOX.x, y: SAFE_BOX.y, w: SAFE_BOX.w, h: SAFE_BOX.h / 2 };

export const MASCOT_W = 360;
export const MASCOT_H = 400;
/** Mascot: bottom-left corner of the safe box. */
export const MASCOT_BOX: Box = {
  x: SAFE_BOX.x,
  y: SAFE_BOX.y + SAFE_BOX.h - MASCOT_H,
  w: MASCOT_W,
  h: MASCOT_H,
};

const GAP = 30;
/** Karaoke captions: between the block slot and the mascot, full safe width. */
export const CAPTION_BAND: Box = {
  x: SAFE_BOX.x,
  y: BLOCK_SLOT.y + BLOCK_SLOT.h + GAP,
  w: SAFE_BOX.w,
  h: MASCOT_BOX.y - GAP - (BLOCK_SLOT.y + BLOCK_SLOT.h + GAP),
};

/** Average glyph width as a fraction of font size (rough, errs on the wide side for Baloo 2). */
const CHAR_W = 0.55;

/**
 * Largest font size (≤ maxFontPx, ≥ minFontPx) at which `text` fits `maxWidth` in at most
 * `maxLines` lines, using width ≈ chars × 0.55 × font. The longest word must fit on one line.
 */
export function fitText(text: string, maxWidth: number, maxFontPx: number, minFontPx = 36, maxLines = 3): number {
  const chars = text.trim().length;
  const longest = Math.max(0, ...text.split(/\s+/).map((w) => w.length));
  const fits = (size: number) =>
    Math.ceil((chars * CHAR_W * size) / maxWidth) <= maxLines && longest * CHAR_W * size <= maxWidth;
  for (let size = maxFontPx; size > minFontPx; size -= 2) {
    if (fits(size)) return size;
  }
  return minFontPx;
}
