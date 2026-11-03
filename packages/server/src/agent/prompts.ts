import { splitWords, totalWords, type Reel, type WordTiming } from '@reelmaker/shared';
import { reelFile } from '../paths.ts';
import { permissionPath } from './paths.ts';

export const SKILL_FILE = '.claude/skills/reels/SKILL.md';
export const SCHEMA_DOC = 'docs/reel-schema.md';
const WORDS_PER_SEC = 2.3;

function header(reel: Reel): string {
  const file = permissionPath(reelFile(reel.id));
  return [
    `You are editing one Hinglish reel for the owner.`,
    `First read ${SKILL_FILE} (house style and learned rules) and ${SCHEMA_DOC} (the reel.json format).`,
    `Then read and edit ONLY this file: ${file}`,
    `Keep it valid JSON that follows ${SCHEMA_DOC}. Never change "id", "hashes", "createdAt" or "updatedAt".`,
    `Reply to the owner in one or two short Hinglish sentences saying what you changed.`,
    ``,
    `Reel: "${reel.title}" — topic: ${reel.topic}${reel.hook ? ` — hook: ${reel.hook}` : ''} — target ${reel.targetSeconds} s.`,
  ].join('\n');
}

export function scriptPrompt(reel: Reel, instruction?: string): string {
  const budget = Math.round(WORDS_PER_SEC * reel.targetSeconds);
  return [
    header(reel),
    ``,
    `Task: write the script — replace "lines" (and set "title" to a short catchy title).`,
    `- Short, punchy Hinglish. The first line is the hook.`,
    `- 6–10 lines, about ${budget} words in total (${WORDS_PER_SEC} words/s × ${reel.targetSeconds} s).`,
    `- Every line is written twice: "caption" in Roman Hinglish (shown on screen, numbers as digits) and "spoken" in Devanagari (fed to the voice).`,
    `- caption and spoken MUST have exactly the same number of words (split on spaces): word i of spoken is word i of caption.`,
    `- In spoken, transliterate English tech words into Devanagari (e.g. "AI" → "एआई", "video" → "वीडियो") and write numbers as words. No emojis in spoken.`,
    `- Line ids: l1, l2, … (keep existing ids for lines you only tweak).`,
    `- If cues point beyond the new last word, remove those cues.`,
    instruction ? `\nOwner's request: ${instruction}` : '',
  ].join('\n');
}

export function scenesPrompt(reel: Reel, words: WordTiming[], instruction?: string): string {
  const wordList = words.length
    ? words.map((w) => `${w.i} ${w.caption} @${w.start.toFixed(2)}s`).join('\n')
    : reel.lines
        .flatMap((l) => splitWords(l.caption))
        .map((c, i) => `${i} ${c}`)
        .join('\n');
  return [
    header(reel),
    ``,
    `Task: plan the scenes — replace "cues" and set "keywords".`,
    `- A new main cue (title, card, bigNumber, list) every 2–3 seconds of speech.`,
    `- The first cue is at word 0 and is a "title".`,
    `- Numbers in the script become "bigNumber" cues at the word of the number.`,
    `- At most 1–2 "sticker" cues; 1–3 "expression" changes for the mascot.`,
    `- "keywords": 3–6 important caption words to highlight.`,
    `- atWord must be less than ${totalWords(reel.lines)} (the script's word count). Cue ids: c1, c2, …`,
    ``,
    `Words (index, caption word${words.length ? ', start time' : ''}):`,
    wordList,
    instruction ? `\nOwner's request: ${instruction}` : '',
  ].join('\n');
}

export function reviewPrompt(reel: Reel, instruction: string): string {
  return [
    header(reel),
    ``,
    `Task: the owner reviewed the reel and asks:`,
    instruction,
    ``,
    `Apply this to reel.json. If the request is a reusable rule for future reels (not a one-off fix), also append ONE short line to ${SKILL_FILE} under "## Learned rules".`,
  ].join('\n');
}
