import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { Pop, type BlockProps } from './common.tsx';

type BigNumberBlock = Extract<Block, { type: 'bigNumber' }>;
const COUNT_FRAMES = 24;
const COUNT_UP_ABOVE = 10;

/** Where the count-up starts: small numbers ("Step 1", "3 tips") just pop in at their value. */
export function countFrom(to: number): number {
  return Math.abs(to) > COUNT_UP_ABOVE ? 0 : to;
}

function format(value: number, target: number): string {
  const decimals = Number.isInteger(target) ? 0 : Math.min(2, (String(target).split('.')[1] ?? '').length);
  return value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export const BigNumber: React.FC<BlockProps<BigNumberBlock>> = ({ block, brand, start, anim, skipEntrance }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame - start, [0, COUNT_FRAMES], [countFrom(block.to), block.to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const full = `${block.prefix ?? ''}${format(block.to, block.to)}${block.suffix ?? ''}`;
  // size from the final text so the number does not grow while counting
  const numberSize = fitText(full, BLOCK_SLOT.w, 300, 72, 1);
  return (
    <Pop start={start} anim={anim} skip={skipEntrance}>
      <div
        style={{
          fontSize: numberSize,
          fontWeight: 800,
          lineHeight: 1,
          color: brand.accent,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {block.prefix ? <span style={{ fontSize: '0.45em', color: brand.text }}>{block.prefix}</span> : null}
        {format(value, block.to)}
        {block.suffix ? <span style={{ fontSize: '0.45em', color: brand.text }}>{block.suffix}</span> : null}
      </div>
    </Pop>
  );
};
