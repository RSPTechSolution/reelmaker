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

## Blocks (`block.type`)

| type | fields | use for |
|---|---|---|
| `title` | `text` | Big headline. The first cue (word 0) is always a title. |
| `card` | `title`, `body?`, `icon?` (one emoji) | A point with a short explanation. |
| `bigNumber` | `to` (number), `prefix?`, `suffix?` | Counts up to a number, e.g. `{"to": 90, "suffix": "%"}`. |
| `sticker` | `text` | Small overlay that sits on top of the main block (max 1–2 per reel). |
| `list` | `items` (1–5 strings) | Short recap. |
| `expression` | `expression`: `happy` \| `thinking` \| `surprised` \| `wink` \| `excited` \| `laughing` \| `shocked` \| `sad` | Changes the mascot's face; shows nothing else. |

`title`, `card`, `bigNumber` and `list` are **main** blocks: each new one replaces the previous one. `sticker` and `expression` do not replace anything.

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
