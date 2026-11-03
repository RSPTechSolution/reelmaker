# Reel Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If those skills are not installed, execute the tasks in order yourself. Steps use checkbox (`- [ ]`) syntax for tracking — tick them as you go.

**Goal:** A local web app where the owner turns a topic into a finished Hinglish 1080×1920 reel (script → Kokoro voice → Whisper-aligned captions → word-cued animated scenes → review → MP4), with Claude Code as the agent.

**Architecture:** npm-workspaces monorepo. `shared` (zod schema + timing helpers) is used by `server` (Fastify, file storage, job runner with SSE, Python bridge, Remotion renderer, Claude Code runner), `video` (Remotion composition + blocks) and `web` (React UI embedding `@remotion/player` with the same composition). A long-running Python worker (`py/`) does TTS, transcription, alignment and loudness over JSON lines.

**Tech Stack:** Node 22.18+ (TypeScript runs via Node's built-in type stripping — no tsx/ts-node; erasable-only TS syntax: no enums/namespaces/parameter properties), TypeScript 5+ (+ `@types/node`, added 2026-11-03 with owner OK), Fastify 5, zod 3, Vite 5 + React 18 + Tailwind 3 + React Router 6, Remotion 4 (`remotion`, `@remotion/cli`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/google-fonts` — **all pinned to the same exact version**), sharp, vitest; Python 3.12, `kokoro`, `soundfile`, `faster-whisper`, `numpy`, pytest.

**Spec:** `docs/superpowers/specs/2026-11-03-reelmaker-design.md`

## Global Constraints

- Target machine: Windows 10/11, Intel i5, 16 GB RAM, **no GPU** — every model runs on CPU.
- Node **≥ 22.18**; `.ts` files run directly with `node file.ts`. Relative imports use the `.ts` extension. (Changed from Node 20 on 2026-11-03 by owner decision, to avoid adding a TS runner dependency.)
- Video: **1080×1920, 30 fps, ≤ 60 s**, H.264 MP4.
- Safe box: **top 220, bottom 380, right 120, left 60** px.
- Kokoro: `KPipeline(lang_code='h')`, sample rate **24000**, default voice **`hf_alpha`**, speed **0.8–1.3** (default 1.0), inter-line gap **0.15 s**.
- Whisper: faster-whisper **`small`**, `device="cpu"`, `compute_type="int8"`, `language="hi"`, `word_timestamps=True`.
- Each script line: `caption` (Roman) and `spoken` (Devanagari) with **equal word counts** (split on whitespace).
- Server binds **127.0.0.1:4000**; web dev server **5173** (proxy `/api` and `/files` to 4000).
- All data under `data/` (git-ignored). Learned rules in `.claude/skills/reels/SKILL.md` (committed).
- Must work with Windows paths containing spaces; spawn processes with argument arrays, never string-concatenated shell commands.
- No paid APIs. No network calls at runtime except Claude Code itself and first-run model downloads.

## Review Focus

1. **Agent writes broken `reel.json`** (bad JSON, unknown block type, word-count mismatch) → reel restored from backup, one retry with the error, then a readable error in the chat panel. Test: Task 9 `rolls back invalid agent edit`.
2. **Whisper skips/mishears words or audio has leading silence** → every script word still gets a time, gaps flagged `filled`, no crash, monotonic times. Tests: Task 3 `fills skipped words`, `times are monotonic`.
3. **Script edited after voice was generated** → Voice/Timing marked stale, render blocked with message until regenerated. Test: Task 5 `marks voice stale when spoken text changes`.
4. **`claude` / `espeak-ng` / Python missing on Windows** → `npm run doctor` and the relevant job say exactly what to install. Test: Task 0 `doctor reports missing tool`.
5. **Long text in a block** (e.g. 80-char card title) → text auto-shrinks to fit the safe box, never overflows. Test: Task 7 `fitText shrinks long text`.

---

### Task 0: Monorepo scaffold + doctor

**Files:**
- Create: `package.json` (workspaces `packages/*`; scripts `setup`, `doctor`, `dev`, `test`, `typecheck`), `tsconfig.base.json`, `.gitignore` (`node_modules`, `data/`, `py/.venv`, `out/`), `.nvmrc` (`22`), `tsconfig.json` (root, includes `scripts/` for `npm run typecheck`)
- Create: `scripts/doctor.ts`, `scripts/setup.ts`
- Create: `README.md` (Windows setup: Node 22.18+, Python 3.12 from python.org with "Add to PATH", **espeak-ng MSI** from github.com/espeak-ng/espeak-ng/releases, Claude Code installed + logged in)
- Test: `scripts/doctor.test.ts`

**Interfaces:**
- Produces: `checkTools(run: (cmd: string, args: string[]) => Promise<{code: number, stdout: string}>): Promise<ToolCheck[]>` where `ToolCheck = {name: 'node'|'python'|'espeak-ng'|'claude', ok: boolean, version?: string, fix?: string}`.

- [x] **Step 1: Write failing tests** — `doctor reports missing tool`: fake `run` returns code 1 for `espeak-ng --version` → that entry `ok: false` and `fix` contains `espeak-ng`; `doctor accepts python 3.12`: stdout `Python 3.12.4` → ok; `doctor rejects python 3.13`: ok false (Kokoro needs < 3.13). On Windows try `py -3.12` before `python`.
- [x] **Step 2:** `npx vitest run scripts` → FAIL.
- [x] **Step 3:** Implement `checkTools`; `doctor.ts` prints a table and exits 1 if any fail. `setup.ts`: `npm install`, create `py/.venv` with Python 3.12, `pip install -r py/requirements.txt`, then run `py/warmup.py` (downloads Kokoro + whisper `small`), create `data/brand.json` and `data/mascot.json` from defaults if missing.
- [x] **Step 4:** Tests PASS; `npm run doctor` prints the table.
- [x] **Step 5:** `git init && git add -A && git commit -m "chore: scaffold monorepo and doctor"`

### Task 1: Shared schema and timing helpers

**Files:**
- Create: `packages/shared/src/schema.ts`, `packages/shared/src/timing.ts`, `packages/shared/src/defaults.ts`, `packages/shared/src/index.ts`
- Create: `docs/reel-schema.md` (human/agent-readable description of `reel.json` with one full example — the agent reads this)
- Test: `packages/shared/src/schema.test.ts`, `packages/shared/src/timing.test.ts`

**Interfaces:**
- Produces (zod schemas + inferred types):
  - `Line = {id: string, caption: string, spoken: string}` — refinement: word counts equal (error message `line <id>: caption has X words, spoken has Y`).
  - `Block` discriminated on `type`: `title{text}`, `card{title, body?, icon?}`, `bigNumber{to: number, prefix?, suffix?}`, `sticker{text}`, `list{items: string[] (1–5)}`, `expression{expression: 'happy'|'thinking'|'surprised'|'wink'}`.
  - `Cue = {id, atWord: number (int ≥0), untilWord?: number, block: Block}`.
  - `VoiceSettings = {engine: 'kokoro'|'upload', voiceId: 'hf_alpha'|'hf_beta'|'hm_omega'|'hm_psi', speed: number (0.8–1.3)}`.
  - `WordTiming = {i: number, caption: string, spoken: string, start: number, end: number, filled: boolean}`.
  - `Reel = {id, title, topic, hook?, targetSeconds (20–60), lines: Line[], voice: VoiceSettings, cues: Cue[], keywords: string[], coverFrame?: number, hashes: {voice?: string, timing?: string}, createdAt, updatedAt}` — refinement: every `cue.atWord` < total word count.
  - `Brand = {bg, surface, text, accent, accent2, font, radius, handle}`, `MascotConfig = {body, face, accent, signature: 'antenna'|'glasses'|'cap'}`.
  - `ReelProps = {reel: Reel, words: WordTiming[], loudness: number[], brand: Brand, mascot: MascotConfig, audioSrc: string|null, debugSafeZones?: boolean}`.
- Produces (functions): `FPS = 30`, `WIDTH = 1080`, `HEIGHT = 1920`, `SAFE = {top:220,bottom:380,right:120,left:60}`; `wordFrame(words: WordTiming[], i: number, fallbackSec: number): number`; `durationInFrames(words: WordTiming[]): number` (= ceil((lastEnd + 0.8 + 1.5) × 30), min 90); `spokenHash(reel: Reel): string` (sha1 of lines' spoken + voice settings); `chunkWords(words, perChunk = 4): WordTiming[][]`.

- [ ] **Step 1: Write failing tests:** `rejects word-count mismatch` (caption "AI se video" vs spoken "एआई से" → error message contains `caption has 3 words, spoken has 2`); `accepts valid example` (parse the example from `docs/reel-schema.md` saved as `fixtures/example-reel.json`); `rejects cue beyond last word`; `wordFrame uses fallback when index missing` (→ fallbackSec×30); `durationInFrames adds tail` (last end 10.0 s → 369); `spokenHash changes when spoken text changes but not when caption changes`; `chunkWords splits 10 words into 4,4,2`.
- [ ] **Step 2:** `npx vitest run packages/shared` → FAIL.
- [ ] **Step 3:** Implement schemas/helpers; `defaults.ts` exports `defaultBrand` (bg `#F5F5F2`, surface `#FFFFFF`, text `#14161A`, accent `#2B6CF6`, accent2 `#12B886`, font `Baloo 2`, radius 32, handle `@yourhandle`) and `defaultMascot` (body `#FF8A3D`, face `#1FD1E0`, accent `#FFD23F`, signature `antenna`).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat(shared): reel schema and timing helpers`.

### Task 2: Python worker protocol + loudness

**Files:**
- Create: `py/requirements.txt` (`kokoro>=0.9`, `soundfile`, `faster-whisper`, `numpy`, `pytest`), `py/worker.py`, `py/ops/loudness.py`, `py/warmup.py`
- Test: `py/tests/test_loudness.py`, `py/tests/test_worker.py`

**Interfaces:**
- Produces protocol (one JSON object per line, UTF-8):
  - request `{"id": str, "op": str, "args": {...}}`
  - progress `{"id": str, "progress": float 0–1, "message": str}`
  - result `{"id": str, "ok": true, "result": {...}}` or `{"id": str, "ok": false, "error": str}`
  - on start the worker prints `{"ready": true}`. Unknown op → `ok:false, error:"unknown op <op>"`. Exceptions never kill the loop.
- Produces op `loudness` args `{wav: str, out: str, fps: 30}` → result `{frames: int}`; writes JSON array of floats 0–1 (per-frame RMS, normalised by the 95th percentile, clipped to 1, 2-frame moving average).

- [ ] **Step 1: Failing tests:** `test_loudness_silence_is_zero` (1 s of zeros → 30 values all 0); `test_loudness_tone_is_high` (1 s 440 Hz sine at 0.5 → median > 0.8); `test_worker_unknown_op` (spawn `worker.py`, send unknown op → `ok` false, process still alive, next valid request answered).
- [ ] **Step 2:** `py/.venv/Scripts/python -m pytest py/tests -q` → FAIL.
- [ ] **Step 3:** Implement. Set `sys.stdout.reconfigure(encoding="utf-8")` (Windows console default is not UTF-8). `warmup.py` instantiates `KPipeline(lang_code='h')` and `WhisperModel("small", device="cpu", compute_type="int8")` once.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat(py): worker protocol and loudness op`.

### Task 3: Alignment (pure function)

**Files:**
- Create: `py/ops/align.py`
- Test: `py/tests/test_align.py`

**Interfaces:**
- Produces `align(script_words: list[dict], whisper_words: list[dict], windows: list[tuple[float,float]] | None, audio_end: float) -> dict`
  - `script_words`: `[{i, caption, spoken, line}]`; `whisper_words`: `[{word, start, end}]`; `windows`: per-line `(start,end)` in seconds or `None` (uploaded audio).
  - returns `{"words": [WordTiming...], "matched": int, "filled": int, "filledRanges": [[i0,i1,start,end]...]}`.
- Algorithm: normalise both sides (strip punctuation incl. `।`, NFC, lowercase); if `windows` given, align each line only against Whisper words whose midpoint is inside that window, else whole file. Use `difflib.SequenceMatcher` on normalised token lists; equal blocks → matched (take Whisper times); for each run of unmatched script words, take the gap between the previous matched end (or window start) and next matched start (or window end) and split it in proportion to `len(spoken)`; mark `filled: true`. Finally enforce monotonic `start ≤ end ≤ next.start`.

- [ ] **Step 1: Failing tests:** `test_exact_match` (3 words, identical → matched 3, times copied); `test_fills_skipped_words` (Whisper missing middle word → filled 1, its start = prev end, end = next start); `test_times_are_monotonic` (random Whisper jitter with overlaps → for all k, `start[k] ≤ end[k] ≤ start[k+1]`); `test_windows_restrict_matching` (same word in two lines matches inside its own window); `test_no_whisper_words` (empty list → all filled, evenly spread over window, no exception).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `align`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(py): caption alignment with gap filling`.

### Task 4: TTS and transcription ops

**Files:**
- Create: `py/ops/tts.py`, `py/ops/transcribe.py`; Modify: `py/worker.py` (register ops)
- Test: `py/tests/test_tts_smoke.py`, `py/tests/test_transcribe_smoke.py` (marked `@pytest.mark.slow`)

**Interfaces:**
- op `tts` args `{lines: [{id, spoken}], voice: str, speed: float, dir: str, only?: [lineId]}` → writes `dir/lines/<id>.wav` (only the listed ids if `only`), then concatenates **all** line WAVs in order with 0.15 s silence into `dir/vo.wav`; result `{windows: [[start,end]...], duration: float}`. Emits progress per line. Uses `KPipeline(lang_code='h')` created once per worker; joins all audio chunks the generator yields for a line.
- op `timing` args `{dir: str, words: [{i, caption, spoken, line}], windows: [[s,e]]|null, prompt: str}` → runs faster-whisper on `dir/vo.wav` (`language="hi"`, `word_timestamps=True`, `initial_prompt=prompt`, `vad_filter=False`), calls `align`, writes `dir/words.json`, runs `loudness` to `dir/loudness.json`; result = align report minus `words`.

- [ ] **Step 1: Failing smoke tests:** `test_tts_writes_vo` (2 short lines `["नमस्ते दोस्तों", "आज हम सीखेंगे"]` → `vo.wav` exists, 24000 Hz, duration ≈ sum(lines)+0.15 ±0.05, 2 windows); `test_tts_only_regenerates_listed_line` (mtime of untouched line WAV unchanged); `test_timing_end_to_end` (on the vo.wav above → `words.json` has 5 entries, `matched ≥ 3`).
- [ ] **Step 2:** `pytest -m slow` → FAIL.
- [ ] **Step 3:** Implement. If Kokoro raises because espeak-ng is missing, re-raise as `espeak-ng not found — install it (see README)`.
- [ ] **Step 4:** PASS (expect ~1–2 min on CPU first run).
- [ ] **Step 5:** Commit `feat(py): kokoro tts and whisper timing ops`.

### Task 5: Server core — storage, REST, jobs, SSE

**Files:**
- Create: `packages/server/src/app.ts` (build Fastify app, no listen), `src/main.ts` (listen 127.0.0.1:4000), `src/store.ts`, `src/jobs.ts`, `src/routes/reels.ts`, `src/routes/settings.ts`, `src/routes/jobs.ts`, `src/paths.ts`
- Test: `packages/server/src/store.test.ts`, `src/routes/reels.test.ts`, `src/jobs.test.ts`

**Interfaces:**
- `paths.ts`: `DATA_DIR` (env `REEL_DATA_DIR` or `<repo>/data`), `reelDir(id)`, `reelFile(id)`.
- `store.ts`: `createReel(input: {topic, hook?, targetSeconds?}): Promise<Reel>` (id = `yyyymmdd-hhmm-<slug>`), `getReel(id)`, `listReels(): Promise<ReelSummary[]>` (`{id,title,updatedAt,status}`), `saveReel(reel)` (zod-validate, atomic write via temp file + rename), `backupReel(id)`, `restoreReel(id)`, `getBrand/saveBrand`, `getMascot/saveMascot`, `reelStatus(reel, files): {script: bool, voice: 'none'|'ok'|'stale', timing: 'none'|'ok'|'stale', rendered: bool}` (stale = stored hash ≠ `spokenHash(reel)`).
- `jobs.ts`: `startJob(kind: string, reelId: string, fn: (ctx: {progress(p: number, msg?: string): void, log(text: string): void}) => Promise<unknown>): Job`; `getJob(id)`; `subscribe(id, listener)`. One running job per reel (second → HTTP 409).
- Routes: `POST /api/reels`, `GET /api/reels`, `GET /api/reels/:id` (→ `{reel, status, words?, report?}`), `PUT /api/reels/:id` (400 with zod issues on invalid), `GET/PUT /api/brand`, `GET/PUT /api/mascot`, `GET /api/jobs/:id/events` (SSE: `progress`, `log`, `done`, `error` events), static `/files/` → `DATA_DIR/reels`.

- [ ] **Step 1: Failing tests** (use `app.inject`, temp `REEL_DATA_DIR`): `creates and lists a reel`; `PUT rejects word-count mismatch with 400`; `saveReel is atomic` (no `.tmp` left behind); `marks voice stale when spoken text changes` (save hashes.voice, edit spoken → status.voice `stale`; edit caption only → `ok`); `second job on same reel returns 409`; `SSE stream ends with done`.
- [ ] **Step 2:** `npx vitest run packages/server` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(server): storage, REST API and job runner`.

### Task 6: Python bridge + voice/timing endpoints

**Files:**
- Create: `packages/server/src/python.ts`, `src/routes/audio.ts`
- Test: `packages/server/src/python.test.ts` (uses a fake worker script `test/fake-worker.py` that echoes), `src/routes/audio.test.ts` (bridge mocked)

**Interfaces:**
- `python.ts`: `class PyWorker { start(): Promise<void>; call<T>(op: string, args: object, onProgress?: (p: number, msg: string) => void): Promise<T>; stop(): void }` — spawns `py/.venv/Scripts/python.exe` (Windows) or `py/.venv/bin/python`, args `['-u', 'py/worker.py']`, `env.PYTHONIOENCODING='utf-8'`; waits for `{"ready":true}`; matches responses by id; on exit restarts once and rejects in-flight calls with the last 20 stderr lines.
- Routes (each starts a job, returns `{jobId}`):
  - `POST /api/reels/:id/voice` body `{only?: string[]}` → `tts`, then sets `reel.hashes.voice = spokenHash(reel)`, stores windows in `data/reels/<id>/windows.json`.
  - `POST /api/reels/:id/voice/upload` (multipart wav/mp3/m4a, ≤ 50 MB) → saves as `vo.wav` (convert via ffmpeg bundled in Remotion: `npx remotion ffmpeg -i in -ar 24000 -ac 1 vo.wav`), sets `voice.engine='upload'`, deletes `windows.json`.
  - `POST /api/reels/:id/timing` → `timing` with `prompt` = all spoken text joined, sets `hashes.timing = spokenHash(reel)`, stores report in `report.json`. Refuses (409 `voice is stale`) if voice is stale.

- [ ] **Step 1: Failing tests:** `call resolves by id with progress`; `worker crash rejects in-flight call with stderr tail`; `timing refuses when voice stale`; `voice job sets voice hash`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; worker is started lazily on first call and shared.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(server): python bridge, voice and timing jobs`.

### Task 7: Video engine (Remotion composition + blocks)

**Files:**
- Create: `packages/video/src/Root.tsx` (registers composition `Reel` with `calculateMetadata` → `durationInFrames(words)`), `src/Reel.tsx`, `src/blocks/{Title,Card,BigNumber,Sticker,List}.tsx`, `src/Karaoke.tsx`, `src/Mascot.tsx`, `src/EndCard.tsx`, `src/SafeZones.tsx`, `src/layout.ts`, `src/fonts.ts`, `src/index.ts` (`registerRoot` only — Remotion entry), `src/exports.ts` (package main: re-exports `Reel`, `Mascot`, `REEL_COMPOSITION_ID`, `activeCues`, `fitText` for web and server), `remotion.config.ts`
- Test: `packages/video/src/layout.test.ts`, `src/cues.test.ts`

**Interfaces:**
- Consumes: `ReelProps`, `SAFE`, `wordFrame`, `chunkWords` (Task 1).
- Produces: `export const Reel: React.FC<ReelProps>` and `export const REEL_COMPOSITION_ID = 'Reel'` (imported by web Player and server renderer); `activeCues(cues, words, frame): {main?: Cue, stickers: Cue[], expression: Expression}` — main = latest started non-sticker/non-expression cue whose `untilWord` (if any) hasn't passed; expression = latest started `expression` cue or `'happy'`; `fitText(text: string, maxWidth: number, maxFontPx: number, minFontPx = 36): number` (approx width = chars × 0.55 × font; shrink until fits or min; wraps allowed up to 3 lines).
- Rendering rules: from spec §5 (block slot = top half of safe box; mascot bottom-left 360 px wide with `open = loudness[frame]`, blink 4 frames every 105 frames, bob `sin(frame/20)*8px`; Karaoke 4 words/chunk, spoken word `brand.text`, upcoming `#9A9A9A`, keywords `brand.accent`; EndCard last 45 frames; `<Audio src={audioSrc}>` when not null; `SafeZones` overlay when `debugSafeZones`). Font loaded via `@remotion/google-fonts` by `brand.font` (fallback `Baloo2`).
- Mascot: SVG robot (round head, face screen with dot eyes, antenna with glowing tip, stubby arms in front of body) coloured from `MascotConfig`; expressions change eyes/brows/mouth shape.

- [ ] **Step 1: Failing tests:** `fitText shrinks long text` (80 chars, maxWidth 900, max 96 → < 96 and ≥ 36); `fitText keeps short text at max`; `activeCues picks latest main cue`; `activeCues keeps sticker overlays alongside main`; `activeCues ends cue after untilWord`; `expression defaults to happy`.
- [ ] **Step 2:** `npx vitest run packages/video` → FAIL.
- [ ] **Step 3:** Implement components and helpers. Add `packages/video/fixtures/demo-props.json` (example reel from Task 1 + fake words/loudness) as `defaultProps`.
- [ ] **Step 4:** Tests PASS; `npx remotion still Reel out/demo.png --frame=60 --props=fixtures/demo-props.json` writes a PNG; open it and check nothing crosses the safe box (render again with `debugSafeZones: true`).
- [ ] **Step 5:** Commit `feat(video): reel composition, blocks, karaoke and mascot`.

### Task 8: Render service (MP4, cover, contact sheet)

**Files:**
- Create: `packages/server/src/render.ts`, `src/routes/render.ts`
- Test: `packages/server/src/render.test.ts`

**Interfaces:**
- `render.ts`: `getServeUrl(): Promise<string>` (bundles `packages/video/src/index.ts` once with `@remotion/bundler`, cached; rebundle when `?rebundle=1`); `buildProps(id): Promise<ReelProps>` (reads reel, words, loudness, brand, mascot; `audioSrc = http://127.0.0.1:4000/files/<id>/vo.wav`); `renderReel(id, onProgress)` → `out/reel.mp4` via `renderMedia({codec:'h264'})`; `renderCover(id)` → `out/cover.png` at `reel.coverFrame ?? wordFrame(words, firstCue.atWord, 0) + 10`; `contactFrames(total: number, n = 9): number[]` (evenly spaced, excluding last 10 frames); `renderContactSheet(id, debugSafeZones: boolean)` → 9 stills at 360×640 combined with `sharp` into `out/contact.png` (3×3, 1080×1920, frame number label not required).
- Routes: `POST /api/reels/:id/contact-sheet` `{debugSafeZones?: boolean}`, `POST /api/reels/:id/render` → jobs. Both 409 if timing missing or stale.

- [ ] **Step 1: Failing tests:** `contactFrames returns 9 increasing frames within range` (total 900 → first 0, last ≤ 889); `buildProps fails clearly without words.json` (error `run Captions step first`); slow test `renders a 3-second demo mp4` (fixture props trimmed to 90 frames → file > 10 KB).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Call `ensureBrowser()` from `@remotion/renderer` before first render (downloads Chrome Headless Shell on first run).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(server): render mp4, cover and contact sheet`.

### Task 9: Agent runner (Claude Code headless)

**Files:**
- Create: `packages/server/src/agent/run.ts`, `src/agent/prompts.ts`, `src/routes/agent.ts`, `.claude/skills/reels/SKILL.md`
- Test: `packages/server/src/agent/run.test.ts` (spawn function injected; fake emits stream-json lines)

**Interfaces:**
- `buildClaudeArgs(reelId: string, prompt: string): string[]` → `['-p', prompt, '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Read', 'Edit(data/reels/<id>/reel.json)', 'Write(data/reels/<id>/reel.json)', 'Edit(.claude/skills/reels/SKILL.md)', '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch']`, cwd = repo root. On Windows spawn `claude.cmd` if `claude` isn't directly executable (resolve once via `where claude`).
- `runAgent(opts: {reelId, mode: 'script'|'scenes'|'review', instruction?: string, onText: (t: string) => void, spawnFn?}): Promise<{ok: true} | {ok: false, error: string}>` — backup reel → run → parse stream lines (`type: "assistant"` text blocks → `onText`; `type: "result"` → finish) → validate with zod → on failure restore, retry once with prompt + `\n\nYour last edit was invalid: <zod message>. Fix reel.json.` → on second failure restore and return error.
- `prompts.ts`: `scriptPrompt(reel)`, `scenesPrompt(reel, words)`, `reviewPrompt(reel, instruction)`. Every prompt: read `.claude/skills/reels/SKILL.md` and `docs/reel-schema.md`; edit only `data/reels/<id>/reel.json`; script mode rules — Hinglish, hook in first line, 6–10 lines, ~2.3 words/s × targetSeconds total words, every line written twice (`caption` Roman, `spoken` Devanagari) with identical word counts, English tech words transliterated in `spoken` (e.g. "AI" → "एआई"); scenes mode — a new main cue every 2–3 s, first cue at word 0 is a `title`, numbers → `bigNumber`, 1–2 `sticker`s max, 1–3 `expression` changes, set `keywords`; review mode — apply the instruction, and if it is a reusable rule append one line to SKILL.md under `## Learned rules`.
- Route: `POST /api/reels/:id/agent` `{mode, instruction?}` → job; agent text streamed as SSE `log` events.
- `SKILL.md` seed: house style (short punchy Hinglish, numbers as digits in caption, no emojis in spoken), cue rules above, `## Learned rules` (empty).

- [ ] **Step 1: Failing tests:** `buildClaudeArgs restricts edits to the reel file` (args include `Edit(data/reels/abc/reel.json)` and `Bash` after `--disallowedTools`); `streams assistant text` (fake emits two assistant lines → onText called twice); `rolls back invalid agent edit` (fake writes invalid JSON both runs → result `ok:false`, reel.json equals backup, spawn called twice); `accepts valid edit` (fake writes valid reel → ok, file changed); `reports claude missing` (spawn ENOENT → error contains `Claude Code not found`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS. Manual check: create a reel via API, `POST /agent {mode:"script"}` → reel.json has valid lines.
- [ ] **Step 5:** Commit `feat(server): claude code agent runner with rollback`.

### Task 10: Web shell, Library, Brand and Mascot pages

**Files:**
- Create: `packages/web/` (Vite React TS + Tailwind), `src/main.tsx`, `src/App.tsx` (routes `/`, `/reels/:id/:step`, `/brand`, `/mascot`), `src/api.ts`, `src/useJob.ts`, `src/pages/Library.tsx`, `src/pages/Brand.tsx`, `src/pages/Mascot.tsx`, `src/components/Preview.tsx`
- Test: `packages/web/src/useJob.test.ts`, `src/api.test.ts`

**Interfaces:**
- `api.ts`: typed fetch wrappers for every route in Tasks 5–9 (throws `ApiError{status, message, issues?}`).
- `useJob(jobId: string | null): {status: 'idle'|'running'|'done'|'error', progress: number, message?: string, logs: string[], error?: string}` over `EventSource('/api/jobs/<id>/events')`.
- `Preview`: `@remotion/player` `<Player component={Reel} inputProps={props} durationInFrames compositionWidth={1080} compositionHeight={1920} fps={30} controls style={{width: 360}} />` with a "Safe zones" toggle.
- Library: list cards (title, updated, status badges), "New reel" form (topic, hook, target seconds) → create → run `agent script` → navigate to `/reels/<id>/script`.
- Brand: form for `Brand` fields + live Preview of demo props. Mascot: colour pickers + signature select + 4-expression preview grid (Mascot component from `video`).

- [ ] **Step 1: Failing tests:** `useJob collects logs and finishes` (mock EventSource); `api throws ApiError with zod issues on 400`.
- [ ] **Step 2:** `npx vitest run packages/web` → FAIL.
- [ ] **Step 3:** Implement. Vite config: proxy `/api` and `/files` → `http://127.0.0.1:4000`; alias `@reelmaker/video` to the workspace package.
- [ ] **Step 4:** PASS; `npm run dev` (root script runs server + web concurrently) → Library loads, Brand changes show in the preview.
- [ ] **Step 5:** Commit `feat(web): shell, library, brand and mascot pages`.

### Task 11: Reel editor — Script, Voice, Captions steps

**Files:**
- Create: `packages/web/src/pages/ReelEditor.tsx` (stepper: Script · Voice · Captions · Scenes · Review · Render, with status badges from `GET /api/reels/:id` and stale warnings), `src/steps/ScriptStep.tsx`, `src/steps/VoiceStep.tsx`, `src/steps/CaptionsStep.tsx`, `src/components/AgentChat.tsx`
- Test: `packages/web/src/steps/ScriptStep.test.tsx`

**Interfaces:**
- ScriptStep: table of lines (caption input, spoken input, live word counts, red if unequal), add/remove/reorder lines, Save (`PUT`), "Ask agent" box → `agent script` with instruction. Shows estimated duration (total words / 2.3).
- VoiceStep: voice select (4 voices), speed slider 0.8–1.3, "Generate all", per-line ▶ play (`/files/<id>/lines/<lineId>.wav`) and ↻ regenerate (`only:[lineId]`), upload own recording, total duration with > 60 s warning.
- CaptionsStep: "Sync captions" → timing job; report (matched %, filled %, red banner < 70 %), word list with filled words highlighted and clickable to play from `start`; keyword toggles (writes `reel.keywords`).
- AgentChat: reusable panel — input, streamed log lines, disabled while job running.

- [ ] **Step 1: Failing test:** `ScriptStep flags word-count mismatch and disables Save`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; manual: create reel → script → voice → captions works end-to-end on the Windows machine.
- [ ] **Step 5:** Commit `feat(web): script, voice and captions steps`.

### Task 12: Reel editor — Scenes, Review, Render steps

**Files:**
- Create: `packages/web/src/steps/ScenesStep.tsx`, `src/steps/ReviewStep.tsx`, `src/steps/RenderStep.tsx`, `src/components/CueEditor.tsx`
- Test: `packages/web/src/components/CueEditor.test.tsx`

**Interfaces:**
- ScenesStep: "Plan scenes with agent" (`agent scenes`), cue list sorted by `atWord`; each row = word picker (dropdown of caption words with times), block-type select, fields per block type, delete; Preview on the right, clicking a cue seeks the Player to its frame.
- ReviewStep: "Make contact sheet" (+ safe-zone toggle) → shows `/files/<id>/out/contact.png?t=<ts>`; AgentChat in `review` mode; after each agent run, contact sheet auto-regenerates.
- RenderStep: cover frame picker (scrub Player, "Use this frame"), "Render MP4" with progress bar, download links for `reel.mp4` and `cover.png`, video element playing the result.

- [ ] **Step 1: Failing test:** `CueEditor switching block type resets fields to valid defaults` (title → bigNumber gives `{type:'bigNumber', to:0}`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): scenes, review and render steps`.

### Task 13: End-to-end verification on Windows

**Files:**
- Modify: `README.md` (quick start, troubleshooting: espeak-ng, `claude` login, first-run downloads, slow first render)
- Create: `docs/e2e-checklist.md`

- [ ] **Step 1:** Fresh clone → `npm run setup` → `npm run doctor` all green.
- [ ] **Step 2:** `npm test` (all vitest + `pytest -m "not slow"`) PASS; `npm run typecheck` clean; `pytest -m slow` PASS.
- [ ] **Step 3:** In the app, make a reel on topic "AI se video kaise banaye — 3 tips", target 30 s: script by agent → voice `hf_alpha` → captions (matched ≥ 80 %) → scenes by agent → contact sheet with safe zones → one review instruction ("number aur bada karo") → render. Record timings for each step in `docs/e2e-checklist.md`.
- [ ] **Step 4:** Check the MP4: 1080×1920, 30 fps, ≤ 60 s, captions match voice word-for-word, nothing inside the safe-zone margins, mouth moves with voice.
- [ ] **Step 5:** Commit `docs: e2e checklist and README`.
