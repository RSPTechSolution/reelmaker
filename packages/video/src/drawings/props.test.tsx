import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultBrand, Prop, ThemeId } from '@reelmaker/shared';
import { resolveTheme } from '../themes/registry.ts';
import { IDLE_PROPS, propMotion, SETTLE_FRAMES } from './motion.ts';
import { PropDrawing } from './props.tsx';

const inks = ThemeId.options.map((id) => resolveTheme(id, defaultBrand).ink);

describe('prop motions', () => {
  it('motions settle by frame 30', () => {
    expect(SETTLE_FRAMES).toBe(30);
    for (const prop of Prop.options) {
      for (const f of [30, 41, 57, 90]) {
        const m = propMotion(prop, f);
        const where = `${prop} @${f}`;
        expect(Math.abs(m.x), where).toBeLessThanOrEqual(6);
        expect(Math.abs(m.y), where).toBeLessThanOrEqual(6);
        expect(Math.abs(m.scale - 1), where).toBeLessThanOrEqual(0.06);
        expect(Math.abs(m.rotate), where).toBeLessThanOrEqual(6);
        expect(m.opacity, where).toBe(1);
        expect(m.progress, where).toBe(1);
        if (!IDLE_PROPS.includes(prop)) expect(m, where).toEqual({ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, progress: 1 });
      }
    }
  });

  it('motions start hidden or small', () => {
    for (const prop of Prop.options) {
      const m = propMotion(prop, 0);
      expect(m.opacity < 0.5 || m.scale < 0.5 || m.progress === 0 || Math.abs(m.y) > 100, prop).toBe(true);
    }
  });

  it('coins fall from above and bounce', () => {
    expect(propMotion('coins', 0).y).toBeLessThan(-100);
    expect(propMotion('coins', 12).y).toBeCloseTo(0, 0);
    const after = [13, 14, 15, 16, 17, 18].map((f) => propMotion('coins', f).y);
    expect(Math.min(...after)).toBeLessThan(-8);
  });

  it('rocket rises', () => {
    const ys = [0, 2, 4, 6].map((f) => propMotion('rocket', f).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });

  it('charts and ticks draw themselves on', () => {
    for (const p of ['chartUp', 'chartDown', 'check', 'cross'] as const) {
      expect(propMotion(p, 0).progress, p).toBe(0);
      expect(propMotion(p, 6).progress, p).toBeGreaterThan(0);
      expect(propMotion(p, 6).progress, p).toBeLessThan(1);
    }
  });

  it('deterministic', () => {
    for (const prop of Prop.options) expect(propMotion(prop, 7)).toEqual(propMotion(prop, 7));
  });
});

describe('PropDrawing', () => {
  it('every prop renders in every ink', () => {
    for (const ink of inks) {
      for (const prop of Prop.options) {
        for (const since of [0, 8, 40]) {
          const html = renderToStaticMarkup(<PropDrawing prop={prop} ink={ink} since={since} />);
          expect(html.startsWith('<svg'), `${prop} @${since}`).toBe(true);
          expect(html, prop).toContain(`data-prop="${prop}"`);
        }
      }
    }
  });

  it('props look different from each other', () => {
    const ink = inks[1];
    const drawings = new Set(Prop.options.map((p) => renderToStaticMarkup(<PropDrawing prop={p} ink={ink} since={40} />).replace(/data-prop="[^"]+"/, '')));
    expect(drawings.size).toBe(Prop.options.length);
  });
});
