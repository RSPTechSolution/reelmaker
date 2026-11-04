import { getAvailableFonts } from '@remotion/google-fonts';
import { describe, expect, it } from 'vitest';
import { defaultBrand, ThemeId, type Brand } from '@reelmaker/shared';
import { contrastRatio } from './contrast.ts';
import { resolveTheme } from './registry.ts';

const brand: Brand = { ...defaultBrand, handle: '@owner' };
const all = ThemeId.options.map((id) => resolveTheme(id, brand));

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('theme registry', () => {
  it('classic is the brand unchanged', () => {
    const t = resolveTheme('classic', brand);
    expect(t.brand).toEqual(brand);
    expect(t.headingFont).toBe(brand.font);
    expect(t.bodyFont).toBe(brand.font);
    expect(t.charWidth).toBe(0.55);
    expect(t.caption.upcoming).toBe('#9A9A9A');
    expect(t.caption.spoken).toBe(brand.text);
    expect(t.caption.keyword).toBe(brand.accent);
    expect(t.caption.plate).toBe(false);
    expect(t).toMatchObject({ background: 'brand', surface: 'brand', sticker: 'pill', presenter: 'mascot' });
  });

  it('every theme resolves and keeps the owner handle', () => {
    for (const t of all) {
      expect(t.brand.handle, t.id).toBe('@owner');
      expect(t.brand.font, t.id).toBe(t.bodyFont);
      expect(t.confetti.length, t.id).toBeGreaterThan(1);
    }
  });

  it('caption colours are readable in every theme except classic', () => {
    for (const t of all.filter((x) => x.id !== 'classic')) {
      const { backdrop, spoken, keyword, upcoming } = t.caption;
      expect(contrastRatio(spoken, backdrop), `${t.id} spoken`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(keyword, backdrop), `${t.id} keyword`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(upcoming, backdrop), `${t.id} upcoming`).toBeGreaterThanOrEqual(3);
    }
  });

  it('titles and numbers drawn on the background are readable', () => {
    for (const t of all) {
      expect(contrastRatio(t.onBg.text, t.brand.bg), `${t.id} text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.onBg.accent, t.brand.bg), `${t.id} accent`).toBeGreaterThanOrEqual(3);
    }
    expect(resolveTheme('classic', brand).onBg).toEqual({ text: brand.text, accent: brand.accent });
  });

  it('busy backgrounds get a caption plate', () => {
    for (const id of ['comic', 'neon', 'paper', 'bollywood'] as const) expect(resolveTheme(id, brand).caption.plate, id).toBe(true);
  });

  it('theme fonts exist in Google Fonts', () => {
    const fonts = new Set(getAvailableFonts().map((f) => f.fontFamily));
    for (const t of all.filter((x) => x.id !== 'classic')) {
      expect(fonts.has(t.headingFont), `${t.id} ${t.headingFont}`).toBe(true);
      expect(fonts.has(t.bodyFont), `${t.id} ${t.bodyFont}`).toBe(true);
    }
  });

  it('themes look different', () => {
    const looks = new Set(all.map((t) => `${t.background}|${t.surface}|${t.headingFont}`));
    expect(looks.size).toBe(all.length);
  });

  it('presenters', () => {
    const presenter = Object.fromEntries(all.map((t) => [t.id, t.presenter]));
    expect(presenter).toMatchObject({ stickman: 'stickman', chalkboard: 'stickman', notebook: 'stickman', bold: 'none', neon: 'mascot' });
  });
});
