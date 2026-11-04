import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { Pop, type BlockProps } from './common.tsx';

type TitleBlock = Extract<Block, { type: 'title' }>;

/** Frames per typed character, and the cursor blink period. */
const TYPE_FRAMES_PER_CHAR = 1.2;
const CURSOR_BLINK = 16;

export const Title: React.FC<BlockProps<TitleBlock>> = ({ block, brand, start, anim, skipEntrance }) => {
  const frame = useCurrentFrame();
  // size from the full text, so the title does not grow while it types
  const size = fitText(block.text, BLOCK_SLOT.w, 120, 48);
  const typing = anim === 'typewriter' && !skipEntrance;
  const shown = typing ? Math.max(0, Math.floor((frame - start) / TYPE_FRAMES_PER_CHAR)) : block.text.length;
  const done = shown >= block.text.length;
  const cursorOn = Math.floor((frame - start) / (CURSOR_BLINK / 2)) % 2 === 0;
  return (
    <Pop start={start} anim={anim} skip={skipEntrance}>
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1, color: brand.text, textAlign: 'center' }}>
        {block.text.slice(0, shown)}
        {typing ? (
          // the rest stays laid out but invisible, so the lines don't reflow while typing
          <span style={{ opacity: 0 }}>{block.text.slice(shown)}</span>
        ) : null}
        {typing && (!done || cursorOn) && frame - start < block.text.length * TYPE_FRAMES_PER_CHAR + 30 ? (
          <span style={{ color: brand.accent, marginLeft: '0.04em' }}>|</span>
        ) : null}
      </div>
      <div style={{ margin: '28px auto 0', width: 160, height: 14, borderRadius: 7, background: brand.accent }} />
    </Pop>
  );
};
