import { FPS, moodExpression, splitWords, wordFrame, type Cue, type Expression, type Line, type WordTiming } from '@reelmaker/shared';

/** Words per second assumed for a cue whose word has no timing yet (before Captions sync). */
const FALLBACK_WPS = 2.3;

const isMain = (c: Cue) => c.block.type !== 'sticker' && c.block.type !== 'expression';

export function cueStartFrame(cue: Cue, words: WordTiming[]): number {
  return wordFrame(words, cue.atWord, cue.atWord / FALLBACK_WPS);
}

/** First frame after the cue's `untilWord` has been spoken; Infinity without untilWord. */
export function cueEndFrame(cue: Cue, words: WordTiming[]): number {
  if (cue.untilWord === undefined) return Infinity;
  const w = words.find((x) => x.i === cue.untilWord);
  const endSec = w ? w.end : (cue.untilWord + 1) / FALLBACK_WPS;
  return Math.round(endSec * FPS);
}

/** Frames the old and new main block overlap during a scene change (see effects.ts). */
const OVERLAP_FRAMES = 10;

export type ActiveCues = {
  main?: Cue;
  /** The main block being replaced, during the first OVERLAP_FRAMES of a scene change. */
  previous?: Cue;
  stickers: Cue[];
  expression: Expression;
};

/**
 * What is on screen at `frame`:
 * - main: the latest started title/card/bigNumber/list. A newer main block replaces the older one
 *   in the slot; once it passes its untilWord the slot is empty (the older one does not return).
 * - stickers: started stickers not past their untilWord; without untilWord a sticker lasts until
 *   the next main block starts.
 * - expression: an expression cue started inside the current line, else the current line's mood
 *   face (when `lines` are given), else the latest started expression cue, else 'happy'.
 */
export function activeCues(
  cues: Cue[],
  words: WordTiming[],
  frame: number,
  lines?: Pick<Line, 'caption' | 'mood'>[],
): ActiveCues {
  const timed = cues
    .map((cue, order) => ({ cue, order, start: cueStartFrame(cue, words), end: cueEndFrame(cue, words) }))
    .sort((a, b) => a.start - b.start || a.order - b.order);
  const started = timed.filter((t) => t.start <= frame);

  const startedMains = started.filter((t) => isMain(t.cue));
  const latestMain = startedMains.at(-1);
  const main = latestMain && frame < latestMain.end ? latestMain.cue : undefined;
  const before = startedMains.at(-2);
  const previous =
    main && before && frame - latestMain!.start < OVERLAP_FRAMES && before.end > latestMain!.start ? before.cue : undefined;

  const mainStarts = timed.filter((t) => isMain(t.cue)).map((t) => t.start);
  const stickers = started
    .filter((t) => t.cue.block.type === 'sticker')
    .filter((t) => {
      if (t.cue.untilWord !== undefined) return frame < t.end;
      const nextMain = mainStarts.find((s) => s > t.start);
      return nextMain === undefined || frame < nextMain;
    })
    .map((t) => t.cue);

  const faces = started.filter((t) => t.cue.block.type === 'expression');
  const faceOf = (t?: (typeof faces)[number]) => (t?.cue.block.type === 'expression' ? t.cue.block.expression : undefined);
  const line = currentLine(lines, words, frame);
  const fromCueInLine = line ? faceOf(faces.filter((t) => t.start >= line.startFrame).at(-1)) : undefined;
  const expression = fromCueInLine ?? moodExpression(line?.mood) ?? faceOf(faces.at(-1)) ?? 'happy';
  return { main, ...(previous ? { previous } : {}), stickers, expression };
}

/** The script line being spoken at `frame` (the line of the latest started word) and its start frame. */
function currentLine(lines: Pick<Line, 'caption' | 'mood'>[] | undefined, words: WordTiming[], frame: number) {
  if (!lines?.length) return undefined;
  let first = 0;
  let found: { mood?: Line['mood']; startFrame: number } | undefined;
  for (const l of lines) {
    const n = splitWords(l.caption).length;
    const startFrame = wordFrame(words, first, first / FALLBACK_WPS);
    if (n > 0 && startFrame <= frame) found = { mood: l.mood, startFrame };
    first += n;
  }
  return found;
}
