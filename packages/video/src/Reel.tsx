import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { audioSettings, effectSettings, type Cue, type ReelProps } from '@reelmaker/shared';
import { BigNumber } from './blocks/BigNumber.tsx';
import { Card } from './blocks/Card.tsx';
import { List } from './blocks/List.tsx';
import { Sticker } from './blocks/Sticker.tsx';
import { Title } from './blocks/Title.tsx';
import { activeCues, cueStartFrame } from './cues.ts';
import {
  CONFETTI_FRAMES,
  confettiPieces,
  emotionMoments,
  musicVolume,
  punchScale,
  sfxEvents,
  shakeOffset,
  transitionStyles,
  TRANSITION_FRAMES,
} from './effects.ts';
import { END_CARD_FRAMES, EndCard } from './EndCard.tsx';
import { useBrandFont } from './fonts.ts';
import { Karaoke } from './Karaoke.tsx';
import { BLOCK_SLOT, MASCOT_BOX } from './layout.ts';
import { Mascot } from './Mascot.tsx';
import { SafeZones } from './SafeZones.tsx';

export const REEL_COMPOSITION_ID = 'Reel';

const BLINK_EVERY = 105;
const BLINK_FRAMES = 4;
const SFX_CLIP_FRAMES = 75;

function MainBlock({ cue, props, start, skipEntrance }: { cue: Cue; props: ReelProps; start: number; skipEntrance?: boolean }) {
  const common = { brand: props.brand, start, anim: cue.anim, skipEntrance };
  switch (cue.block.type) {
    case 'title':
      return <Title block={cue.block} {...common} />;
    case 'card':
      return <Card block={cue.block} {...common} />;
    case 'bigNumber':
      return <BigNumber block={cue.block} {...common} />;
    case 'list':
      return <List block={cue.block} {...common} />;
    default:
      return null;
  }
}

const centered: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Confetti burst from the top of the frame (deterministic per moment). */
function Confetti({ start, frame, colors }: { start: number; frame: number; colors: string[] }) {
  const pieces = useMemo(() => confettiPieces(start), [start]);
  return (
    <>
      {pieces.map((p, k) => {
        const t = (frame - start - p.delay) / CONFETTI_FRAMES;
        if (t < 0 || t > 1) return null;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: p.x,
              top: -40,
              width: p.size,
              height: p.size * 0.55,
              borderRadius: 3,
              background: colors[p.color % colors.length],
              opacity: t > 0.75 ? (1 - t) / 0.25 : 1,
              transform: `translate(${p.drift * t}px, ${p.fall * Math.pow(t, 1.2)}px) rotate(${p.spin * t}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * The reel: blocks (top half of safe box), karaoke captions, mascot, end card, plus sound effects,
 * background music and emotion effects. Same code for Player and render.
 */
export const Reel: React.FC<ReelProps> = (props) => {
  const { reel, words, loudness, brand, mascot, audioSrc, debugSafeZones } = props;
  const base = props.assetBase ?? '';
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fontFamily = useBrandFont(brand.font);
  const fx = effectSettings(reel);
  const audio = audioSettings(reel);
  const { main, previous, stickers, expression } = activeCues(reel.cues, words, frame, reel.lines);
  const endStart = durationInFrames - END_CARD_FRAMES;

  const sfx = useMemo(() => sfxEvents(reel, words, durationInFrames), [reel, words, durationInFrames]);
  const moments = useMemo(() => emotionMoments(reel, words), [reel, words]);

  const open = Math.max(0, Math.min(1, loudness[frame] ?? 0));
  const blink = frame % BLINK_EVERY >= BLINK_EVERY - BLINK_FRAMES;
  const bob = Math.sin(frame / 20) * 8;

  // scene change: old block leaves while the new one arrives
  const mainStart = main ? cueStartFrame(main, words) : 0;
  const transitioning = !!(main && previous && fx.transition !== 'none');
  const trans = transitionStyles(fx.transition, (frame - mainStart) / TRANSITION_FRAMES);

  // emotion: shake on shocked lines, a small zoom punch on keywords
  const shake = moments.shake.reduce(
    (acc, s) => {
      const o = shakeOffset(frame, s);
      return { x: acc.x + o.x, y: acc.y + o.y };
    },
    { x: 0, y: 0 },
  );
  const punch = moments.punch.reduce((m, s) => Math.max(m, punchScale(frame, s)), 1);
  const bursts = moments.confetti.filter((s) => frame >= s && frame < s + CONFETTI_FRAMES + 10);

  return (
    <AbsoluteFill style={{ background: brand.bg, fontFamily: `'${fontFamily}', 'Baloo 2', sans-serif`, overflow: 'hidden' }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      {audio.music ? (
        <Audio
          src={`${base}/audio/music/${audio.music.track}`}
          loop
          volume={(f) => musicVolume(f, loudness, audio.music!.volume, durationInFrames)}
        />
      ) : null}
      {sfx.map((e) => (
        <Sequence key={`${e.sound}-${e.frame}`} from={e.frame} durationInFrames={SFX_CLIP_FRAMES} layout="none">
          <Audio src={`${base}/audio/sfx/${e.sound}.wav`} volume={e.volume} />
        </Sequence>
      ))}

      <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px) scale(${punch})` }}>
        <div style={{ position: 'absolute', left: BLOCK_SLOT.x, top: BLOCK_SLOT.y, width: BLOCK_SLOT.w, height: BLOCK_SLOT.h }}>
          {transitioning && previous ? (
            <div key={`out-${previous.id}`} style={{ ...centered, ...trans.out }}>
              <MainBlock cue={previous} props={props} start={cueStartFrame(previous, words)} skipEntrance />
            </div>
          ) : null}
          {main ? (
            <div key={`in-${main.id}`} style={{ ...centered, ...(transitioning ? trans.in : {}) }}>
              <MainBlock cue={main} props={props} start={mainStart} skipEntrance={transitioning} />
            </div>
          ) : null}
        </div>
        {stickers.map((cue, i) =>
          cue.block.type === 'sticker' ? (
            <Sticker key={cue.id} block={cue.block} brand={brand} start={cueStartFrame(cue, words)} index={i} />
          ) : null,
        )}

        <Karaoke words={words} lines={reel.lines} keywords={reel.keywords} brand={brand} kinetic={fx.captions} />

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
      </AbsoluteFill>

      {bursts.map((s) => (
        <Confetti key={s} start={s} frame={frame} colors={[brand.accent, brand.accent2, '#FFD23F', '#FF6B8A']} />
      ))}

      {frame >= endStart ? <EndCard brand={brand} start={endStart} /> : null}
      {debugSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
  );
};
