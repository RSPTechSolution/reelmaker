import React from 'react';
import { Img } from 'remotion';
import type { Expression, MascotConfig } from '@reelmaker/shared';
import { MASCOT_H, MASCOT_W } from './layout.ts';

export type MascotProps = {
  config: MascotConfig;
  expression: Expression;
  /** Mouth opening 0–1 (from loudness). */
  open: number;
  blink?: boolean;
  width?: number;
};

const SCREEN = '#14161A';
const EYE_L = { x: 146, y: 158 };
const EYE_R = { x: 214, y: 158 };

function Eyes({ expression, blink, color }: { expression: Expression; blink: boolean; color: string }) {
  if (blink) {
    return (
      <g fill={color}>
        <rect x={EYE_L.x - 14} y={EYE_L.y - 3} width={28} height={6} rx={3} />
        <rect x={EYE_R.x - 14} y={EYE_R.y - 3} width={28} height={6} rx={3} />
      </g>
    );
  }
  const stroke = { stroke: color, strokeWidth: 7, strokeLinecap: 'round' as const, fill: 'none' };
  switch (expression) {
    case 'surprised':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={17} fill={color} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={17} fill={color} />
          <path d={`M${EYE_L.x - 18} ${EYE_L.y - 34} q18 -12 36 0`} {...stroke} />
          <path d={`M${EYE_R.x - 18} ${EYE_R.y - 34} q18 -12 36 0`} {...stroke} />
        </g>
      );
    case 'thinking':
      return (
        <g>
          <circle cx={EYE_L.x + 4} cy={EYE_L.y - 6} r={12} fill={color} />
          <circle cx={EYE_R.x + 4} cy={EYE_R.y - 6} r={12} fill={color} />
          <path d={`M${EYE_R.x - 16} ${EYE_R.y - 34} l32 -8`} {...stroke} />
          <path d={`M${EYE_L.x - 16} ${EYE_L.y - 28} l30 0`} {...stroke} />
        </g>
      );
    case 'wink':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={13} fill={color} />
          <path d={`M${EYE_R.x - 16} ${EYE_R.y + 4} q16 -18 32 0`} {...stroke} />
        </g>
      );
    case 'excited':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={17} fill={color} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={17} fill={color} />
          <circle cx={EYE_L.x + 6} cy={EYE_L.y - 6} r={5} fill={SCREEN} />
          <circle cx={EYE_R.x + 6} cy={EYE_R.y - 6} r={5} fill={SCREEN} />
          <path d={`M${EYE_L.x - 16} ${EYE_L.y - 30} q16 -14 32 -4`} {...stroke} />
          <path d={`M${EYE_R.x - 16} ${EYE_R.y - 34} q16 -10 32 4`} {...stroke} />
        </g>
      );
    case 'laughing':
      // eyes squeezed shut into happy arcs
      return (
        <g>
          <path d={`M${EYE_L.x - 16} ${EYE_L.y + 4} q16 -20 32 0`} {...stroke} />
          <path d={`M${EYE_R.x - 16} ${EYE_R.y + 4} q16 -20 32 0`} {...stroke} />
        </g>
      );
    case 'shocked':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={18} fill="none" stroke={color} strokeWidth={6} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={18} fill="none" stroke={color} strokeWidth={6} />
          <circle cx={EYE_L.x} cy={EYE_L.y} r={6} fill={color} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={6} fill={color} />
          <path d={`M${EYE_L.x - 16} ${EYE_L.y - 38} l30 -6`} {...stroke} />
          <path d={`M${EYE_R.x - 14} ${EYE_R.y - 44} l30 6`} {...stroke} />
        </g>
      );
    case 'sad':
      return (
        <g>
          <circle cx={EYE_L.x} cy={EYE_L.y + 6} r={11} fill={color} />
          <circle cx={EYE_R.x} cy={EYE_R.y + 6} r={11} fill={color} />
          <path d={`M${EYE_L.x - 16} ${EYE_L.y - 18} l30 -10`} {...stroke} />
          <path d={`M${EYE_R.x - 14} ${EYE_R.y - 28} l30 10`} {...stroke} />
        </g>
      );
    default:
      return (
        <g fill={color}>
          <circle cx={EYE_L.x} cy={EYE_L.y} r={13} />
          <circle cx={EYE_R.x} cy={EYE_R.y} r={13} />
        </g>
      );
  }
}

function Mouth({ expression, open, color }: { expression: Expression; open: number; color: string }) {
  const cx = 180;
  const cy = 196;
  if (open > 0.08) {
    // talking: an oval that opens with loudness
    return <ellipse cx={cx} cy={cy} rx={16 + open * 8} ry={4 + open * 16} fill={color} />;
  }
  const stroke = { stroke: color, strokeWidth: 7, strokeLinecap: 'round' as const, fill: 'none' };
  switch (expression) {
    case 'surprised':
      return <ellipse cx={cx} cy={cy} rx={11} ry={13} fill={color} />;
    case 'shocked':
      return <ellipse cx={cx} cy={cy + 2} rx={13} ry={17} fill={color} />;
    case 'thinking':
      return <path d={`M${cx - 14} ${cy + 2} l26 -5`} {...stroke} />;
    case 'excited':
    case 'laughing':
      // wide open grin
      return <path d={`M${cx - 26} ${cy - 8} h52 q0 26 -26 26 q-26 0 -26 -26 z`} fill={color} />;
    case 'sad':
      return <path d={`M${cx - 20} ${cy + 8} q20 -16 40 0`} {...stroke} />;
    default:
      return <path d={`M${cx - 22} ${cy - 6} q22 20 44 0`} {...stroke} />;
  }
}

