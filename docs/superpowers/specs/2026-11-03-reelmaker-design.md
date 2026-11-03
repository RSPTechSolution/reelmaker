# Reel Maker — Design Spec

Date: 2026-11-03 · Status: approved by owner (Section 1 reviewed in chat; Sections 2–4 are defaults written by Claude — edit before building if anything is wrong)

## 1. Purpose

A **local, single-user** web app for making animated vertical reels in **Hinglish**, driven by an AI agent (Claude Code). One place to go from a topic to a finished MP4: script → voice → captions → scenes → review → render. Inspired by the getanimo.io "AI se video kaise banaye" series (Remotion + Whisper + SVG mascot + word-synced visuals).

Success = a 20–45 s reel goes from topic to MP4 in ~15 minutes of the owner's time, with captions that match the voice word-for-word and nothing hidden under Instagram's UI.

## 2. Constraints

- Runs on the owner's **Windows PC: Intel i5, 16 GB RAM, no GPU**. Everything CPU-only.
- **Free** apart from the owner's existing Claude plan. No paid APIs.
- Agent brain = **Claude Code CLI run headlessly** (`claude -p`) with the owner's login.
- Voice = **Kokoro** (open-weight, CPU) Hindi voices, or an **uploaded recording** of the owner. No voice cloning in v1.
- Video = **Remotion 4** (free for individuals). Output **1080×1920, 30 fps, max 60 s**, H.264 MP4.
- Bound to `127.0.0.1` only. No auth, no multi-user.

## 3. Architecture (Section 1 — reviewed)

| Piece | Folder | Tech | Job |
|---|---|---|---|
| Shared types | `packages/shared` | TypeScript + zod | Reel schema, block types, timing helpers used by every TS package |
| Web app | `packages/web` | Vite + React + TS + Tailwind + React Router + `@remotion/player` | 7-step UI with live preview |
| Server | `packages/server` | Node 20 + Fastify (TS) | Runs steps, stores reels on disk, streams progress (SSE) |
| Video engine | `packages/video` | Remotion 4 | `Reel` composition + block library; same code for preview and render |
| Audio worker | `py/` | Python 3.12, Kokoro, faster-whisper `small` (int8, CPU), numpy | TTS, word timestamps, alignment, loudness. Long-running, JSON-lines over stdin/stdout |
| Agent | — | Claude Code `claude -p --output-format stream-json` | Script writing, scene planning, review fixes |

Storage is plain files: `data/reels/<id>/` (`reel.json`, `lines/*.wav`, `vo.wav`, `words.json`, `loudness.json`, `out/`), `data/brand.json`, `data/mascot.json`, `.claude/skills/reels/SKILL.md` (learned rules).

## 4. Reel flow (Section 2 — default)

1. **Idea** — owner enters topic (+ optional hook, target length 20–60 s). Agent writes the script.
2. **Script** — list of **lines**. Each line has `caption` (Roman Hinglish, shown on screen) and `spoken` (Devanagari, fed to Kokoro). **Both must have the same number of words** — word *i* of `spoken` is word *i* of `caption`. Owner can edit lines or ask the agent to rewrite.
3. **Voice** — Kokoro voice (`hf_alpha` default; `hf_beta`, `hm_omega`, `hm_psi`) and speed (0.8–1.3). Each line is synthesised to its own WAV so a single line can be regenerated. Lines are joined with a 0.15 s gap into `vo.wav`. Alternative: owner uploads their own `vo.wav` (line windows then unknown → alignment over whole file).
4. **Captions/timing** — faster-whisper transcribes `vo.wav` (`language="hi"`, `word_timestamps=True`, `initial_prompt` = the spoken text). Alignment maps Whisper words to the script's spoken words; the **caption word keeps the script's spelling**, Whisper only supplies times. Unmatched words are **filled** (time split by character length inside the gap) and flagged. Report shows matched/filled %. Loudness per frame (RMS, 0–1) is saved for mouth animation.
5. **Scenes** — agent plans **cues**: each cue = a block + the word index that triggers it (+ optional end word). Blocks: `title`, `card`, `bigNumber`, `sticker`, `list`, `expression` (mascot mood change). Owner edits cues in a form list; live Player preview.
6. **Review** — contact sheet (9 frames in a 3×3 grid) with optional safe-zone overlay. Owner chats with the agent ("number bada karo"); agent edits `reel.json` and, when the fix is a general rule, appends it to `SKILL.md`.
7. **Render** — MP4 + cover PNG (frame of owner's choice, default first title) into `out/`. Library lists all reels.

**Staleness:** editing lines invalidates voice and timing; changing voice invalidates timing. Stored as source hashes; UI shows "out of date — regenerate".

## 5. Visual system (Section 3 — default)

- Canvas 1080×1920. **Safe box:** top 220, bottom 380, right 120, left 60 px. All text and the mascot stay inside it.
- Layout: blocks area top half of safe box; mascot bottom-left of safe box (≈ 360 px wide); karaoke captions above the bottom safe edge, 2–5 words per chunk (default 4), spoken word solid, upcoming grey, keywords in accent colour.
- Motion: every block pops in with Remotion `spring()` at its cue frame; the latest block replaces the previous one in the same slot unless it is a `sticker` (overlay).
- Mascot: one built-in SVG robot (colours from `mascot.json`), props `expression` (`happy | thinking | surprised | wink`), `open` (0–1 from loudness), auto-blink every ~3.5 s for 4 frames, idle bob.
- End card: last 1.5 s — handle + "Follow for more".
- Brand: `brand.json` = colours (`bg`, `surface`, `text`, `accent`, `accent2`), Google font (default `Baloo 2`), radius, handle.

## 6. Agent behaviour (Section 4 — default)

- Server spawns `claude -p "<prompt>" --output-format stream-json --verbose` with cwd = repo root, `--allowedTools` limited to `Read`, `Edit(data/reels/<id>/reel.json)`, `Write(data/reels/<id>/reel.json)`, `Edit(.claude/skills/reels/SKILL.md)`; `--disallowedTools Bash WebFetch WebSearch`.
- Three modes, each with a prompt template: `script`, `scenes`, `review`. All prompts tell the agent to read `SKILL.md` and `docs/reel-schema.md` first.
- Before each run the server backs up `reel.json`; after the run it validates with zod. Invalid → restore backup, re-run once with the validation error appended; still invalid → restore and show the error.
- Agent output is streamed to the UI chat panel (assistant text only).

## 7. Errors

- Python worker crash → server restarts it once and fails the current job with the stderr tail.
- `claude` not on PATH / not logged in → setup doctor and agent job report a clear message.
- Whisper match rate < 70 % → timing job succeeds but UI shows a red warning with filled word ranges.
- Reel > 60 s after voice → warning on Voice step; render still allowed.

## 8. Out of scope (v1)

Voice cloning, background music, auto-posting, multiple mascots, multi-user, cloud hosting.
