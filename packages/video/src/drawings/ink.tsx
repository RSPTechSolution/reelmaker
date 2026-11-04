import React from 'react';
import type { InkStyle } from '../themes/types.ts';

export type StrokeAttrs = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: string;
  pathLength?: number;
  strokeDasharray?: number;
  strokeDashoffset?: number;
};

/** Stroke attributes for a line in this ink; with drawOn, `progress` 0→1 draws the line on. */
export function strokeProps(ink: InkStyle, progress = 1, width = ink.width): StrokeAttrs {
  const base = {
    stroke: ink.stroke,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  if (!ink.drawOn || progress >= 1) return base;
  const p = Math.max(0, progress);
  return { ...base, pathLength: 1, strokeDasharray: 1, strokeDashoffset: +(1 - p).toFixed(3) };
}

/** A line (or outline) in the theme's ink. */
export const Stroke: React.FC<{ d: string; ink: InkStyle; progress?: number; width?: number; color?: string }> = ({
  d,
  ink,
  progress = 1,
  width,
  color,
}) => <path d={d} {...strokeProps(ink, progress, width)} {...(color ? { stroke: color } : {})} />;

/** A filled shape with an ink outline; ink.fill 'none' leaves it hollow (marker, chalk, neon). */
export const Shape: React.FC<{ d: string; ink: InkStyle; fill?: string; progress?: number }> = ({ d, ink, fill, progress = 1 }) => {
  const colour = fill ?? (ink.fill === 'none' ? 'none' : ink.fill);
  return (
    <>
      {colour !== 'none' ? <path d={d} fill={colour} opacity={ink.drawOn ? Math.max(0, Math.min(1, progress * 1.5 - 0.5)) : 1} /> : null}
      <Stroke d={d} ink={ink} progress={progress} />
    </>
  );
};

/** Wraps a drawing with the theme's static glow (neon) or offset paper shadow. */
export const Inked: React.FC<{ ink: InkStyle; children: React.ReactNode }> = ({ ink, children }) => (
  <g
    style={
      ink.glow
        ? { filter: `drop-shadow(0 0 8px ${ink.glow})` }
        : ink.shadow
          ? { filter: `drop-shadow(7px 8px 0 ${ink.shadow})` }
          : undefined
    }
  >
    {children}
  </g>
);
