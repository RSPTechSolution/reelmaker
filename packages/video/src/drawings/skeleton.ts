import type { Expression, Pose } from '@reelmaker/shared';

/** Drawing box of the stickman (viewBox units). "l"/"r" are the viewer's left/right. */
export const BOX_W = 300;
export const BOX_H = 400;
export const HEAD_R = 34;

export type Joint = 'head' | 'neck' | 'hip' | 'lElbow' | 'lHand' | 'rElbow' | 'rHand' | 'lKnee' | 'lFoot' | 'rKnee' | 'rFoot';
export type Point = { x: number; y: number };
export type Skeleton = Record<Joint, Point>;

export const JOINTS: Joint[] = ['head', 'neck', 'hip', 'lElbow', 'lHand', 'rElbow', 'rHand', 'lKnee', 'lFoot', 'rKnee', 'rFoot'];

const STAND: Skeleton = {
  head: { x: 150, y: 72 },
  neck: { x: 150, y: 116 },
  hip: { x: 150, y: 236 },
  lElbow: { x: 116, y: 172 },
  lHand: { x: 104, y: 226 },
  rElbow: { x: 184, y: 172 },
  rHand: { x: 196, y: 226 },
  lKnee: { x: 130, y: 306 },
  lFoot: { x: 120, y: 376 },
  rKnee: { x: 170, y: 306 },
  rFoot: { x: 180, y: 376 },
};

const pose = (changes: Partial<Skeleton>): Skeleton => ({ ...STAND, ...changes });

/** Every pose is joint positions on the same skeleton, so any two can be blended. */
export const POSES: Record<Pose, Skeleton> = {
  explain: pose({ rElbow: { x: 202, y: 152 }, rHand: { x: 246, y: 120 } }),
  pointing: pose({ rElbow: { x: 206, y: 128 }, rHand: { x: 262, y: 108 }, lHand: { x: 112, y: 228 } }),
  thinking: pose({
    head: { x: 146, y: 72 },
    rElbow: { x: 196, y: 168 },
    rHand: { x: 160, y: 100 },
    lElbow: { x: 122, y: 178 },
    lHand: { x: 158, y: 190 },
  }),
  shrug: pose({ lElbow: { x: 100, y: 150 }, lHand: { x: 78, y: 116 }, rElbow: { x: 200, y: 150 }, rHand: { x: 222, y: 116 } }),
  running: {
    head: { x: 172, y: 74 },
    neck: { x: 166, y: 116 },
    hip: { x: 150, y: 232 },
    lElbow: { x: 122, y: 152 },
    lHand: { x: 100, y: 186 },
    rElbow: { x: 196, y: 172 },
    rHand: { x: 218, y: 142 },
    lKnee: { x: 116, y: 292 },
    lFoot: { x: 82, y: 334 },
    rKnee: { x: 186, y: 292 },
    rFoot: { x: 182, y: 372 },
  },
  celebrate: pose({
    lElbow: { x: 110, y: 96 },
    lHand: { x: 88, y: 46 },
    rElbow: { x: 190, y: 96 },
    rHand: { x: 212, y: 46 },
    lFoot: { x: 108, y: 374 },
    rFoot: { x: 192, y: 374 },
  }),
  facepalm: pose({ head: { x: 150, y: 80 }, neck: { x: 150, y: 122 }, rElbow: { x: 188, y: 152 }, rHand: { x: 162, y: 80 } }),
  laptop: pose({ lElbow: { x: 124, y: 178 }, lHand: { x: 128, y: 204 }, rElbow: { x: 176, y: 178 }, rHand: { x: 172, y: 204 } }),
  wave: pose({ rElbow: { x: 206, y: 122 }, rHand: { x: 226, y: 62 } }),
  sad: pose({
    head: { x: 150, y: 92 },
    neck: { x: 150, y: 132 },
    lElbow: { x: 136, y: 188 },
    lHand: { x: 132, y: 242 },
    rElbow: { x: 164, y: 188 },
    rHand: { x: 168, y: 242 },
  }),
  shocked: pose({
    lElbow: { x: 96, y: 132 },
    lHand: { x: 96, y: 72 },
    rElbow: { x: 204, y: 132 },
    rHand: { x: 204, y: 72 },
    lFoot: { x: 104, y: 376 },
    rFoot: { x: 196, y: 376 },
  }),
  idea: pose({ rElbow: { x: 200, y: 132 }, rHand: { x: 206, y: 76 } }),
};

/** The presenter's body for each mascot face. */
export const EXPRESSION_POSE: Record<Expression, Pose> = {
  happy: 'wave',
  thinking: 'thinking',
  surprised: 'shocked',
  wink: 'pointing',
  excited: 'celebrate',
  laughing: 'celebrate',
  shocked: 'shocked',
  sad: 'sad',
};

const move = (s: Skeleton, joints: Joint[], dx: number, dy: number): Skeleton => {
  const out = { ...s };
  for (const j of joints) out[j] = { x: s[j].x + dx, y: s[j].y + dy };
  return out;
};

/** A pose at `frame` with its idle motion (frames since the pose appeared or absolute — both loop). */
export function poseAt(p: Pose, frame: number): Skeleton {
  const s = POSES[p];
  switch (p) {
    case 'thinking':
      return move(s, ['rHand'], 0, Math.sin(frame / 5) * 4); // taps the chin
    case 'running': {
      const k = Math.sin((2 * Math.PI * frame) / 12);
      let r = move(s, ['lKnee'], 16 * k, 0);
      r = move(r, ['lFoot'], 30 * k, 0);
      r = move(r, ['rKnee'], -16 * k, 0);
      r = move(r, ['rFoot'], -30 * k, -18 * Math.max(0, k));
      r = move(r, ['lHand', 'lElbow'], -14 * k, 0);
      return move(r, ['rHand', 'rElbow'], 14 * k, 0);
    }
    case 'celebrate':
      return move(s, JOINTS, 0, -Math.abs(Math.sin((Math.PI * frame) / 14)) * 14); // jumps
    case 'wave':
      return move(s, ['rHand'], Math.sin(frame / 3) * 16, 0);
    default:
      return move(s, ['head', 'neck'], 0, Math.sin(frame / 20) * 2); // breathing
  }
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Eased blend from pose a (t=0) to pose b (t=1). */
export function blendPose(a: Skeleton, b: Skeleton, t: number): Skeleton {
  const k = ease(Math.max(0, Math.min(1, t)));
  if (k === 0) return a;
  if (k === 1) return b;
  const out = {} as Skeleton;
  for (const j of JOINTS) out[j] = { x: a[j].x + (b[j].x - a[j].x) * k, y: a[j].y + (b[j].y - a[j].y) * k };
  return out;
}

/** Deterministic value in [-1, 1] for (step, salt). */
function noise(step: number, salt: number): number {
  const v = Math.sin(step * 127.1 + salt * 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Hand-drawn "boil": every joint jitters by up to px, re-rolled every 4 frames. */
export function boil(s: Skeleton, frame: number, px: number): Skeleton {
  if (px <= 0) return s;
  const step = Math.floor(frame / 4);
  const out = {} as Skeleton;
  JOINTS.forEach((j, i) => {
    out[j] = { x: s[j].x + noise(step, i * 2 + 1) * px, y: s[j].y + noise(step, i * 2 + 2) * px };
  });
  return out;
}
