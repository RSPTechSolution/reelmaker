import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultBrand, Expression, Pose, ThemeId } from '@reelmaker/shared';
import { resolveTheme } from '../themes/registry.ts';
import { blendPose, boil, BOX_H, BOX_W, EXPRESSION_POSE, POSES, poseAt, type Skeleton } from './skeleton.ts';
import { Stickman } from './Stickman.tsx';

const MARGIN = 10;
const inks = ThemeId.options.map((id) => resolveTheme(id, defaultBrand).ink);
const distance = (a: Skeleton, b: Skeleton) =>
  Object.keys(a).reduce((sum, j) => {
    const k = j as keyof Skeleton;
    return sum + Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y);
  }, 0);

describe('stickman skeleton', () => {
  it('every pose stays inside the drawing box', () => {
    expect([BOX_W, BOX_H]).toEqual([300, 400]);
    for (const pose of Pose.options) {
      for (let f = 0; f <= 60; f++) {
        for (const [joint, p] of Object.entries(poseAt(pose, f))) {
          const where = `${pose} ${joint} @${f}: ${p.x},${p.y}`;
          expect(p.x >= MARGIN && p.x <= BOX_W - MARGIN, where).toBe(true);
          expect(p.y >= MARGIN && p.y <= BOX_H - MARGIN, where).toBe(true);
        }
      }
    }
  });

  it('poses are distinct', () => {
    const poses = Pose.options;
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        expect(distance(POSES[poses[i]], POSES[poses[j]]), `${poses[i]} vs ${poses[j]}`).toBeGreaterThan(20);
      }
    }
  });

  it('idle motions move the figure', () => {
    expect(distance(poseAt('running', 3), poseAt('running', 9))).toBeGreaterThan(40);
    expect(poseAt('celebrate', 7).hip.y).toBeLessThan(poseAt('celebrate', 0).hip.y);
    expect(poseAt('wave', 3).rHand.x).not.toBeCloseTo(poseAt('wave', 0).rHand.x, 0);
  });

  it('blendPose endpoints', () => {
    const a = POSES.thinking;
    const b = POSES.celebrate;
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    expect(blendPose(a, b, -1)).toEqual(a);
    expect(blendPose(a, b, 2)).toEqual(b);
    const mid = blendPose(a, b, 0.5);
    for (const j of Object.keys(a) as (keyof Skeleton)[]) {
      expect(mid[j].x).toBeGreaterThanOrEqual(Math.min(a[j].x, b[j].x));
      expect(mid[j].x).toBeLessThanOrEqual(Math.max(a[j].x, b[j].x));
      expect(mid[j].y).toBeGreaterThanOrEqual(Math.min(a[j].y, b[j].y));
      expect(mid[j].y).toBeLessThanOrEqual(Math.max(a[j].y, b[j].y));
    }
  });

  it('boil is deterministic and bounded', () => {
    const s = POSES.explain;
    expect(boil(s, 9, 2)).toEqual(boil(s, 9, 2));
    expect(boil(s, 8, 2)).toEqual(boil(s, 11, 2)); // same 4-frame step
    expect(boil(s, 11, 2)).not.toEqual(boil(s, 12, 2));
    expect(boil(s, 5, 0)).toEqual(s);
    for (const j of Object.keys(s) as (keyof Skeleton)[]) {
      const b = boil(s, 13, 2)[j];
      expect(Math.abs(b.x - s[j].x)).toBeLessThanOrEqual(2);
      expect(Math.abs(b.y - s[j].y)).toBeLessThanOrEqual(2);
    }
  });

  it('every face has a body pose', () => {
    expect(Object.keys(EXPRESSION_POSE).sort()).toEqual([...Expression.options].sort());
    expect(EXPRESSION_POSE).toMatchObject({ happy: 'wave', thinking: 'thinking', excited: 'celebrate', sad: 'sad', wink: 'pointing' });
  });
});

describe('Stickman', () => {
  it('Stickman renders every pose in every theme ink', () => {
    for (const ink of inks) {
      for (const pose of Pose.options) {
        const html = renderToStaticMarkup(<Stickman skeleton={poseAt(pose, 10)} ink={ink} pose={pose} face="happy" />);
        expect(html.startsWith('<svg'), pose).toBe(true);
      }
    }
  });

  it('every face renders, blinking and talking', () => {
    for (const face of Expression.options) {
      const html = renderToStaticMarkup(<Stickman skeleton={POSES.explain} ink={inks[1]} face={face} mouthOpen={0.8} blink />);
      expect(html).toContain('data-face');
    }
  });

  it('draw-on hides lines at progress 0', () => {
    const marker = resolveTheme('stickman', defaultBrand).ink;
    expect(marker.drawOn).toBe(true);
    expect(renderToStaticMarkup(<Stickman skeleton={POSES.explain} ink={marker} drawProgress={0} />)).toContain('stroke-dashoffset="1"');
    expect(renderToStaticMarkup(<Stickman skeleton={POSES.explain} ink={marker} drawProgress={1} />)).not.toContain(
      'stroke-dashoffset="1"',
    );
  });

  it('pose extras: laptop, question bubble and idea bulb', () => {
    const ink = inks[1];
    expect(renderToStaticMarkup(<Stickman skeleton={POSES.laptop} ink={ink} pose="laptop" />)).toContain('data-extra="laptop"');
    expect(renderToStaticMarkup(<Stickman skeleton={POSES.thinking} ink={ink} pose="thinking" />)).toContain('data-extra="question"');
    expect(renderToStaticMarkup(<Stickman skeleton={POSES.idea} ink={ink} pose="idea" />)).toContain('data-extra="bulb"');
  });
});
