import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ThemeId, type ReelProps, type ThemeId as Theme } from '@reelmaker/shared';
import demo from '../../fixtures/demo-props.json';

// Remotion's hooks need its runtime; the reel itself is plain React, so render it at a chosen frame.
const at = vi.hoisted(() => ({ frame: 30 }));
vi.mock('remotion', async (importOriginal) => {
  const real = await importOriginal<typeof import('remotion')>();
  const Pass: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
  return {
    ...real,
    useCurrentFrame: () => at.frame,
    useVideoConfig: () => ({ fps: 30, durationInFrames: 400, width: 1080, height: 1920, id: 'Reel' }),
    delayRender: () => 0,
    continueRender: () => {},
    Audio: () => null,
    Sequence: Pass,
    Img: (p: { src: string; style?: React.CSSProperties }) => <img src={p.src} style={p.style} />,
    AbsoluteFill: ({ style, children }: { style?: React.CSSProperties; children?: React.ReactNode }) => (
      <div data-fill="" style={style}>
        {children}
      </div>
    ),
  };
});

const { Reel } = await import('../Reel.tsx');

const props = (theme?: Theme, patch: Partial<ReelProps> = {}): ReelProps => {
  const p = structuredClone(demo) as ReelProps;
  if (theme) p.reel.theme = theme;
  return { ...p, debugSafeZones: false, ...patch };
};
const html = (p: ReelProps, frame = 30) => {
  at.frame = frame;
  return renderToStaticMarkup(<Reel {...p} />);
};

describe('themed reel', () => {
  it('classic reel renders as before', () => {
    const p = props();
    const out = html(p);
    expect(out).toContain(`background:${p.brand.bg}`);
    expect(out).not.toContain('data-caption-plate');
    expect(out).not.toContain('data-stickman-presenter');
  });

  it('every theme renders a frame', () => {
    for (const id of ThemeId.options) {
      for (const frame of [0, 30, 120, 390]) expect(() => html(props(id), frame), `${id} @${frame}`).not.toThrow();
      expect(html(props(id))).toContain(`data-theme="${id}"`);
    }
  });

  it('stickman themes present with the stickman even when the owner uses My character', () => {
    const mascot = { ...demo.mascot, kind: 'image' as const, images: { happy: '/character/me-happy.png' } };
    const own = html(props('classic', { mascot } as Partial<ReelProps>));
    expect(own).toContain('me-happy.png');
    for (const id of ['stickman', 'chalkboard', 'notebook'] as const) {
      const out = html(props(id, { mascot } as Partial<ReelProps>));
      expect(out, id).not.toContain('me-happy.png');
      expect(out, id).toContain('data-stickman-presenter');
    }
  });

  it('bold has no presenter', () => {
    const out = html(props('bold'));
    expect(out).not.toContain('data-mascot');
    expect(out).not.toContain('data-stickman-presenter');
    expect(html(props('neon'))).toContain('data-mascot');
  });

  it('plate themes draw a caption plate', () => {
    // frame 30 is inside the first caption chunk of the demo
    expect(html(props('neon'))).toContain('data-caption-plate');
    expect(html(props('stickman'))).not.toContain('data-caption-plate');
  });

  it('themes load their own fonts', () => {
    expect(html(props('comic'))).toContain('Bangers');
    expect(html(props('neon'))).toContain('Orbitron');
  });
});