function Signature({ config }: { config: MascotConfig }) {
  switch (config.signature) {
    case 'glasses':
      return (
        <g stroke={config.accent} strokeWidth={6} fill="none">
          <rect x={EYE_L.x - 28} y={EYE_L.y - 24} width={56} height={46} rx={14} />
          <rect x={EYE_R.x - 28} y={EYE_R.y - 24} width={56} height={46} rx={14} />
          <path d={`M${EYE_L.x + 28} ${EYE_L.y - 4} h${EYE_R.x - EYE_L.x - 56}`} />
        </g>
      );
    case 'cap':
      return (
        <g fill={config.accent}>
          <path d="M92 108 Q180 20 268 108 Z" />
          <rect x={180} y={96} width={110} height={18} rx={9} />
          <circle cx={180} cy={42} r={9} />
        </g>
      );
    default:
      return (
        <g>
          <line x1={180} y1={58} x2={180} y2={22} stroke={config.body} strokeWidth={8} strokeLinecap="round" />
          <circle cx={180} cy={18} r={20} fill={config.accent} opacity={0.35} />
          <circle cx={180} cy={18} r={11} fill={config.accent} />
        </g>
      );
  }
}

// Small pose per expression for an image character (it has no drawable face).
const POSE: Record<Expression, { rotate: number; lift: number; scale: number }> = {
  happy: { rotate: 0, lift: 0, scale: 1 },
  thinking: { rotate: -5, lift: 0, scale: 1 },
  surprised: { rotate: 0, lift: -10, scale: 1.04 },
  wink: { rotate: 4, lift: 0, scale: 1 },
  excited: { rotate: -3, lift: -14, scale: 1.06 },
  laughing: { rotate: 6, lift: -4, scale: 1.03 },
  shocked: { rotate: 0, lift: -16, scale: 1.08 },
  sad: { rotate: 3, lift: 10, scale: 0.97 },
};

/** The owner's uploaded character: one image per expression (falls back to the happy one). */
function ImageCharacter({
  src,
  expression,
  open,
  width,
  html,
}: {
  src: string;
  expression: Expression;
  open: number;
  width: number;
  html: boolean;
}) {
  const pose = POSE[expression];
  // talking: stretch up and narrow slightly with loudness, like a bouncy puppet
  const sx = pose.scale * (1 - open * 0.04);
  const sy = pose.scale * (1 + open * 0.07);
  const style: React.CSSProperties = {
    width,
    height: (width * MASCOT_H) / MASCOT_W,
    objectFit: 'contain',
    objectPosition: 'center bottom',
    transformOrigin: '50% 100%',
    transform: `translateY(${pose.lift}px) rotate(${pose.rotate}deg) scale(${sx}, ${sy})`,
    display: 'block',
  };
  return html ? <img src={src} alt="" style={style} /> : <Img src={src} style={style} />;
}

/**
 * The mascot: the built-in robot (round head, face screen, signature, stubby arms), or the
 * owner's uploaded character when `config.kind === 'image'`. Pass `html` outside Remotion
 * (plain <img> instead of Remotion's <Img>, which holds the render until the image loads).
 */
export const Mascot: React.FC<MascotProps & { html?: boolean }> = ({
  config,
  expression,
  open,
  blink = false,
  width = MASCOT_W,
  html = false,
}) => {
  const image = config.kind === 'image' ? (config.images?.[expression] ?? config.images?.happy) : undefined;
  if (image) return <ImageCharacter src={image} expression={expression} open={open} width={width} html={html} />;
  return <Robot config={config} expression={expression} open={open} blink={blink} width={width} />;
};

const Robot: React.FC<MascotProps> = ({ config, expression, open, blink = false, width = MASCOT_W }) => (
  <svg
    width={width}
    height={(width * MASCOT_H) / MASCOT_W}
    viewBox={`0 0 ${MASCOT_W} ${MASCOT_H}`}
    style={{ overflow: 'visible', display: 'block' }}
  >
    {/* body */}
    <rect x={95} y={262} width={170} height={128} rx={48} fill={config.body} />
    <rect x={150} y={300} width={60} height={14} rx={7} fill={config.accent} opacity={0.9} />
    {/* head */}
    <circle cx={180} cy={165} r={108} fill={config.body} />
    <rect x={98} y={106} width={164} height={118} rx={44} fill={SCREEN} />
    <rect x={98} y={106} width={164} height={118} rx={44} fill="none" stroke={config.face} strokeWidth={4} opacity={0.5} />
    <Eyes expression={expression} blink={blink} color={config.face} />
    <Mouth expression={expression} open={open} color={config.face} />
    <Signature config={config} />
    {/* stubby arms in front of the body */}
    <rect x={62} y={290} width={52} height={82} rx={26} fill={config.body} stroke={SCREEN} strokeOpacity={0.12} strokeWidth={4} />
    <rect x={246} y={290} width={52} height={82} rx={26} fill={config.body} stroke={SCREEN} strokeOpacity={0.12} strokeWidth={4} />
  </svg>
);
