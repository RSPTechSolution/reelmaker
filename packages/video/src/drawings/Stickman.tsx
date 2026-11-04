import React from 'react';
import type { Expression, Pose } from '@reelmaker/shared';
import type { InkStyle } from '../themes/types.ts';
import { Inked, Shape, Stroke, strokeProps } from './ink.tsx';
import { BOX_H, BOX_W, HEAD_R, type Point, type Skeleton } from './skeleton.ts';

const line = (...pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const circle = (c: Point, r: number) =>
  `M${(c.x - r).toFixed(1)} ${c.y.toFixed(1)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
/** Part of the draw-on: 0 before `from`, 1 after `from + len`. */
const part = (p: number, from: number, len: number) => Math.max(0, Math.min(1, (p - from) / len));

function Face({ head, face, open, blink, ink }: { head: Point; face: Expression; open: number; blink: boolean; ink: InkStyle }) {
  const w = Math.max(3, ink.width * 0.6);
  const s = { ...strokeProps(ink, 1, w) };
  const dot = (x: number, y: number, r = 4) => <circle cx={x} cy={y} r={r} fill={ink.stroke} />;
  const { x, y } = head;
  const ex = 12;
  const ey = y - 6;
  let eyes: React.ReactNode;
  if (blink) {
    eyes = <path d={`M${x - ex - 5} ${ey} h10 M${x + ex - 5} ${ey} h10`} {...s} />;
  } else {
    switch (face) {
      case 'thinking':
        eyes = (
          <>
            {dot(x - ex + 3, ey - 3)}
            {dot(x + ex + 3, ey - 3)}
          </>
        );
        break;
      case 'surprised':
      case 'shocked':
        eyes = (
          <>
            <circle cx={x - ex} cy={ey} r={face === 'shocked' ? 7 : 6} {...s} />
            <circle cx={x + ex} cy={ey} r={face === 'shocked' ? 7 : 6} {...s} />
          </>
        );
        break;
      case 'wink':
        eyes = (
          <>
            {dot(x - ex, ey)}
            <path d={`M${x + ex - 6} ${ey + 1} q6 -6 12 0`} {...s} />
          </>
        );
        break;
      case 'laughing':
        eyes = <path d={`M${x - ex - 6} ${ey + 2} l6 -6 l6 6 M${x + ex - 6} ${ey + 2} l6 -6 l6 6`} {...s} />;
        break;
      case 'excited':
        eyes = (
          <>
            {dot(x - ex, ey, 5.5)}
            {dot(x + ex, ey, 5.5)}
          </>
        );
        break;
      default:
        eyes = (
          <>
            {dot(x - ex, ey)}
            {dot(x + ex, ey)}
          </>
        );
    }
  }
  const my = y + 12;
  let mouth: React.ReactNode;
  if (open > 0.15 && face !== 'shocked' && face !== 'surprised') {
    mouth = <ellipse cx={x} cy={my} rx={8} ry={2 + 8 * Math.min(1, open)} {...s} />;
  } else {
    switch (face) {
      case 'sad':
        mouth = <path d={`M${x - 10} ${my + 4} q10 -9 20 0`} {...s} />;
        break;
      case 'thinking':
        mouth = <path d={`M${x - 4} ${my} h12`} {...s} />;
        break;
      case 'surprised':
        mouth = <circle cx={x} cy={my + 2} r={5} {...s} />;
        break;
      case 'shocked':
        mouth = <ellipse cx={x} cy={my + 3} rx={6} ry={9} {...s} />;
        break;
      case 'excited':
      case 'laughing':
        mouth = <path d={`M${x - 12} ${my - 2} h24 q-12 18 -24 0 z`} {...s} fill={ink.stroke} />;
        break;
      default:
        mouth = <path d={`M${x - 11} ${my - 2} q11 11 22 0`} {...s} />;
    }
  }
  return (
    <g data-face={face}>
      {eyes}
      {mouth}
    </g>
  );
}

function Extra({ pose, s, ink, progress }: { pose?: Pose; s: Skeleton; ink: InkStyle; progress: number }) {
  const accent = ink.accent;
  if (pose === 'laptop') {
    const mx = (s.lHand.x + s.rHand.x) / 2;
    const my = Math.max(s.lHand.y, s.rHand.y) + 4;
    const screen = `M${mx - 34} ${my - 6} V${my - 50} H${mx + 34} V${my - 6} Z`;
    const glass = `M${mx - 26} ${my - 13} V${my - 43} H${mx + 26} V${my - 13} Z`;
    return (
      <g data-extra="laptop">
        <Shape d={screen} ink={ink} fill={ink.fill === 'none' ? 'none' : ink.fill} progress={progress} />
        <path d={glass} fill={accent} opacity={0.85 * progress} />
        <Stroke d={`M${mx - 46} ${my} L${mx - 36} ${my - 6} H${mx + 36} L${mx + 46} ${my} Z`} ink={ink} progress={progress} />
      </g>
    );
  }
  if (pose === 'thinking') {
    return (
      <text
        data-extra="question"
        x={s.head.x + HEAD_R + 12}
        y={s.head.y - HEAD_R + 6}
        fontSize={52}
        fontWeight={800}
        fill={accent}
        opacity={progress}
      >
        ?
      </text>
    );
  }
  if (pose === 'idea') {
    const c = { x: s.head.x, y: s.head.y - HEAD_R - 26 };
    return (
      <g data-extra="bulb" opacity={progress}>
        <circle cx={c.x} cy={c.y} r={14} {...strokeProps(ink, 1, Math.max(3, ink.width * 0.6))} fill={accent} />
        <path
          d={`M${c.x - 24} ${c.y} h-8 M${c.x + 24} ${c.y} h8 M${c.x - 17} ${c.y - 17} l-6 -6 M${c.x + 17} ${c.y - 17} l6 -6`}
          {...strokeProps(ink, 1, Math.max(3, ink.width * 0.6))}
        />
      </g>
    );
  }
  return null;
}

/**
 * A stickman in a theme's ink. Pure SVG (no Remotion hooks): the caller passes the skeleton for
 * this frame (poseAt / blendPose / boil). drawProgress 0→1 draws it on when the ink draws on.
 */
export const Stickman: React.FC<{
  skeleton: Skeleton;
  ink: InkStyle;
  pose?: Pose;
  face?: Expression;
  mouthOpen?: number;
  blink?: boolean;
  drawProgress?: number;
  width?: number;
}> = ({ skeleton: s, ink, pose, face = 'happy', mouthOpen = 0, blink = false, drawProgress = 1, width = BOX_W }) => {
  const p = ink.drawOn ? drawProgress : 1;
  const headFill = ink.fill === 'none' ? 'none' : ink.fill;
  return (
    <svg
      width={width}
      height={(width * BOX_H) / BOX_W}
      viewBox={`0 0 ${BOX_W} ${BOX_H}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <Inked ink={ink}>
        <Stroke d={line(s.neck, s.hip)} ink={ink} progress={part(p, 0.15, 0.25)} />
        <Stroke d={line(s.neck, s.lElbow, s.lHand)} ink={ink} progress={part(p, 0.35, 0.3)} />
        <Stroke d={line(s.neck, s.rElbow, s.rHand)} ink={ink} progress={part(p, 0.35, 0.3)} />
        <Stroke d={line(s.hip, s.lKnee, s.lFoot)} ink={ink} progress={part(p, 0.55, 0.3)} />
        <Stroke d={line(s.hip, s.rKnee, s.rFoot)} ink={ink} progress={part(p, 0.55, 0.3)} />
        {headFill !== 'none' ? <circle cx={s.head.x} cy={s.head.y} r={HEAD_R} fill={headFill} opacity={part(p, 0, 0.2)} /> : null}
        <Stroke d={circle(s.head, HEAD_R)} ink={ink} progress={part(p, 0, 0.2)} />
        {p > 0.6 ? <Face head={s.head} face={face} open={mouthOpen} blink={blink} ink={ink} /> : null}
        <Extra pose={pose} s={s} ink={ink} progress={part(p, 0.7, 0.3)} />
      </Inked>
    </svg>
  );
};
