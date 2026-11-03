---
name: reels
description: House style and learned rules for writing Hinglish reel scripts and planning scenes in data/reels/<id>/reel.json. Read before editing any reel.
---

# Reel house style

Format of `reel.json`: see `docs/reel-schema.md`.

## Script
- Short, punchy Hinglish — spoken like a friend explaining, not a lecture.
- Line 1 is the hook: a promise or a surprising fact in under 8 words.
- 6–10 lines; about 2.3 words per second of target length in total.
- Every line twice: `caption` in Roman Hinglish, `spoken` in Devanagari — **same number of words**.
- Numbers as digits in `caption` ("3 tips"), as words in `spoken` ("तीन टिप्स").
- English tech words transliterated in `spoken` ("AI" → "एआई", "app" → "ऐप").
- No emojis in `spoken` (the voice reads them out). Emojis only as card icons.
- End with a call to action ("Follow karo …").

## Scenes
- A new main cue (title, card, bigNumber, list) every 2–3 seconds of speech.
- First cue: a `title` at word 0.
- A number in the script → `bigNumber` at that word.
- At most 1–2 `sticker`s; 1–3 `expression` changes (e.g. `thinking` at a question, `wink` at the end).
- Card titles ≤ 4 words, bodies ≤ 6 words. List items ≤ 3 words, at most 5 items.
- 3–6 `keywords`: the words the viewer should remember.

## Learned rules
