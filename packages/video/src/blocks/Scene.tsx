import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Block, Expression, Pose } from '@reelmaker/shared';
import { MORPH_FRAMES, propDelay } from '../cues.ts';
import { PropDrawing } from '../drawings/props.tsx';
import { blendPose, boil, BOX_H, BOX_W, POSES, poseAt } from '../drawings/skeleton.ts';
import { Stickman } from '../drawings/Stickman.tsx';
import { BLOCK_SLOT, fitText } from '../layout.ts';
import { headingStyle } from '../themes/style.ts';
import { Pop, usePop, type BlockProps } from './common.tsx';

type SceneBlock = Extract<Block, { type: 'scene' }>;

/** Frames the stickman takes to draw itself on (draw-on inks). */
const DRAW_FRAMES = 18;
const TEXT_H = 130;

/** The face that goes with each pose. */
const POSE_FACE: Record<Pose, Expression> = {
  thinking: 'thinking',
  pointing: 'wink',
  shrug: 'surprised',
  running: 'excited',
  celebrate: 'excited',
  facepalm: 'sad',
  explain: 'happy',
  laptop: 'happy',
  wave: 'happy',
  sad: 'sad',
  shocked: 'shocked',
  idea: 'excited',
};

type Slot = { x: number; y: number; size: number };

/** Where up to 3 objects sit in the drawing area (w × h), beside the stickman or on their own. */
function propSlots(n: number, withPose: boolean, w: number, h: number): Slot[] {
  if (withPose) {
    if (n === 1) return [{ x: 650, y: h * 0.5, size: 300 }];
    if (n === 2)
      return [
        { x: 620, y: h * 0.28, size: 250 },
        { x: 790, y: h * 0.72, size: 250 },
      ];
    return [
      { x: 600, y: h * 0.22, size: 210 },
      { x: 800, y: h * 0.5, size: 210 },
      { x: 610, y: h * 0.8, size: 210 },
    ];
  }
  const size = n === 1 ? 400 : n === 2 ? 340 : 270;
  const xs = n === 1 ? [w / 2] : n === 2 ? [w * 0.29, w * 0.71] : [w * 0.17, w * 0.5, w * 0.83];
  return xs.map((x, k) => ({ x, y: h * 0.5 - (n === 3 && k === 1 ? 30 : 0), size }));
}

/**
 * Drawings acting out the words: a stickman pose, up to 3 objects (each with its own entrance,
 * staggered) and an optional heading. `fromPose`: the previous scene's pose, so the stickman stays
 * on screen and eases into this one instead of drawing itself again. `bold` shows only the text.
 */
export const Scene: React.FC<BlockProps<SceneBlock> & { fromPose?: Pose }> = ({ block, theme, start, anim, skipEntrance, fromPose }) => {
  const frame = useCurrentFrame();
  const since = frame - start;
  const pop = usePop(start, 0, anim);
  const ink = theme.ink;
  const text = block.text?.trim();

  if (theme.id === 'bold') {
    if (!text) return null;
    const size = fitText(text, BLOCK_SLOT.w, 190, 80, 3, theme.charWidth);
    const slam = skipEntrance ? 1 : pop;
    return (
      <div
        style={{
          fontSize: size,
          lineHeight: 0.95,
          textAlign: 'center',
          color: theme.onBg.text,
          ...headingStyle(theme),
          transform: `scale(${1.8 - 0.8 * slam})`,
          opacity: Math.min(1, slam * 2),
        }}
      >
        {text}
      </div>
    );
  }

  const props = block.props ?? [];
  const pose = block.pose;
  if (!pose && !props.length) {
    if (!text) return null;
    return (
      <Pop start={start} anim={anim} skip={skipEntrance}>
        <div style={{ fontSize: fitText(text, BLOCK_SLOT.w, 150, 64, 3, theme.charWidth), lineHeight: 1.05, textAlign: 'center', color: theme.onBg.text, ...headingStyle(theme) }}>
          {text}
        </div>
      </Pop>
    );
  }

  const textH = text ? TEXT_H : 0;
  const w = BLOCK_SLOT.w;
  const h = BLOCK_SLOT.h - textH;
  const settled = skipEntrance || fromPose;

  let figure: React.ReactNode = null;
  if (pose) {
    const target = poseAt(pose, since);
    const skeleton = boil(fromPose ? blendPose(POSES[fromPose], target, since / MORPH_FRAMES) : target, frame, ink.boil);
    const figH = h; // as tall as the drawing area
    const figW = (figH * BOX_W) / BOX_H;
    const cx = props.length ? 230 : w / 2;
    const grow = settled || ink.drawOn ? 1 : pop;
    figure = (
      <div
        data-scene-pose={pose}
        style={{ position: 'absolute', left: cx - figW / 2, top: (h - figH) / 2, transform: `scale(${grow})`, transformOrigin: '50% 100%' }}
      >
        <Stickman
          skeleton={skeleton}
          ink={ink}
          pose={pose}
          face={POSE_FACE[pose]}
          drawProgress={settled ? 1 : since / DRAW_FRAMES}
          width={figW}
        />
      </div>
    );
  }

  const slots = propSlots(props.length, !!pose, w, h);
  return (
    <div style={{ position: 'relative', width: w, height: BLOCK_SLOT.h }}>
      {text ? (
        <Pop start={start} anim={anim} skip={skipEntrance && !fromPose} style={{ height: textH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: fitText(text, w, 96, 48, 1, theme.charWidth), lineHeight: 1.05, textAlign: 'center', color: theme.onBg.text, ...headingStyle(theme) }}>
            {text}
          </div>
        </Pop>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: textH, width: w, height: h }}>
        {figure}
        {props.map((p, k) => {
          const appear = since - propDelay(block, k);
          if (appear < 0) return null;
          const s = slots[k];
          return (
            <div key={`${p}-${k}`} style={{ position: 'absolute', left: s.x - s.size / 2, top: s.y - s.size / 2 }}>
              <PropDrawing prop={p} ink={ink} since={appear} size={s.size} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
