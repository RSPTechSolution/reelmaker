import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Brand, EffectSettings, Line, WordTiming } from '@reelmaker/shared';
import { wordKinetics } from './effects.ts';
import { captionChunks } from './captions.ts';
import { CAPTION_BAND, fitText } from './layout.ts';

export const UPCOMING = '#9A9A9A';
export const WORDS_PER_CHUNK = 4;

const norm = (w: string) => w.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '');

/** Karaoke captions: one chunk (≤ 4 words, within one line) at a time; spoken words solid, upcoming grey, keywords accent. */
export const Karaoke: React.FC<{
  words: WordTiming[];
  lines: Line[];
  keywords: string[];
  brand: Brand;
  /** kinetic style of the word being spoken */
  kinetic?: EffectSettings['captions'];
}> = ({ words, lines, keywords, brand, kinetic = 'pop' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks = captionChunks(words, lines, WORDS_PER_CHUNK);
  const current = chunks.filter((c) => c[0].start <= t).at(-1);
  if (!current) return null;

  const keys = new Set(keywords.map(norm));
  const text = current.map((w) => w.caption).join(' ');
  const size = fitText(text, CAPTION_BAND.w, 92, 44, 2);
  const speaking = current.filter((w) => w.start <= t).at(-1);
  const enter = spring({ frame: frame - Math.round(current[0].start * fps), fps, config: { damping: 14, stiffness: 200 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: CAPTION_BAND.x,
        top: CAPTION_BAND.y,
        width: CAPTION_BAND.w,
        height: CAPTION_BAND.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: 'center',
          transform: `translateY(${(1 - enter) * 24}px)`,
          opacity: Math.min(1, enter * 1.4),
        }}
      >
        {current.map((w, k) => {
          const spoken = w.start <= t;
          const color = keys.has(norm(w.caption)) ? brand.accent : spoken ? brand.text : UPCOMING;
          const move = w === speaking ? wordKinetics(kinetic, frame - Math.round(w.start * fps)) : { scale: 1, y: 0 };
          return (
            <React.Fragment key={w.i}>
              <span
                style={{
                  color,
                  opacity: !spoken && keys.has(norm(w.caption)) ? 0.55 : 1,
                  display: 'inline-block',
                  transform: `translateY(${move.y}px) scale(${move.scale})`,
                }}
              >
                {w.caption}
              </span>
              {k < current.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
