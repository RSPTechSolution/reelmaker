# `reel.json` — schema for humans and the agent

Every reel lives in `data/reels/<id>/reel.json`. The server validates it with zod (`packages/shared/src/schema.ts`) after every edit; an invalid file is rolled back. **Edit only the fields described here; never add new ones.**

## Top level

| Field | Type | Rules |
|---|---|---|
| `id` | string | Set by the server (`yyyymmdd-hhmm-<slug>`). Never change it. |
| `title` | string | Short title shown in the library. |
| `topic` | string | What the reel is about. |
| `hook` | string, optional | The opening idea the owner asked for. |
| `targetSeconds` | integer 20–60 | Wanted length. Aim for about **2.3 words per second** in total. |
| `lines` | Line[] | The script, in speaking order. |
| `voice` | VoiceSettings | Voice used for TTS. |
| `cues` | Cue[] | Animated scenes, each triggered by a word. |
| `keywords` | string[] | Caption words shown in the accent colour (case-insensitive match against caption words). |
| `coverFrame` | integer ≥ 0, optional | Frame used for the cover PNG. |
| `audio` | optional `{sfx, sfxVolume, music?: {track, volume}}` | Sound effects on/off and volume (0–1); background track from the music library (`builtin-lofi.wav`, `builtin-upbeat.wav`, `builtin-dramatic.wav` or the owner's `upload-….mp3`). Default: effects on at 0.6, no music. |
| `effects` | optional `{transition, captions, emotion}` | Scene transition `none`/`slide`/`whip`/`zoom`, caption style `color`/`pop`/`bounce`, emotion effects on/off (shake on shocked lines, confetti on excited lines, zoom punch on keywords). Default: the theme's transition and caption style, emotion on. |
| `theme` | optional theme name | The reel's whole look (see **Themes**). Missing = `classic`. Set by the owner; keep it as it is. |
| `hashes` | `{voice?: string, timing?: string}` | Set by the server. **Never edit.** |
| `createdAt`, `updatedAt` | ISO date string | Set by the server. |

**All ids** (reel, line, cue) may only use letters, digits, `_` and `-` (max 64 characters), must not be a Windows device name (`CON`, `NUL`, `COM1`, …), and line ids and cue ids must be unique within the reel.

## Line

```
{ "id": "l1", "caption": "AI se video banana ab bahut easy hai", "spoken": "एआई से वीडियो बनाना अब बहुत ईज़ी है" }
```

- `caption` — **Roman Hinglish**, shown on screen. Numbers as digits (`3`, not `teen`).
- `spoken` — the same sentence in **Devanagari**, fed to the voice. English tech words are transliterated (`AI` → `एआई`, `video` → `वीडियो`). Numbers written as words (`3` → `तीन`). No emojis.
- **`caption` and `spoken` must have exactly the same number of words** (split on spaces). Word *i* of `spoken` is said while word *i* of `caption` is highlighted. Punctuation stays attached to its word (`Step 1:` is two words).
- `id` — unique within the reel (`l1`, `l2`, …). Keep ids stable when editing a line so only that line's audio is regenerated.
- `mood` — optional: `excited` | `curious` | `serious` | `funny` | `calm` | `shocked`. Sets how the line is said: voice pace (excited/funny faster, serious/calm slower), the pause after it (longer after `?`, `!`, `…`, and for shocked/serious), and the mascot's face during the line unless an `expression` cue in that line overrides it.

## Word indexes

Words are numbered from **0** across the whole script, in order, using `caption` split on spaces. In the example below line `l1` has words 0–7, `l2` has 8–13 (`3` is word 9), `l3` has 14–19, and so on.

## Cue

```
{ "id": "c2", "atWord": 9, "untilWord": 13, "block": { "type": "bigNumber", "to": 3, "suffix": " steps" } }
```

- `atWord` — integer word index at which the block appears. Must be **less than the total word count**.
- `untilWord` — optional; the block disappears after this word. Without it, a block stays until the next main block replaces it.
- `id` — unique within the reel (`c1`, `c2`, …).
- `anim` — optional entrance: `pop` (default) | `slide` | `zoom` | `bounce` | `typewriter` (types the title in).

## Blocks (`block.type`)

| type | fields | use for |
|---|---|---|
| `title` | `text` | Big headline. The first cue (word 0) is always a title. |
| `card` | `title`, `body?`, `icon?` (one emoji) | A point with a short explanation. |
| `bigNumber` | `to` (number), `prefix?`, `suffix?` | Counts up to a number, e.g. `{"to": 90, "suffix": "%"}`. |
| `sticker` | `text` | Small overlay that sits on top of the main block (max 1–2 per reel). |
| `list` | `items` (1–5 strings) | Short recap. |
| `expression` | `expression`: `happy` \| `thinking` \| `surprised` \| `wink` \| `excited` \| `laughing` \| `shocked` \| `sad` | Changes the mascot's face; shows nothing else. |
| `scene` | `pose?`, `props?` (0–3), `text?` — at least one | Drawings acting out the words (see **Scene block**). |

`title`, `card`, `bigNumber`, `list` and `scene` are **main** blocks: each new one replaces the previous one. `sticker` and `expression` do not replace anything.

## Themes (`theme`)

The whole look of the reel. Missing = `classic`. Changing the theme never changes the voice or captions.

| theme | look |
|---|---|
| `classic` | **Classic** — your brand colours, rounded cards and the mascot |
| `stickman` | **Stickman story** — white paper, black marker lines that draw themselves, a stickman acting out the idea *(drawing-led: most main cues are `scene` blocks)* |
| `objects` | **Animated objects** — motion graphics: bright flat icons and shapes that fly in, bounce and orbit *(drawing-led: most main cues are `scene` blocks)* |
| `chalkboard` | **Chalkboard** — dark green board, chalk writing and drawings, a teacher explaining *(drawing-led: most main cues are `scene` blocks)* |
| `comic` | **Comic** — comic panels, halftone dots, speech bubbles and BOOM-style bursts |
| `neon` | **Neon tech** — dark background with a glowing grid and neon outlines, for tech and AI topics |
| `paper` | **Paper cut-out** — textured paper layers with soft shadows sliding in, like a handmade collage |
| `notebook` | **Notebook doodle** — ruled copy page, blue pen doodles and highlighter, like student notes *(drawing-led: most main cues are `scene` blocks)* |
| `bold` | **Bold typography** — no pictures: giant words that slam, stretch and stack on solid colour |
| `news` | **Breaking news** — news studio graphics: headline bars, a ticker and a BREAKING flash |
| `bollywood` | **Retro Bollywood** — old film poster: bold lettering, sunburst rays, warm colours and film grain |

## Scene block

```
{ "type": "scene", "pose": "thinking", "props": ["coins", "clock"], "text": "Paisa ya time?" }
```

Acts out what is being said: a stickman `pose`, up to **3** `props` (objects) and an optional short `text` heading. At least one of the three is required. Each theme draws them in its own style (marker, chalk, neon, …); `bold` shows only the `text`. Use **only** the names below and pick them to match the words.

| pose | means |
|---|---|
| `thinking` | a question, wondering, planning |
| `pointing` | look at this, a tip, "you" / call to action |
| `shrug` | confusion, "pata nahi", nobody knows |
| `running` | speed, hurry, quick results, chasing a goal |
| `celebrate` | success, a win, excitement |
| `facepalm` | a mistake, "galti", something silly |
| `explain` | teaching, explaining a step |
| `laptop` | working, coding, using an app or AI tool |
| `wave` | hello, intro, goodbye |
| `sad` | a problem, loss, disappointment |
| `shocked` | a surprise, an unbelievable fact |
| `idea` | an idea, a trick, the "aha" moment |

| prop | means |
|---|---|
| `phone` | mobile, apps, social media, reels |
| `coins` | money, price, earning, saving |
| `rocket` | growth, launch, going viral, fast |
| `chartUp` | increase, profit, more views |
| `chartDown` | decrease, loss, falling numbers |
| `clock` | time, minutes, deadline, waiting |
| `bulb` | idea, tip, smart trick |
| `heart` | love, likes, health |
| `lock` | security, privacy, password, locked |
| `moneyBag` | big money, salary, savings, rich |
| `trophy` | winning, best, number one, achievement |
| `warning` | danger, mistake to avoid, careful |
| `gift` | free, bonus, surprise |
| `camera` | photo, video, shooting, content |
| `laptop` | computer, work, online, software |
| `book` | learning, study, reading, course |
| `fire` | trending, hot, viral, intense |
| `star` | best, rating, special, important |
| `check` | yes, correct, done, do this |
| `cross` | no, wrong, avoid, do not |
| `calendar` | days, dates, schedule, every day |
| `chat` | talking, comments, messages, conversation |
| `search` | search, finding, research, Google |
| `target` | goal, aim, focus, exact result |

## VoiceSettings

```
{ "engine": "kokoro", "voiceId": "hf_alpha", "speed": 1.0 }
```

- `engine` — `kokoro` or `upload` (owner recorded their own voice).
- `voiceId` — `hf_alpha` (default), `hf_beta`, `hm_omega`, `hm_psi`.
- `speed` — 0.8 to 1.3.

## Full example

```json
{
  "id": "20261103-1300-ai-se-video",
  "title": "AI se video kaise banaye — 3 tips",
  "topic": "AI se video kaise banaye — 3 tips",
  "hook": "AI se video banana ab bahut easy hai",
  "targetSeconds": 30,
  "lines": [
    { "id": "l1", "caption": "AI se video banana ab bahut easy hai", "spoken": "एआई से वीडियो बनाना अब बहुत ईज़ी है" },
    { "id": "l2", "caption": "Bas 3 simple steps follow karo", "spoken": "बस तीन सिंपल स्टेप्स फॉलो करो" },
    { "id": "l3", "caption": "Step 1: script AI se likhwao", "spoken": "स्टेप वन: स्क्रिप्ट एआई से लिखवाओ" },
    { "id": "l4", "caption": "Step 2: voice aur captions banao", "spoken": "स्टेप टू: वॉइस और कैप्शन्स बनाओ" },
    { "id": "l5", "caption": "Step 3: scenes jodo aur render karo", "spoken": "स्टेप थ्री: सीन्स जोड़ो और रेंडर करो" },
    { "id": "l6", "caption": "Follow karo aur aise aur tips pao", "spoken": "फॉलो करो और ऐसे और टिप्स पाओ" }
  ],
  "voice": { "engine": "kokoro", "voiceId": "hf_alpha", "speed": 1.0 },
  "cues": [
    { "id": "c1", "atWord": 0, "block": { "type": "title", "text": "AI se video kaise banaye" } },
    { "id": "c2", "atWord": 9, "block": { "type": "bigNumber", "to": 3, "suffix": " steps" } },
    { "id": "c3", "atWord": 14, "block": { "type": "card", "title": "Script", "body": "AI se likhwao", "icon": "✍️" } },
    { "id": "c4", "atWord": 14, "block": { "type": "expression", "expression": "thinking" } },
    { "id": "c5", "atWord": 20, "block": { "type": "card", "title": "Voice + captions", "body": "Kokoro + Whisper", "icon": "🎙️" } },
    { "id": "c6", "atWord": 26, "block": { "type": "card", "title": "Scenes + render", "body": "Remotion se MP4", "icon": "🎬" } },
    { "id": "c7", "atWord": 31, "untilWord": 32, "block": { "type": "sticker", "text": "Easy!" } },
    { "id": "c8", "atWord": 33, "block": { "type": "list", "items": ["Script", "Voice", "Scenes"] } },
    { "id": "c9", "atWord": 33, "block": { "type": "expression", "expression": "wink" } }
  ],
  "keywords": ["AI", "3", "script", "voice", "render"],
  "hashes": {},
  "createdAt": "2026-11-03T13:00:00.000Z",
  "updatedAt": "2026-11-03T13:00:00.000Z"
}
```
