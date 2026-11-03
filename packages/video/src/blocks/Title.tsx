import React from 'react';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { Pop, type BlockProps } from './common.tsx';

type TitleBlock = Extract<Block, { type: 'title' }>;

export const Title: React.FC<BlockProps<TitleBlock>> = ({ block, brand, start }) => {
  const size = fitText(block.text, BLOCK_SLOT.w, 120, 48);
  return (
    <Pop start={start}>
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1, color: brand.text, textAlign: 'center' }}>
        {block.text}
      </div>
      <div style={{ margin: '28px auto 0', width: 160, height: 14, borderRadius: 7, background: brand.accent }} />
    </Pop>
  );
};
