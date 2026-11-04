import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Block } from '@reelmaker/shared';
import { WIDTH } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { contrastRatio } from '../themes/contrast.ts';
import { headingStyle } from '../themes/style.ts';
import { usePop, type BlockProps } from './common.tsx';

type StickerBlock = Extract<Block, { type: 'sticker' }>;
export const STICKER_MAX_W = 420;

/** Jagged comic burst drawn behind the sticker's own text (the agent's words stay). */
function Burst({ color }: { color: string }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 24;
    const r = i % 2 ? 0.36 : 0.5;
    return `${(50 + Math.cos(a) * r * 100).toFixed(1)},${(50 + Math.sin(a) * r * 60).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: '-38% -14%', width: '128%', height: '176%', overflow: 'visible' }}>
      <polygon points={pts} fill={color} stroke="#111111" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Overlay sticker in the top-right corner of the block slot (inside the safe box), in the theme's style. */
export const Sticker: React.FC<BlockProps<StickerBlock> & { index?: number }> = ({ block, brand, theme, start, index = 0 }) => {
  const frame = useCurrentFrame();
  const p = usePop(start);
  const size = fitText(block.text, STICKER_MAX_W - 64, 60, 32, 1, theme.charWidth);
  const pos: React.CSSProperties = {
    position: 'absolute',
    top: BLOCK_SLOT.y + 16 + index * 110,
    right: WIDTH - (BLOCK_SLOT.x + BLOCK_SLOT.w) + 16,
    maxWidth: STICKER_MAX_W,
    padding: '14px 32px',
    fontSize: size,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    transformOrigin: 'center',
    opacity: Math.min(1, p * 1.5),
    transform: `rotate(-7deg) scale(${0.4 + 0.6 * p})`,
    ...headingStyle(theme),
  };
  switch (theme.sticker) {
    case 'burst':
      return (
        <div style={{ ...pos, color: '#FFFFFF', WebkitTextStroke: '2px #111111', padding: '18px 40px' }}>
          <Burst color={brand.accent} />
          <span style={{ position: 'relative' }}>{block.text}</span>
        </div>
      );
    case 'tape':
      return (
        <div style={{ ...pos, background: 'rgba(255,228,92,0.85)', color: theme.onBg.text, transform: `rotate(-4deg) scale(${0.4 + 0.6 * p})`, boxShadow: '0 6px 14px rgba(0,0,0,0.12)' }}>
          {block.text}
        </div>
      );
    case 'neon':
      return (
        <div
          style={{
            ...pos,
            color: brand.accent2,
            border: `4px solid ${brand.accent2}`,
            borderRadius: 999,
            background: 'rgba(11,15,26,0.85)',
            textShadow: `0 0 14px ${brand.accent2}`,
            boxShadow: `0 0 22px ${brand.accent2}`,
          }}
        >
          {block.text}
        </div>
      );
    case 'stamp':
      return (
        <div
          style={{
            ...pos,
            color: theme.onBg.accent,
            border: `6px solid ${theme.onBg.accent}`,
            borderRadius: 10,
            background: theme.brand.bg,
            textTransform: 'uppercase',
            transform: `rotate(-9deg) scale(${1.6 - 0.6 * p})`,
          }}
        >
          {block.text}
        </div>
      );
    case 'flash': {
      const blink = frame - start < 14 && Math.floor((frame - start) / 3) % 2 === 1;
      // whichever brand colour white text reads best on (news red, bold red)
      const red = contrastRatio(brand.accent, '#FFFFFF') >= contrastRatio(brand.accent2, '#FFFFFF') ? brand.accent : brand.accent2;
      return (
        <div style={{ ...pos, background: blink ? '#FFFFFF' : red, color: blink ? red : '#FFFFFF', textTransform: 'uppercase', transform: `rotate(0deg) scale(${0.4 + 0.6 * p})`, borderRadius: 4 }}>
          {block.text}
        </div>
      );
    }
    default:
      return (
        <div style={{ ...pos, borderRadius: 999, background: brand.accent2, color: '#FFFFFF', boxShadow: '0 12px 30px rgba(20,22,26,0.18)' }}>
          {block.text}
        </div>
      );
  }
};
