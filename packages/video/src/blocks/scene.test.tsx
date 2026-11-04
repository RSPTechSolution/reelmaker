import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { defaultBrand, type Block, type ThemeId } from '@reelmaker/shared';
import { resolveTheme } from '../themes/registry.ts';

const at = vi.hoisted(() => ({ frame: 0 }));
vi.mock('remotion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('remotion')>()),
  useCurrentFrame: () => at.frame,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 300, width: 1080, height: 1920, id: 'Reel' }),
}));
const { Scene } = await import('./Scene.tsx');

type SceneBlock = Extract<Block, { type: 'scene' }>;
const START = 100;
function html(block: SceneBlock, since: number, theme: ThemeId = 'stickman', extra: { fromPose?: SceneBlock['pose'] } = {}) {
  at.frame = START + since;
  const t = resolveTheme(theme, defaultBrand);
  return renderToStaticMarkup(<Scene block={block} brand={t.brand} theme={t} start={START} {...extra} />);
}
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('Scene', () => {
  it('scene renders pose, props and text', () => {
    const out = html({ type: 'scene', pose: 'thinking', props: ['coins', 'clock'], text: 'Paisa ya time?' }, 40);
    expect(out).toContain('data-scene-pose="thinking"');
    expect(count(out, 'data-prop=')).toBe(2);
    expect(out).toContain('Paisa ya time?');
  });

  it('scene props are staggered', () => {
    const block: SceneBlock = { type: 'scene', props: ['coins', 'rocket'] };
    expect(count(html(block, 3), 'data-prop=')).toBe(1);
    expect(count(html(block, 10), 'data-prop=')).toBe(2);
    // with a stickman, the first object waits for it
    expect(count(html({ ...block, pose: 'explain' }, 3), 'data-prop=')).toBe(0);
  });

  it('props alone are the hero, text alone is a big heading', () => {
    expect(html({ type: 'scene', props: ['trophy'] }, 40)).not.toContain('data-scene-pose');
    const text = html({ type: 'scene', text: 'Sirf 5 minute' }, 40);
    expect(text).toContain('Sirf 5 minute');
    expect(text).not.toContain('<svg');
  });

  it('the stickman draws itself on, unless it carries on from the previous scene', () => {
    const block: SceneBlock = { type: 'scene', pose: 'idea' };
    expect(html(block, 0)).toContain('stroke-dashoffset="1"');
    expect(html(block, 0, 'stickman', { fromPose: 'thinking' })).not.toContain('stroke-dashoffset="1"');
  });

  it('bold scene shows text, not drawings', () => {
    const out = html({ type: 'scene', pose: 'celebrate', props: ['trophy'], text: 'Jeet gaye!' }, 40, 'bold');
    expect(out).toContain('Jeet gaye!');
    expect(out).not.toContain('<svg');
    expect(html({ type: 'scene', pose: 'celebrate' }, 40, 'bold')).toBe('');
  });
});
