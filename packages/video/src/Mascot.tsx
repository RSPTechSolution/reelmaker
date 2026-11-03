import React from 'react';
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
    case 'thinking':
      return <path d={`M${cx - 14} ${cy + 2} l26 -5`} {...stroke} />;
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

/** Built-in robot mascot: round head, face screen with dot eyes, signature, stubby arms. */
export const Mascot: React.FC<MascotProps> = ({ config, expression, open, blink = false, width = MASCOT_W }) => (
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
