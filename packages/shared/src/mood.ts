import type { Expression, Line, Mood } from './schema.ts';

const SPEED: Record<Mood, number> = { excited: 1.12, funny: 1.08, shocked: 1.0, curious: 0.98, serious: 0.92, calm: 0.88 };
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.4;

/** Voice speed for a line: the reel's base speed scaled by the line's mood. */
export function moodSpeed(base: number, mood?: Mood): number {
  if (!mood) return base;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, base * SPEED[mood]));
}

const BASE_GAP = 0.15;

/** Seconds of silence after a line: longer after a question, exclamation or trailing dots. */
export function lineGap(line: Pick<Line, 'spoken' | 'mood'>, isLast: boolean): number {
  if (isLast) return 0;
  const end = line.spoken.trim();
  let gap = BASE_GAP;
  if (end.endsWith('…') || end.endsWith('...')) gap = 0.45;
  else if (end.endsWith('?')) gap = 0.35;
  else if (end.endsWith('!')) gap = 0.25;
  if (line.mood === 'shocked' || line.mood === 'serious') gap += 0.1;
  return Math.round(gap * 1000) / 1000;
}

const FACE: Record<Mood, Expression> = {
  excited: 'excited',
  curious: 'thinking',
  serious: 'thinking',
  funny: 'laughing',
  calm: 'happy',
  shocked: 'shocked',
};

/** The mascot face a line's mood suggests. */
export function moodExpression(mood?: Mood): Expression | undefined {
  return mood ? FACE[mood] : undefined;
}
