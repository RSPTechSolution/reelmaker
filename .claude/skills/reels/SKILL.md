---
name: reels
description: House style and learned rules for writing Hinglish reel scripts and planning scenes in data/reels/<id>/reel.json. Read before editing any reel.
---

# Reel house style

Format of `reel.json`: see `docs/reel-schema.md`.

## Script
- Talk like a real creator to one friend on camera — not an ad, not a lecture.
- Line 1 is the hook (max 8 words). Patterns that work: shock question ("Ek bhi camera nahi, phir bhi video?"), stop-the-scroll ("Ruko! Ye galti mat karna."), number promise ("3 tricks jo koi nahi batata"), myth-bust ("Sab bolte hain X. Galat."), secret ("Sach batau? …").
- 6–10 short lines (4–10 words); about 2.3 words per second of target length in total. One idea or emotional beat per line; mix short punches with one longer explanation.
- Natural Hinglish fillers — "dekho", "yaar", "suno", "bas", "seedha" — at most one per line, never forced.
- Emotion lives in punctuation, the voice follows it: "!" energy, "?" question beat, "…" dramatic pause. Same punctuation in caption and spoken.
- Every line twice: `caption` in Roman Hinglish, `spoken` in Devanagari — **same number of words**.
- Every line gets a `mood`: excited, curious, serious, funny, calm, shocked. It sets voice pace, the pause after the line, and the mascot's face. Vary moods; the hook is usually excited, shocked or curious.
- Numbers as digits in `caption` ("3 tips"), as words in `spoken` ("तीन टिप्स").
- English tech words transliterated in `spoken` ("AI" → "एआई", "app" → "ऐप").
- No emojis in `spoken` (the voice reads them out). Emojis only as card icons.
- End with a clear call to action ("Follow karo, kal part 2!").

## Scenes
- A new main cue (title, card, bigNumber, list) every 2–3 seconds of speech.
- First cue: a `title` at word 0.
- A number in the script → `bigNumber` at that word.
- At most 1–2 `sticker`s.
- Mascot faces: happy, thinking, surprised, wink, excited, laughing, shocked, sad. A line's mood already sets a face; add an `expression` cue on every emotional beat where the face should differ (surprised on a reveal, laughing on a joke, wink on the call to action).
- Every cue gets an entrance `anim` (pop, slide, zoom, bounce, typewriter); vary them. Typewriter for titles, bounce for numbers and stickers, zoom for a reveal.
- Sound effects fire automatically (swipe on scene changes, ding when a number lands, boom on shocked lines, a soft pop when coins, a rocket or a tick appear), so place cues on the word that should carry the hit.
- Card titles ≤ 4 words, bodies ≤ 6 words. List items ≤ 3 words, at most 5 items.
- 3–6 `keywords`: the words the viewer should remember.

## Themes and drawings
- The reel's `theme` is the owner's choice — never change it. Read it before planning scenes.
- `scene` blocks act out the line: a stickman `pose`, up to 3 `props`, optional short `text`. Match them to the words (question → `thinking`, mistake → `facepalm` + `warning`, money → `coins`, growth → `rocket` or `chartUp`, time → `clock`). Never decorative-random.
- Drawing-led themes (Stickman story, Animated objects, Chalkboard, Notebook doodle): most main cues are scenes. Other themes: mix scenes with cards, numbers and lists.
- Bold typography shows no drawings: every scene needs `text` (2–4 punchy words).
- Back-to-back scenes with poses keep the stickman on screen and change its pose — chain them for a little story (thinking → idea → celebrate).
- Use only the pose and prop names in `docs/reel-schema.md`.

## Learned rules
