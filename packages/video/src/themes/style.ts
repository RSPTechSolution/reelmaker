import type React from 'react';
import type { ResolvedTheme } from './types.ts';

/** CSS font stack for a theme font (Baloo 2 if the font did not load). */
export const fontStack = (family: string) => `'${family}', 'Baloo 2', sans-serif`;

/** Heading text style: theme heading font, uppercase and glow where the theme wants them. */
export function headingStyle(theme: ResolvedTheme): React.CSSProperties {
  return {
    fontFamily: fontStack(theme.headingFont),
    ...(theme.uppercase ? { textTransform: 'uppercase', letterSpacing: '0.02em' } : {}),
    ...(theme.textGlow ? { textShadow: theme.textGlow } : {}),
  };
}

/** Deterministic pseudo-random numbers in [0, 1) (no Math.random at render time). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
