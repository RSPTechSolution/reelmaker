import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Brand } from '@reelmaker/shared';

export type BlockProps<B> = { block: B; brand: Brand; /** frame the block appeared */ start: number };

/** 0→1 spring that starts at `start`; used for the pop-in of every block. */
export function usePop(start: number, delay = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start - delay, fps, config: { damping: 13, stiffness: 160, mass: 0.8 } });
}

export const Pop: React.FC<{ start: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  start,
  children,
  style,
}) => {
  const p = usePop(start);
  return (
    <div style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5), ...style }}>{children}</div>
  );
};
