import { chunkWords, splitWords, type Line, type WordTiming } from '@reelmaker/shared';

/**
 * Caption chunks for karaoke: never across a script line, and balanced inside a line
 * (5 words → 3+2, not 4+1) with at most `perChunk` words each.
 * If words and lines disagree (e.g. stale timing), falls back to plain chunkWords.
 */
export function captionChunks(
  words: WordTiming[],
  lines: Pick<Line, 'caption'>[],
  perChunk = 4,
): WordTiming[][] {
  const counts = lines.map((l) => splitWords(l.caption).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return chunkWords(words, perChunk);
  const chunks: WordTiming[][] = [];
  let at = 0;
  for (const n of counts) {
    const lineWords = words.slice(at, at + n);
    at += n;
    const parts = Math.ceil(n / perChunk);
    for (let k = 0, from = 0; k < parts; k++) {
      const size = Math.ceil((n - from) / (parts - k));
      chunks.push(lineWords.slice(from, from + size));
      from += size;
    }
  }
  return chunks;
}
