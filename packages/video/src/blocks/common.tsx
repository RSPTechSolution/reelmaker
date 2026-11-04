import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Anim, Brand } from '@reelmaker/shared';
import { entrance } from '../effects.ts';

export type BlockProps<B> = {
  block: B;
  brand: Brand;
  /** frame the block appeared */
  start: number;
  /** entrance style (pop when unset) */
  anim?: Anim;
  /** a scene transition is bringing this block in, so it starts at rest */
  skipEntrance?: boolean;
};

/** 0→1 spring that starts at `start`; drives every block entrance. Bounce overshoots more. */
export function usePop(start: number, delay = 0, anim?: Anim): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = anim === 'bounce' ? { damping: 8, stiffness: 170, mass: 0.9 } : { damping: 13, stiffness: 160, mass: 0.8 };
  return spring({ frame: frame - start - delay, fps, config });
}

export const Pop: React.FC<{
  start: number;
  anim?: Anim;
  skip?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ start, anim, skip, children, style }) => {
  const p = usePop(start, 0, anim);
  return <div style={{ ...entrance(anim, skip ? 1 : p), ...style }}>{children}</div>;
};
