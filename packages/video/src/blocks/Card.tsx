import React from 'react';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { headingStyle } from '../themes/style.ts';
import { Surface } from '../themes/Surface.tsx';
import { Pop, type BlockProps } from './common.tsx';

type CardBlock = Extract<Block, { type: 'card' }>;
const PAD = 56;

export const Card: React.FC<BlockProps<CardBlock>> = ({ block, brand, theme, start, anim, skipEntrance }) => {
  const inner = BLOCK_SLOT.w - PAD * 2;
  const titleSize = fitText(block.title, inner, 88, 44, 2, theme.charWidth);
  const bodySize = block.body ? fitText(block.body, inner, 54, 32, 3, theme.charWidth) : 0;
  return (
    <Pop start={start} anim={anim} skip={skipEntrance} style={{ width: BLOCK_SLOT.w }}>
      <Surface theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18 }}>
        {block.icon ? <div style={{ fontSize: 110, lineHeight: 1 }}>{block.icon}</div> : null}
        <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.1, color: brand.text, ...headingStyle(theme) }}>
          {block.title}
        </div>
        {block.body ? (
          <div style={{ fontSize: bodySize, fontWeight: 600, lineHeight: 1.25, color: brand.text, opacity: theme.surface === 'type' ? 1 : 0.72 }}>
            {block.body}
          </div>
        ) : null}
        </div>
      </Surface>
    </Pop>
  );
};
