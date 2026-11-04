import React from 'react';
import type { Prop } from '@reelmaker/shared';
import type { InkStyle } from '../themes/types.ts';
import { Inked, Shape, Stroke, strokeProps } from './ink.tsx';
import { propMotion } from './motion.ts';

/** Drawing box of every prop (viewBox units). */
export const PROP_BOX = 200;

type Draw = (ink: InkStyle, since: number, progress: number) => React.ReactNode;
const fillOf = (ink: InkStyle) => (ink.fill === 'none' ? 'none' : ink.fill);
const thin = (ink: InkStyle) => Math.max(3, ink.width * 0.6);
const Label: React.FC<{ x: number; y: number; size: number; color: string; children: string }> = ({ x, y, size, color, children }) => (
  <text x={x} y={y} fontSize={size} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill={color}>
    {children}
  </text>
);
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

const DRAW: Record<Prop, Draw> = {
  phone: (ink, _s, p) => (
    <>
      <Shape d="M66 18 h68 q16 0 16 16 v132 q0 16 -16 16 h-68 q-16 0 -16 -16 v-132 q0 -16 16 -16 z" ink={ink} />
      <path d="M62 40 h76 v112 h-76 z" fill={ink.accent} opacity={0.35} />
      <Stroke d="M88 162 h24" ink={ink} />
      <circle cx={146} cy={26} r={14 * p} fill={ink.accent} />
    </>
  ),
  coins: (ink) => (
    <>
      <Shape d="M40 150 a48 16 0 1 0 96 0 a48 16 0 1 0 -96 0" ink={ink} fill={ink.accent} />
      <Shape d="M40 132 a48 16 0 1 0 96 0 a48 16 0 1 0 -96 0" ink={ink} fill={ink.accent} />
      <Shape d={circle(120, 86, 52)} ink={ink} />
      <Label x={120} y={88} size={60} color={ink.stroke}>
        ₹
      </Label>
    </>
  ),
  rocket: (ink, since) => (
    <>
      <path d={`M88 150 q12 ${30 + 8 * Math.sin(since / 1.5)} 24 0 z`} fill={ink.accent} />
      <Shape d="M100 14 q40 40 26 136 h-52 q-14 -96 26 -136 z" ink={ink} />
      <Shape d="M74 112 l-24 40 l28 -8 z M126 112 l24 40 l-28 -8 z" ink={ink} fill={ink.accent} />
      <Shape d={circle(100, 72, 15)} ink={ink} fill={ink.accent} />
    </>
  ),
  chartUp: (ink, _s, p) => (
    <>
      <Stroke d="M30 20 v150 h150" ink={ink} />
      <Stroke d="M40 150 l38 -40 l30 22 l58 -84" ink={ink} progress={p} color={ink.accent} width={ink.width * 1.3} />
      {p > 0.9 ? <Stroke d="M140 46 l26 2 l-2 26" ink={ink} color={ink.accent} width={ink.width * 1.3} /> : null}
    </>
  ),
  chartDown: (ink, _s, p) => (
    <>
      <Stroke d="M30 20 v150 h150" ink={ink} />
      <Stroke d="M40 50 l38 40 l30 -22 l58 84" ink={ink} progress={p} color={ink.accent} width={ink.width * 1.3} />
      {p > 0.9 ? <Stroke d="M140 154 l26 -2 l-2 -26" ink={ink} color={ink.accent} width={ink.width * 1.3} /> : null}
    </>
  ),
  clock: (ink, since) => {
    const m = (since * 14) % 360;
    const h = (since * 1.2) % 360;
    return (
      <>
        <Shape d={circle(100, 100, 74)} ink={ink} />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M100 36 v12" transform={`rotate(${a} 100 100)`} {...strokeProps(ink, 1, thin(ink))} />
        ))}
        <path d="M100 100 v-48" transform={`rotate(${m} 100 100)`} {...strokeProps(ink)} stroke={ink.accent} />
        <path d="M100 100 v-30" transform={`rotate(${h} 100 100)`} {...strokeProps(ink)} />
        <circle cx={100} cy={100} r={6} fill={ink.stroke} />
      </>
    );
  },
  bulb: (ink, _s, p) => (
    <>
      <circle cx={100} cy={80} r={68} fill={ink.accent} opacity={0.25 * p} />
      <Shape d="M100 22 a56 56 0 0 1 32 102 v18 h-64 v-18 a56 56 0 0 1 32 -102 z" ink={ink} fill={p > 0.5 ? ink.accent : fillOf(ink)} />
      <Stroke d="M72 156 h56 M78 172 h44" ink={ink} />
      {p > 0.8 ? <Stroke d="M30 60 l-16 -6 M170 60 l16 -6 M100 8 v-4" ink={ink} color={ink.accent} /> : null}
    </>
  ),
  heart: (ink) => <Shape d="M100 170 C30 120 20 80 40 52 C62 22 96 36 100 62 C104 36 138 22 160 52 C180 80 170 120 100 170 Z" ink={ink} fill={ink.accent} />,
  lock: (ink, _s, p) => (
    <>
      <path d="M64 96 v-26 a36 36 0 0 1 72 0 v26" transform={`translate(0 ${-(1 - p) * 26})`} {...strokeProps(ink, 1, ink.width * 1.4)} />
      <Shape d="M44 92 h112 v86 h-112 z" ink={ink} fill={ink.accent} />
      <Shape d={circle(100, 128, 10)} ink={ink} fill={ink.stroke} />
      <Stroke d="M100 136 v18" ink={ink} />
    </>
  ),
  moneyBag: (ink) => (
    <>
      <Shape d="M78 44 q-60 50 -46 104 q8 30 68 30 q60 0 68 -30 q14 -54 -46 -104 z" ink={ink} />
      <Shape d="M74 26 q26 18 52 0 l-12 22 h-28 z" ink={ink} fill={ink.accent} />
      <Label x={100} y={122} size={64} color={ink.accent}>
        ₹
      </Label>
    </>
  ),
  trophy: (ink) => (
    <>
      <Stroke d="M54 46 q-34 0 -30 30 q6 30 40 30 M146 46 q34 0 30 30 q-6 30 -40 30" ink={ink} />
      <Shape d="M52 26 h96 v40 q0 56 -48 64 q-48 -8 -48 -64 z" ink={ink} fill={ink.accent} />
      <Stroke d="M100 130 v24" ink={ink} />
      <Shape d="M64 154 h72 v22 h-72 z" ink={ink} />
    </>
  ),
  warning: (ink) => (
    <>
      <Shape d="M100 20 L182 168 H18 Z" ink={ink} fill={ink.accent} />
      <Stroke d="M100 70 v50" ink={ink} width={ink.width * 1.6} />
      <circle cx={100} cy={144} r={8} fill={ink.stroke} />
    </>
  ),
  gift: (ink, _s, p) => {
    const jump = -30 * Math.sin(Math.PI * p);
    return (
      <>
        <Shape d="M36 90 h128 v88 h-128 z" ink={ink} />
        <path d="M90 90 h20 v88 h-20 z" fill={ink.accent} />
        <g transform={`translate(0 ${jump})`}>
          <Shape d="M28 64 h144 v28 h-144 z" ink={ink} fill={ink.accent} />
          <Stroke d="M100 64 q-30 -40 -44 -16 q-6 14 44 16 q30 -40 44 -16 q6 14 -44 16" ink={ink} />
        </g>
      </>
    );
  },
  camera: (ink, _s, p) => (
    <>
      <Shape d="M24 62 h40 l14 -20 h44 l14 20 h40 v104 h-152 z" ink={ink} />
      <Shape d={circle(100, 112, 36)} ink={ink} fill={ink.accent} />
      <Shape d={circle(100, 112, 16)} ink={ink} fill={ink.stroke} />
      <circle cx={152} cy={82} r={7} fill={ink.accent} opacity={p} />
    </>
  ),
  laptop: (ink) => (
    <>
      <Shape d="M40 40 h120 v86 h-120 z" ink={ink} />
      <path d="M52 52 h96 v62 h-96 z" fill={ink.accent} opacity={0.75} />
      <Shape d="M18 140 h164 l-14 22 h-136 z" ink={ink} />
    </>
  ),
  book: (ink) => (
    <>
      <Shape d="M100 50 q-36 -22 -80 -10 v120 q44 -12 80 10 z" ink={ink} />
      <Shape d="M100 50 q36 -22 80 -10 v120 q-44 -12 -80 10 z" ink={ink} fill={ink.accent} />
      <Stroke d="M40 70 q24 -6 44 4 M40 96 q24 -6 44 4 M40 122 q24 -6 44 4" ink={ink} width={thin(ink)} />
    </>
  ),
  fire: (ink, since) => {
    const sway = Math.sin(since / 2.5) * 6;
    return (
      <>
        <Shape d={`M100 18 q${50 + sway} 50 50 96 a50 50 0 0 1 -100 0 q0 -36 26 -58 q4 30 20 34 q-12 -40 4 -72 z`} ink={ink} fill={ink.accent} />
        <Shape d={`M100 104 q${24 - sway / 2} 22 22 42 a22 22 0 0 1 -44 0 q0 -24 22 -42 z`} ink={ink} fill={fillOf(ink) === 'none' ? 'none' : '#FFE08A'} />
      </>
    );
  },
  star: (ink) => <Shape d="M100 16 L124 72 L184 76 L138 116 L152 176 L100 144 L48 176 L62 116 L16 76 L76 72 Z" ink={ink} fill={ink.accent} />,
  check: (ink, _s, p) => (
    <>
      <Shape d={circle(100, 100, 78)} ink={ink} />
      <Stroke d="M58 102 l30 30 l56 -62" ink={ink} progress={p} color={ink.accent} width={ink.width * 1.8} />
    </>
  ),
  cross: (ink, _s, p) => (
    <>
      <Shape d={circle(100, 100, 78)} ink={ink} />
      <Stroke d="M66 66 l68 68" ink={ink} progress={Math.min(1, p * 2)} color={ink.accent} width={ink.width * 1.8} />
      <Stroke d="M134 66 l-68 68" ink={ink} progress={Math.max(0, p * 2 - 1)} color={ink.accent} width={ink.width * 1.8} />
    </>
  ),
  calendar: (ink) => (
    <>
      <Shape d="M28 40 h144 v136 h-144 z" ink={ink} />
      <path d="M28 40 h144 v32 h-144 z" fill={ink.accent} />
      <Stroke d="M62 26 v26 M138 26 v26" ink={ink} />
      {[0, 1, 2, 3].flatMap((c) =>
        [0, 1, 2].map((r) => <circle key={`${c}-${r}`} cx={56 + c * 30} cy={98 + r * 26} r={6} fill={ink.stroke} />),
      )}
    </>
  ),
  chat: (ink, since) => (
    <>
      <Shape d="M30 30 h140 q14 0 14 14 v80 q0 14 -14 14 h-80 l-36 32 v-32 h-24 q-14 0 -14 -14 v-80 q0 -14 14 -14 z" ink={ink} />
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={70 + k * 30} cy={84 - 6 * Math.max(0, Math.sin(since / 3 - k))} r={9} fill={ink.accent} />
      ))}
    </>
  ),
  search: (ink) => (
    <>
      <Shape d={circle(84, 84, 52)} ink={ink} fill={ink.accent} />
      <Stroke d="M122 122 l50 50" ink={ink} width={ink.width * 2} />
      <Stroke d="M58 72 q10 -18 30 -20" ink={ink} width={thin(ink)} />
    </>
  ),
  target: (ink) => (
    <>
      <Shape d={circle(100, 100, 78)} ink={ink} />
      <Shape d={circle(100, 100, 52)} ink={ink} fill={ink.accent} />
      <Shape d={circle(100, 100, 24)} ink={ink} />
      <Stroke d="M100 100 l64 -64 M150 32 l16 2 l-2 16" ink={ink} />
    </>
  ),
};

/** One drawn object in a theme's ink, animated `since` frames after it appeared. Pure SVG. */
export const PropDrawing: React.FC<{ prop: Prop; ink: InkStyle; since: number; size?: number }> = ({ prop, ink, since, size = PROP_BOX }) => {
  const m = propMotion(prop, since);
  return (
    <svg
      data-prop={prop}
      width={size}
      height={size}
      viewBox={`0 0 ${PROP_BOX} ${PROP_BOX}`}
      style={{ overflow: 'visible', display: 'block', opacity: m.opacity }}
    >
      <g transform={`translate(${m.x} ${m.y}) translate(100 100) rotate(${m.rotate}) scale(${m.scale}) translate(-100 -100)`}>
        <Inked ink={ink}>{DRAW[prop](ink, since, m.progress)}</Inked>
      </g>
    </svg>
  );
};
