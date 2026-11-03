import React from 'react';
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Cue, ReelProps } from '@reelmaker/shared';
import { BigNumber } from './blocks/BigNumber.tsx';
import { Card } from './blocks/Card.tsx';
import { List } from './blocks/List.tsx';
import { Sticker } from './blocks/Sticker.tsx';
import { Title } from './blocks/Title.tsx';
import { activeCues, cueStartFrame } from './cues.ts';
import { END_CARD_FRAMES, EndCard } from './EndCard.tsx';
import { useBrandFont } from './fonts.ts';
import { Karaoke } from './Karaoke.tsx';
import { BLOCK_SLOT, MASCOT_BOX } from './layout.ts';
import { Mascot } from './Mascot.tsx';
import { SafeZones } from './SafeZones.tsx';

export const REEL_COMPOSITION_ID = 'Reel';

const BLINK_EVERY = 105;
const BLINK_FRAMES = 4;

function MainBlock({ cue, props, start }: { cue: Cue; props: ReelProps; start: number }) {
  const { brand } = props;
  switch (cue.block.type) {
    case 'title':
      return <Title block={cue.block} brand={brand} start={start} />;
    case 'card':
      return <Card block={cue.block} brand={brand} start={start} />;
    case 'bigNumber':
      return <BigNumber block={cue.block} brand={brand} start={start} />;
    case 'list':
      return <List block={cue.block} brand={brand} start={start} />;
    default:
      return null;
  }
}

/** The reel: blocks (top half of safe box), karaoke captions, mascot, end card. Same code for Player and render. */
export const Reel: React.FC<ReelProps> = (props) => {
  const { reel, words, loudness, brand, mascot, audioSrc, debugSafeZones } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fontFamily = useBrandFont(brand.font);
  const { main, stickers, expression } = activeCues(reel.cues, words, frame, reel.lines);
  const endStart = durationInFrames - END_CARD_FRAMES;

  const open = Math.max(0, Math.min(1, loudness[frame] ?? 0));
  const blink = frame % BLINK_EVERY >= BLINK_EVERY - BLINK_FRAMES;
  const bob = Math.sin(frame / 20) * 8;

  return (
    <AbsoluteFill style={{ background: brand.bg, fontFamily: `'${fontFamily}', 'Baloo 2', sans-serif` }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}

      <div
        style={{
          position: 'absolute',
          left: BLOCK_SLOT.x,
          top: BLOCK_SLOT.y,
          width: BLOCK_SLOT.w,
          height: BLOCK_SLOT.h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {main ? <MainBlock key={main.id} cue={main} props={props} start={cueStartFrame(main, words)} /> : null}
      </div>
      {stickers.map((cue, i) =>
        cue.block.type === 'sticker' ? (
          <Sticker key={cue.id} block={cue.block} brand={brand} start={cueStartFrame(cue, words)} index={i} />
        ) : null,
      )}

      <Karaoke words={words} lines={reel.lines} keywords={reel.keywords} brand={brand} />

      <div
        style={{
          position: 'absolute',
          left: MASCOT_BOX.x,
          top: MASCOT_BOX.y,
          width: MASCOT_BOX.w,
          height: MASCOT_BOX.h,
          // scale(0.96) leaves 8 px above and below, so the ±8 px bob never leaves the safe box
          transform: `translateY(${bob}px) scale(0.96)`,
        }}
      >
        <Mascot config={mascot} expression={expression} open={open} blink={blink} />
      </div>

      {frame >= endStart ? <EndCard brand={brand} start={endStart} /> : null}
      {debugSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
  );
};
