import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Block } from '@reelmaker/shared';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { headingStyle } from '../themes/style.ts';
import { Pop, type BlockProps } from './common.tsx';

type TitleBlock = Extract<Block, { type: 'title' }>;

/** Frames per typed character, and the cursor blink period. */
const TYPE_FRAMES_PER_CHAR = 1.2;
const CURSOR_BLINK = 16;

/** The mark under a title: the brand bar, a marker scribble, chalk line, highlighter, neon bar… */
function TitleMark({ theme }: { theme: BlockProps<TitleBlock>['theme'] }) {
  const accent = theme.onBg.accent;
  switch (theme.surface) {
    case 'marker':
    case 'chalk':
    case 'note':
      return (
        <svg width={360} height={40} viewBox="0 0 360 40" style={{ display: 'block', margin: '18px auto 0' }}>
          <path
            d="M8 26 Q90 8 180 22 T352 16"
            fill="none"
            stroke={accent}
            strokeWidth={theme.surface === 'note' ? 22 : 9}
            strokeLinecap="round"
            opacity={theme.surface === 'note' ? 0.55 : 1}
          />
        </svg>
      );
    case 'neon':
      return <div style={{ margin: '28px auto 0', width: 220, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 18px ${accent}` }} />;
    case 'type':
      return null;
    case 'lowerThird':
      return <div style={{ margin: '24px auto 0', width: 420, height: 18, background: theme.brand.accent }} />;
    case 'poster':
      return <div style={{ margin: '24px auto 0', width: 300, height: 10, borderTop: `4px solid ${accent}`, borderBottom: `4px solid ${accent}` }} />;
    default:
      return <div style={{ margin: '28px auto 0', width: 160, height: 14, borderRadius: 7, background: accent }} />;
  }
}

export const Title: React.FC<BlockProps<TitleBlock>> = ({ block, theme, start, anim, skipEntrance }) => {
  const frame = useCurrentFrame();
  // size from the full text, so the title does not grow while it types
  const size = fitText(block.text, BLOCK_SLOT.w, 120, 48, 3, theme.charWidth);
  const typing = anim === 'typewriter' && !skipEntrance;
  const shown = typing ? Math.max(0, Math.floor((frame - start) / TYPE_FRAMES_PER_CHAR)) : block.text.length;
  const done = shown >= block.text.length;
  const cursorOn = Math.floor((frame - start) / (CURSOR_BLINK / 2)) % 2 === 0;
  return (
    <Pop start={start} anim={anim} skip={skipEntrance}>
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1, color: theme.onBg.text, textAlign: 'center', ...headingStyle(theme) }}>
        {block.text.slice(0, shown)}
        {typing ? (
          // the rest stays laid out but invisible, so the lines don't reflow while typing
          <span style={{ opacity: 0 }}>{block.text.slice(shown)}</span>
        ) : null}
        {typing && (!done || cursorOn) && frame - start < block.text.length * TYPE_FRAMES_PER_CHAR + 30 ? (
          <span style={{ color: theme.onBg.accent, marginLeft: '0.04em' }}>|</span>
        ) : null}
      </div>
      <TitleMark theme={theme} />
    </Pop>
  );
};
