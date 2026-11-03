import React from 'react';
import type { Block } from '@reelmaker/shared';
import { WIDTH } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { usePop, type BlockProps } from './common.tsx';

type StickerBlock = Extract<Block, { type: 'sticker' }>;
export const STICKER_MAX_W = 420;

/** Overlay pill in the top-right corner of the block slot (inside the safe box). */
export const Sticker: React.FC<BlockProps<StickerBlock> & { index?: number }> = ({ block, brand, start, index = 0 }) => {
  const p = usePop(start);
  const size = fitText(block.text, STICKER_MAX_W - 64, 60, 32, 1);
  return (
    <div
      style={{
        position: 'absolute',
        top: BLOCK_SLOT.y + 16 + index * 110,
        right: WIDTH - (BLOCK_SLOT.x + BLOCK_SLOT.w) + 16,
        maxWidth: STICKER_MAX_W,
        padding: '14px 32px',
        borderRadius: 999,
        background: brand.accent2,
        color: '#FFFFFF',
        fontSize: size,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        boxShadow: '0 12px 30px rgba(20,22,26,0.18)',
        transform: `rotate(-7deg) scale(${0.4 + 0.6 * p})`,
        transformOrigin: 'center',
        opacity: Math.min(1, p * 1.5),
      }}
    >
      {block.text}
    </div>
  );
};
