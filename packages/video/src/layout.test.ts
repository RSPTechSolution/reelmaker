import { describe, expect, it } from 'vitest';
import { SAFE, WIDTH, HEIGHT } from '@reelmaker/shared';
import { BLOCK_SLOT, CAPTION_BAND, fitText, MASCOT_BOX } from './layout.ts';

describe('fitText', () => {
  it('fitText shrinks long text', () => {
    const text = 'x'.repeat(10) + ' ' + 'Yeh ek bahut lamba card title hai jo kabhi fit nahi hoga bina shrink '.slice(0, 69);
    expect(text).toHaveLength(80);
    const size = fitText(text, 900, 96);
    expect(size).toBeLessThan(96);
    expect(size).toBeGreaterThanOrEqual(36);
    // the chosen size really fits in 3 lines by the same width estimate
    expect(Math.ceil((text.trim().length * 0.55 * size) / 900)).toBeLessThanOrEqual(3);
  });

  it('fitText keeps short text at max', () => {
    expect(fitText('AI se video', 900, 96)).toBe(96);
  });

  it('never goes below the minimum', () => {
    expect(fitText('a'.repeat(2000), 900, 96)).toBe(36);
    expect(fitText('a'.repeat(2000), 900, 96, 50)).toBe(50);
  });

  it('fitText with a wider charWidth picks a smaller size', () => {
    const text = 'Paisa bachane ke 3 tareeke jo kaam karte hain';
    const narrow = fitText(text, 900, 96, 36, 2, 0.45);
    const normal = fitText(text, 900, 96, 36, 2);
    const wide = fitText(text, 900, 96, 36, 2, 0.7);
    expect(normal).toBe(fitText(text, 900, 96, 36, 2, 0.55));
    expect(wide).toBeLessThan(normal);
    expect(narrow).toBeGreaterThanOrEqual(normal);
    expect(Math.ceil((text.length * 0.7 * wide) / 900)).toBeLessThanOrEqual(2);
  });

  it('shrinks until the longest single word fits one line', () => {
    const size = fitText('Supercalifragilisticexpialidocious', 900, 96);
    expect(size).toBeLessThan(96);
    expect(34 * 0.55 * size).toBeLessThanOrEqual(900);
  });
});

describe('layout boxes stay inside the safe box', () => {
  const inside = (b: { x: number; y: number; w: number; h: number }) => {
    expect(b.x).toBeGreaterThanOrEqual(SAFE.left);
    expect(b.y).toBeGreaterThanOrEqual(SAFE.top);
    expect(b.x + b.w).toBeLessThanOrEqual(WIDTH - SAFE.right);
    expect(b.y + b.h).toBeLessThanOrEqual(HEIGHT - SAFE.bottom);
  };
  it.each([
    ['block slot', BLOCK_SLOT],
    ['caption band', CAPTION_BAND],
    ['mascot', MASCOT_BOX],
  ])('%s', (_, box) => inside(box));

  it('mascot is 360 px wide at the bottom-left of the safe box', () => {
    expect(MASCOT_BOX.w).toBe(360);
    expect(MASCOT_BOX.x).toBe(SAFE.left);
    expect(MASCOT_BOX.y + MASCOT_BOX.h).toBe(HEIGHT - SAFE.bottom);
  });

  it('block slot is the top half of the safe box', () => {
    expect(BLOCK_SLOT.y).toBe(SAFE.top);
    expect(BLOCK_SLOT.h).toBe((HEIGHT - SAFE.top - SAFE.bottom) / 2);
  });
});
