import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { audioSettings, effectSettings, reelTheme, type Cue, type Pose, type ReelProps } from '@reelmaker/shared';
import { BigNumber } from './blocks/BigNumber.tsx';
import { Card } from './blocks/Card.tsx';
import { List } from './blocks/List.tsx';
import { Scene } from './blocks/Scene.tsx';
import { Sticker } from './blocks/Sticker.tsx';
import { Title } from './blocks/Title.tsx';
import { activeCues, cueStartFrame, isMorph, mainBefore } from './cues.ts';
import { boil, EXPRESSION_POSE, poseAt } from './drawings/skeleton.ts';
import { Stickman } from './drawings/Stickman.tsx';
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
import { Background } from './themes/Background.tsx';
import { resolveTheme } from './themes/registry.ts';
import { fontStack } from './themes/style.ts';
import type { ResolvedTheme } from './themes/types.ts';

export const REEL_COMPOSITION_ID = 'Reel';

const BLINK_EVERY = 105;
const BLINK_FRAMES = 4;
const SFX_CLIP_FRAMES = 75;

function MainBlock({
  cue,
  theme,
  start,
  skipEntrance,
  fromPose,
}: {
  cue: Cue;
  theme: ResolvedTheme;
  start: number;
  skipEntrance?: boolean;
  /** scene after scene: the stickman carries on from this pose */
  fromPose?: Pose;
}) {
  const common = { brand: theme.brand, theme, start, anim: cue.anim, skipEntrance };
  switch (cue.block.type) {
    case 'title':
      return <Title block={cue.block} {...common} />;
    case 'card':
      return <Card block={cue.block} {...common} />;
    case 'bigNumber':
      return <BigNumber block={cue.block} {...common} />;
    case 'list':
      return <List block={cue.block} {...common} />;
    case 'scene':
      return <Scene block={cue.block} {...common} fromPose={fromPose} />;
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

const isMain = (c: Cue) => c.block.type !== 'sticker' && c.block.type !== 'expression';

/**
 * The reel: theme background, blocks (top half of safe box), karaoke captions, presenter (mascot or
 * stickman), end card, plus sound effects, background music and emotion effects. Same code for
 * Player and render.
 */
export const Reel: React.FC<ReelProps> = (props) => {
  const { reel, words, loudness, brand, mascot, audioSrc, debugSafeZones } = props;
  const base = props.assetBase ?? '';
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const resolved = useMemo(() => resolveTheme(reelTheme(reel), brand), [reel, brand]);
  const headingFont = useBrandFont(resolved.headingFont);
  const bodyFont = useBrandFont(resolved.bodyFont);
  const theme = useMemo(() => ({ ...resolved, headingFont, bodyFont }), [resolved, headingFont, bodyFont]);
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
  const mainStarts = useMemo(() => reel.cues.filter(isMain).map((c) => cueStartFrame(c, words)), [reel.cues, words]);
  const sceneIndex = mainStarts.filter((s) => s <= frame).length;
  // scene after scene: the stickman stays and changes pose; no slide/whip/zoom for it
  const replaced = useMemo(() => (main ? mainBefore(reel.cues, words, main) : undefined), [reel.cues, words, main]);
  const morph = isMorph(replaced, main);
  const fromPose = morph && replaced?.block.type === 'scene' ? replaced.block.pose : undefined;
  const transitioning = !!(main && previous && fx.transition !== 'none' && !morph);
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
    <AbsoluteFill style={{ background: theme.brand.bg, fontFamily: fontStack(bodyFont), overflow: 'hidden' }}>
      <div data-theme={theme.id} style={{ display: 'none' }} />
      <Background theme={theme} frame={frame} sceneIndex={sceneIndex} sinceScene={main ? frame - mainStart : -1} />
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
              <MainBlock cue={previous} theme={theme} start={cueStartFrame(previous, words)} skipEntrance />
            </div>
          ) : null}
          {main ? (
            <div key={`in-${main.id}`} style={{ ...centered, ...(transitioning ? trans.in : {}) }}>
              <MainBlock cue={main} theme={theme} start={mainStart} skipEntrance={transitioning} fromPose={fromPose} />
            </div>
          ) : null}
        </div>
        {stickers.map((cue, i) =>
          cue.block.type === 'sticker' ? (
            <Sticker key={cue.id} block={cue.block} brand={theme.brand} theme={theme} start={cueStartFrame(cue, words)} index={i} />
          ) : null,
        )}

        <Karaoke words={words} lines={reel.lines} keywords={reel.keywords} theme={theme} kinetic={fx.captions} />

        {theme.presenter !== 'none' ? (
          <div
            style={{
              position: 'absolute',
              left: MASCOT_BOX.x,
              top: MASCOT_BOX.y,
              width: MASCOT_BOX.w,
              height: MASCOT_BOX.h,
              // scale(0.96) leaves 8 px above and below, so the ±8 px bob never leaves the safe box
              transform: `translateY(${theme.presenter === 'mascot' ? bob : 0}px) scale(0.96)`,
              ...(theme.mascotFilter ? { filter: theme.mascotFilter } : {}),
            }}
          >
            {theme.presenter === 'stickman' ? (
              <div data-stickman-presenter="" style={{ display: 'flex', justifyContent: 'center' }}>
                <Stickman
                  skeleton={boil(poseAt(EXPRESSION_POSE[expression], frame), frame, theme.ink.boil)}
                  ink={theme.ink}
                  pose={EXPRESSION_POSE[expression]}
                  face={expression}
                  mouthOpen={open}
                  blink={blink}
                />
              </div>
            ) : (
              <div data-mascot="">
                <Mascot config={mascot} expression={expression} open={open} blink={blink} />
              </div>
            )}
          </div>
        ) : null}
      </AbsoluteFill>

      {bursts.map((s) => (
        <Confetti key={s} start={s} frame={frame} colors={theme.confetti} />
      ))}

      {frame >= endStart ? <EndCard theme={theme} start={endStart} /> : null}
      {debugSafeZones ? <SafeZones /> : null}
    </AbsoluteFill>
  );
};
