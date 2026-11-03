import { FPS, wordFrame, type Cue, type Expression, type WordTiming } from '@reelmaker/shared';

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

export type ActiveCues = { main?: Cue; stickers: Cue[]; expression: Expression };

/**
 * What is on screen at `frame`:
 * - main: the latest started title/card/bigNumber/list. A newer main block replaces the older one
 *   in the slot; once it passes its untilWord the slot is empty (the older one does not return).
 * - stickers: started stickers not past their untilWord; without untilWord a sticker lasts until
 *   the next main block starts.
 * - expression: the latest started expression cue, else 'happy'.
 */
export function activeCues(cues: Cue[], words: WordTiming[], frame: number): ActiveCues {
  const timed = cues
    .map((cue, order) => ({ cue, order, start: cueStartFrame(cue, words), end: cueEndFrame(cue, words) }))
    .sort((a, b) => a.start - b.start || a.order - b.order);
  const started = timed.filter((t) => t.start <= frame);

  const latestMain = started.filter((t) => isMain(t.cue)).at(-1);
  const main = latestMain && frame < latestMain.end ? latestMain.cue : undefined;

  const mainStarts = timed.filter((t) => isMain(t.cue)).map((t) => t.start);
  const stickers = started
    .filter((t) => t.cue.block.type === 'sticker')
    .filter((t) => {
      if (t.cue.untilWord !== undefined) return frame < t.end;
      const nextMain = mainStarts.find((s) => s > t.start);
      return nextMain === undefined || frame < nextMain;
    })
    .map((t) => t.cue);

  const face = started.filter((t) => t.cue.block.type === 'expression').at(-1)?.cue.block;
  const expression = face && face.type === 'expression' ? face.expression : 'happy';
  return { main, stickers, expression };
}
