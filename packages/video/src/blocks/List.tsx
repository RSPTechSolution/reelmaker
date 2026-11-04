import React from 'react';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { headingStyle } from '../themes/style.ts';
import { usePop, type BlockProps } from './common.tsx';

type ListBlock = Extract<Block, { type: 'list' }>;
const STAGGER = 6;
const BULLET = 36;

const Item: React.FC<{
  text: string;
  index: number;
  start: number;
  size: number;
  color: string;
  bullet: string;
  font: React.CSSProperties;
}> = ({
  text,
  index,
  start,
  size,
  color,
  bullet,
  font,
}) => {
  const p = usePop(start, index * STAGGER);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        opacity: Math.min(1, p * 1.5),
        transform: `translateX(${(1 - p) * -60}px)`,
      }}
    >
      <div style={{ width: BULLET, height: BULLET, borderRadius: BULLET / 2, background: bullet, flexShrink: 0 }} />
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.15, color, ...font }}>{text}</div>
    </div>
  );
};

export const List: React.FC<BlockProps<ListBlock>> = ({ block, brand, theme, start }) => {
  const longest = block.items.reduce((a, b) => (b.length > a.length ? b : a), '');
  const maxBySlot = Math.floor(BLOCK_SLOT.h / (block.items.length * 1.5));
  const size = Math.min(fitText(longest, BLOCK_SLOT.w - BULLET - 28, 76, 36, 1, theme.charWidth), maxBySlot);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.35, width: BLOCK_SLOT.w }}>
      {block.items.map((item, i) => (
        <Item
          key={i}
          text={item}
          index={i}
          start={start}
          size={size}
          color={theme.onBg.text}
          bullet={theme.id === 'classic' ? brand.accent2 : theme.onBg.accent}
          font={headingStyle(theme)}
        />
      ))}
    </div>
  );
};
