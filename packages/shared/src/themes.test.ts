import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POSE_MEANING, PROP_MEANING } from './drawings.ts';
import { effectSettings, effectsForTheme } from './effects.ts';
import { Cue, Pose, Prop, Reel, ThemeId } from './schema.ts';
import { reelTheme, THEME_INFO } from './themes.ts';
import { spokenHash } from './timing.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = (): Reel => JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'example-reel.json'), 'utf8'));
const withCue = (block: unknown) => ({ ...example(), cues: [{ id: 'c1', atWord: 0, block }] });
const issues = (r: ReturnType<typeof Reel.safeParse>) => (r.success ? '' : r.error.issues.map((i) => i.message).join('; '));

describe('reel theme', () => {
  it('old reels without theme are classic and still valid', () => {
    const r = Reel.parse(example());
    expect(r.theme).toBeUndefined();
    expect(reelTheme(r)).toBe('classic');
    expect(reelTheme({ theme: 'comic' })).toBe('comic');
  });

  it('unknown theme, pose or prop is rejected', () => {
    expect(Reel.safeParse({ ...example(), theme: 'disco' }).success).toBe(false);
    expect(Reel.safeParse(withCue({ type: 'scene', pose: 'dancing' })).success).toBe(false);
    expect(Reel.safeParse(withCue({ type: 'scene', props: ['money'] })).success).toBe(false);
  });

  it('spokenHash ignores theme', () => {
    const r = example();
    expect(spokenHash({ ...r, theme: 'neon' })).toBe(spokenHash(r));
  });
});

describe('scene block', () => {
  it('scene block accepts pose, props or text', () => {
    for (const block of [
      { type: 'scene', pose: 'thinking' },
      { type: 'scene', props: ['coins', 'rocket'] },
      { type: 'scene', text: 'Paisa bachao' },
    ]) {
      expect(Reel.safeParse(withCue(block)).success, JSON.stringify(block)).toBe(true);
      expect(Cue.safeParse({ id: 'c1', atWord: 0, block }).success).toBe(true);
    }
  });

  it('empty scene block is rejected', () => {
    for (const block of [{ type: 'scene' }, { type: 'scene', props: [] }, { type: 'scene', text: '  ' }]) {
      const r = Reel.safeParse(withCue(block));
      expect(r.success, JSON.stringify(block)).toBe(false);
      expect(issues(r)).toContain('scene needs a pose, a prop or text');
    }
  });

  it('scene block allows at most 3 props', () => {
    expect(Reel.safeParse(withCue({ type: 'scene', props: ['coins', 'rocket', 'clock', 'heart'] })).success).toBe(false);
  });
});

describe('theme and drawing tables', () => {
  it('THEME_INFO covers every ThemeId and every pose and prop has a meaning', () => {
    expect(Object.keys(THEME_INFO).sort()).toEqual([...ThemeId.options].sort());
    expect(Object.keys(POSE_MEANING).sort()).toEqual([...Pose.options].sort());
    expect(Object.keys(PROP_MEANING).sort()).toEqual([...Prop.options].sort());
    expect(ThemeId.options).toHaveLength(11);
    expect(Pose.options).toHaveLength(12);
    expect(Prop.options).toHaveLength(24);
    expect(THEME_INFO.classic).toMatchObject({ label: 'Classic', transition: 'slide', captions: 'pop', acts: false });
    const acting = ThemeId.options.filter((t) => THEME_INFO[t].acts).sort();
    expect(acting).toEqual(['chalkboard', 'notebook', 'objects', 'stickman']);
  });

  it('themes have different effect defaults', () => {
    const pairs = new Set(ThemeId.options.map((t) => `${THEME_INFO[t].transition}/${THEME_INFO[t].captions}`));
    expect(pairs.size).toBeGreaterThan(4);
  });
});

describe('theme effect defaults', () => {
  it('effectSettings falls back to the theme defaults', () => {
    const comic = THEME_INFO.comic;
    expect(effectSettings({ theme: 'comic' })).toEqual({ transition: comic.transition, captions: comic.captions, emotion: true });
    expect(effectSettings({})).toEqual({ transition: 'slide', captions: 'pop', emotion: true });
    const own = { transition: 'none', captions: 'color', emotion: false } as const;
    expect(effectSettings({ effects: own, theme: 'comic' })).toEqual(own);
  });

  it('effectsForTheme keeps emotion', () => {
    const news = THEME_INFO.news;
    expect(effectsForTheme({ transition: 'whip', captions: 'color', emotion: false }, 'news')).toEqual({
      transition: news.transition,
      captions: news.captions,
      emotion: false,
    });
    expect(effectsForTheme(undefined, 'news').emotion).toBe(true);
  });
});
