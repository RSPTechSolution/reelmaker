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
    `Write it like a real creator talking to one friend on camera, not like an ad or a lecture.`,
    ``,
    `Hook (line 1, max 8 words) — use one of these patterns:`,
    `- shock question: "Ek bhi camera nahi, phir bhi video?"`,
    `- stop the scroll: "Ruko! Ye galti mat karna."`,
    `- number promise: "3 tricks jo koi nahi batata"`,
    `- myth-bust: "Sab bolte hain X. Galat."`,
    `- secret: "Sach batau? ..."`,
    ``,
    `Body:`,
    `- 6–10 short lines (4–10 words each), about ${budget} words in total (${WORDS_PER_SEC} words/s × ${reel.targetSeconds} s).`,
    `- Real spoken Hinglish: "dekho", "yaar", "suno", "bas", "seedha" — at most one filler per line, never forced.`,
    `- One idea or emotional beat per line; vary rhythm (short punch, then a longer explanation).`,
    `- Put emotion into punctuation, the voice follows it: "!" for energy, "?" for a question beat, "…" for a dramatic pause. Write the same punctuation in caption and spoken.`,
    `- End with a clear call to action ("Follow karo, kal part 2!").`,
    ``,
    `Every line:`,
    `- "caption" in Roman Hinglish (shown on screen, numbers as digits) and "spoken" in Devanagari (fed to the voice).`,
    `- caption and spoken MUST have exactly the same number of words (split on spaces): word i of spoken is word i of caption.`,
    `- In spoken, transliterate English tech words into Devanagari (e.g. "AI" → "एआई", "video" → "वीडियो") and write numbers as words. No emojis in spoken.`,
    `- A "mood" for how it is said — one of excited, curious, serious, funny, calm, shocked. It sets the voice pace, the pause after the line and the mascot's face. Hook lines are usually excited, shocked or curious; vary moods across the reel.`,
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
    `- At most 1–2 "sticker" cues.`,
    `- Give each cue an entrance "anim": pop, slide, zoom, bounce or typewriter. Vary them so consecutive cues differ; typewriter suits titles, bounce suits big numbers and stickers, zoom suits a reveal.`,
    `- Mascot faces ("expression" cues): happy, thinking, surprised, wink, excited, laughing, shocked, sad. Change the face on every emotional beat where it differs from the line's mood (a line's mood already sets a face), e.g. surprised on a reveal, wink on the call to action.`,
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
