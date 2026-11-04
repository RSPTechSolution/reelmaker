# Reel Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each reel one of 11 themes (10 new looks plus `classic`) that restyles the whole reel, with stickman poses and objects that act out the words, and produce one voiced sample MP4 per theme.

**Architecture:**
- **Theme metadata lives in `@reelmaker/shared`**, because the server prompt, the web app and `effectSettings` all need it. This covers ids, labels, effect defaults and the meanings of poses and props.
- **Theme visuals live in `packages/video/src/themes/`.** `resolveTheme(id, brand)` returns a `ResolvedTheme` whose `brand` field keeps today's blocks working, plus theme-specific styles.
- **Drawings are pure SVG components in `packages/video/src/drawings/`.** They take the frame as a prop and use no Remotion hooks, so they can be unit-tested with `renderToStaticMarkup`.
- **A new main block, `scene`, places the drawings.** The samples script drives the running app's HTTP API.

**Tech Stack:** TypeScript (Node ≥ 22.18 type stripping, `.ts` import extensions), zod 4.6.7, React 18.3.1, Remotion 4.0.540, `@remotion/google-fonts`, vitest 5, jsdom + testing-library, Fastify 5.

**Spec:** `docs/superpowers/specs/2026-11-04-reel-themes-design.md`. It builds on `docs/superpowers/specs/2026-11-03-reelmaker-design.md`.

## Global Constraints

- Windows i5, 16 GB, no GPU. CPU-only. Windows-safe paths. Spawn processes with argument arrays.
- No new npm or Python dependency, no paid API, no cloud service. Fonts come only from `@remotion/google-fonts` via `loadBrandFont`.
- All `remotion` / `@remotion/*` packages stay at exactly `4.0.540`.
- Test first. One commit per task. Commits use the repo-local git identity (`ratanp256@gmail.com`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Stop and ask the owner before any schema change beyond Task 1, any new dependency, or skipping a test.
- Old reels (no `theme`, no `scene` blocks) must validate and render exactly as before (`classic`).
- `theme` is not part of `spokenHash`.
- Spoken words and keywords need contrast ≥ 4.5:1 against the theme's caption backdrop. Upcoming words need ≥ 3:1. `classic` is exempt.
- Text, drawings and the presenter stay inside `SAFE_BOX`. Only background texture may fill the frame.
- No `Math.random` at render time. Every motion is a function of the frame. No animated SVG filters (no `feTurbulence` that changes per frame).
- Render time per theme must be ≤ 130 % of `classic` for the sample reel.
- After each task: run `npm test` and `npm run typecheck` (both clean), show the owner the results, and wait for their OK.

## Review Focus

1. **Theme fonts wider than Baloo 2** (Bangers, Fredoka) overflow cards and captions, because `fitText` assumes a fixed glyph width. Expected: text still fits. **Pinned in:** Task 2 (`charWidth` per theme) and Task 5 (`fitText` takes it).
2. **The agent writes a pose or prop name that isn't in the list** (`"money"`, `"stickman"`). Expected: the edit is rejected and rolled back, and the error names the cue field. **Pinned in:** Task 7.
3. **A scene block left empty** (no pose, no props, no text) after editing. Expected: the schema rejects it, and the editor never produces it. **Pinned in:** Task 1 and Task 9.
4. **Switching theme on a reel that already has explicit `effects`.** Expected: transition and caption style become the new theme's defaults, and `emotion` is kept. **Pinned in:** Task 8.
5. **The owner uses "My character" (`mascot.kind = 'image'`) with a stickman-presenter theme.** Expected: the stickman presents, and `mascot.json` is untouched. **Pinned in:** Task 5.

---

### Task 1: Schema — theme, poses, props, scene block

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Create: `packages/shared/src/themes.ts`
- Create: `packages/shared/src/drawings.ts`
- Modify: `packages/shared/src/effects.ts`
- Modify: `packages/shared/src/index.ts` (or the package's export file)
- Modify: `packages/server/src/agent/run.ts` (`readAgentEdit`)
- Modify: `docs/reel-schema.md`
- Test: `packages/shared/src/themes.test.ts`
- Test: `packages/server/src/agent/run.test.ts`

**Interfaces:**
- Produces (in `schema.ts`):
  - `ThemeId = z.enum(['classic','stickman','objects','chalkboard','comic','neon','paper','notebook','bold','news','bollywood'])`
  - `Pose = z.enum(['thinking','pointing','shrug','running','celebrate','facepalm','explain','laptop','wave','sad','shocked','idea'])`
  - `Prop = z.enum(['phone','coins','rocket','chartUp','chartDown','clock','bulb','heart','lock','moneyBag','trophy','warning','gift','camera','laptop','book','fire','star','check','cross','calendar','chat','search','target'])`
  - A new `Block` variant: `{ type: 'scene', pose?: Pose, props?: Prop[] (max 3), text?: string }`. It must have at least one of `pose`, a non-empty `props`, or a non-empty trimmed `text`. The error message is `"scene needs a pose, a prop or text"`. Keep `Block` a discriminated union: put the check in `Cue`'s or `Reel`'s `superRefine`, or wrap the scene object in a refine if zod 4 allows that inside `discriminatedUnion`.
  - `Reel.theme?: ThemeId`
  - Type exports for `ThemeId`, `Pose`, `Prop`.
- Produces (in `themes.ts`):
  - `THEME_INFO: Record<ThemeId, { label: string; description: string; transition: EffectSettings['transition']; captions: EffectSettings['captions']; acts: boolean }>`. `acts` is `true` for `stickman`, `objects`, `chalkboard` and `notebook`.
  - `reelTheme(reel: Pick<Reel,'theme'>): ThemeId`. Returns `'classic'` when `theme` is unset.
  - Labels:
    - `classic`: Classic
    - `stickman`: Stickman story
    - `objects`: Animated objects
    - `chalkboard`: Chalkboard
    - `comic`: Comic
    - `neon`: Neon tech
    - `paper`: Paper cut-out
    - `notebook`: Notebook doodle
    - `bold`: Bold typography
    - `news`: Breaking news
    - `bollywood`: Retro Bollywood
  - `classic` defaults are `slide` / `pop`. The other themes' defaults are the builder's call, but they must differ across themes (for example comic `zoom`/`bounce`, news `slide`/`color`).
- Produces (in `drawings.ts`):
  - `POSE_MEANING: Record<Pose,string>`, a one-line meaning per pose (for example `thinking`: "a question, wondering, planning").
  - `PROP_MEANING: Record<Prop,string>` (for example `coins`: "money, price, earning, saving").
- Produces (in `effects.ts`):
  - `effectSettings(reel: Pick<Reel,'effects'|'theme'>): EffectSettings`. Returns `reel.effects` when set. Otherwise returns `{ transition, captions }` from `THEME_INFO[reelTheme(reel)]` with `emotion: true`.
  - `effectsForTheme(current: EffectSettings | undefined, theme: ThemeId): EffectSettings`. Returns the theme's transition and captions, with `emotion` taken from `current` (or `true`).

- [x] **Step 1: Write the failing tests**

In `themes.test.ts`:
- `old reels without theme are classic and still valid`: parse an existing fixture reel and expect `reelTheme(r) === 'classic'`.
- `scene block accepts pose, props or text`: three valid cues.
- `empty scene block is rejected`: `{type:'scene'}`, `{type:'scene',props:[]}` and `{type:'scene',text:'  '}` each fail. The issue message contains `scene needs a pose, a prop or text`.
- `scene block allows at most 3 props`: 4 props fail.
- `unknown theme, pose or prop is rejected`.
- `THEME_INFO covers every ThemeId and every pose and prop has a meaning`: `Object.keys` equals the enum options.
- `effectSettings falls back to the theme defaults`: `{theme:'comic'}` gives comic's defaults, and `{effects:X, theme:'comic'}` gives `X`.
- `effectsForTheme keeps emotion`: `effectsForTheme({transition:'whip',captions:'color',emotion:false}, 'news')` gives news's transition and captions with `emotion:false`.
- `spokenHash ignores theme`.

In `run.test.ts`:
- `agent edit keeps theme`: follow the existing "keeps audio and effects" test. The backup has `theme:'neon'`, the edit omits it, and the merged reel has `'neon'`.

- [x] **Step 2: Run the tests to make sure they fail**

Run: `npx vitest run packages/shared/src/themes.test.ts packages/server/src/agent/run.test.ts`
Expected: FAIL (imports missing).

- [x] **Step 3: Implement the schema, `themes.ts`, `drawings.ts`, the `effects.ts` changes and the `readAgentEdit` merge**

In `readAgentEdit`, add `...(edit.theme === undefined && backup.theme ? { theme: backup.theme } : {})`.

In `docs/reel-schema.md`:
- add a `theme` row to the top-level table;
- add a `scene` block section with the full pose and prop lists and their meanings;
- update the `effects` default sentence to say "default: the theme's transition and caption style".

- [x] **Step 4: Run the tests and make sure they pass**

Run: `npm test && npm run typecheck`
Expected: all pass. Any exhaustive `switch (block.type)` that typecheck now flags gets a `case 'scene'`, returning `null` for now. Task 9 replaces the one in `CueEditor.tsx`.

- [x] **Step 5: Commit**

Message: `feat(shared): reel theme, poses, props and scene block`

---

### Task 2: Theme registry and contrast

**Files:**
- Create: `packages/video/src/themes/types.ts`
- Create: `packages/video/src/themes/registry.ts`
- Create: `packages/video/src/themes/contrast.ts`
- Test: `packages/video/src/themes/registry.test.ts`

**Interfaces:**
- Consumes: `ThemeId`, `THEME_INFO`, `Brand` (Task 1).
- Produces (`types.ts`):

```ts
export type InkStyle = {
  stroke: string; fill: string; accent: string; width: number;
  drawOn: boolean;          // lines draw themselves on (stroke-dashoffset) instead of popping in
  boil: number;             // 0–3 px deterministic jitter, re-rolled every 4 frames
  glow?: string;            // neon: drop-shadow colour
  shadow?: string;          // paper: offset shadow colour
};
export type BackgroundKind = 'brand'|'paper'|'shapes'|'chalk'|'halftone'|'neonGrid'|'paperLayers'|'ruled'|'blocks'|'studio'|'sunburst';
export type SurfaceKind = 'brand'|'marker'|'flat'|'chalk'|'bubble'|'neon'|'cutout'|'note'|'type'|'lowerThird'|'poster';
export type StickerKind = 'pill'|'burst'|'tape'|'neon'|'stamp'|'flash';
export type ResolvedTheme = {
  id: ThemeId;
  brand: Brand;             // colours/font/radius the existing blocks read; handle always the owner's
  headingFont: string;      // Google font family
  bodyFont: string;
  charWidth: number;        // average glyph width / font size for fitText (Baloo 2 = 0.55)
  uppercase: boolean;
  textGlow?: string;        // CSS text-shadow for headings (neon)
  background: BackgroundKind;
  surface: SurfaceKind;
  sticker: StickerKind;
  ink: InkStyle;
  presenter: 'mascot' | 'stickman' | 'none';
  mascotFilter?: string;    // CSS filter on the mascot wrapper (ink outline / neon glow)
  caption: { backdrop: string; plate: boolean; spoken: string; keyword: string; upcoming: string };
  confetti: string[];
};
```

- Produces (`registry.ts`): `resolveTheme(id: ThemeId, brand: Brand): ResolvedTheme`.
  - `classic` uses the brand unchanged: `brand` is the brand itself, both fonts are `brand.font`, `charWidth` is 0.55, `background`/`surface` are `'brand'`, `sticker` is `'pill'`, and `presenter` is `'mascot'`.
  - Captions for `classic`: `caption.spoken` is `brand.text`, `keyword` is `brand.accent`, `upcoming` is `'#9A9A9A'` (the current `UPCOMING`), `backdrop` is `brand.bg`, and `plate` is `false`.
  - The confetti colours are today's list.
  - Every other theme overrides `brand`'s `bg`/`surface`/`text`/`accent`/`accent2`/`radius`, keeps `brand.handle`, and sets `brand.font` to its body font.
  - Presenters:
    - `stickman`, `chalkboard`, `notebook`: `presenter: 'stickman'`;
    - `bold`: `'none'`;
    - the rest: `'mascot'`.
  - `plate: true` for `comic`, `neon`, `paperLayers`-based `paper` and `bollywood`. The fonts and looks follow spec §5.
- Produces (`contrast.ts`): `contrastRatio(a: string, b: string): number` (WCAG relative luminance, `#rgb`/`#rrggbb`).

- [x] **Step 1: Write the failing tests**

- `contrastRatio`: `('#000','#fff')` ≈ 21, `('#fff','#fff')` = 1.
- `classic is the brand unchanged`: `resolveTheme('classic', brand).brand` deep-equals `brand`, and `caption.upcoming === '#9A9A9A'`.
- `every theme resolves and keeps the owner's handle`: loop over `ThemeId.options`.
- `caption colours are readable in every theme except classic`: spoken and keyword ≥ 4.5 against `caption.backdrop`; upcoming ≥ 3.
- `theme fonts exist in Google Fonts`: every `headingFont`/`bodyFont` is in `getAvailableFonts().map(f => f.fontFamily)`.
- `themes look different`: no two themes share the same `(background, surface, headingFont)` triple.
- `presenters`: `stickman`, `chalkboard` and `notebook` are `'stickman'`; `bold` is `'none'`.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/video/src/themes`
Expected: FAIL (module missing).

- [x] **Step 3: Implement `types.ts`, `contrast.ts` and `registry.ts`**

- [x] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

Message: `feat(video): theme registry with contrast checks`

---

### Task 3: Stickman — shared skeleton, 12 poses, blending, presenter faces

**Files:**
- Create: `packages/video/src/drawings/skeleton.ts`
- Create: `packages/video/src/drawings/Stickman.tsx`
- Create: `packages/video/src/drawings/ink.tsx`
- Test: `packages/video/src/drawings/stickman.test.tsx`

**Interfaces:**
- Consumes: `Pose`, `Expression` (Task 1); `InkStyle` (Task 2).
- Produces (`skeleton.ts`):
  - `type Joint = 'head'|'neck'|'hip'|'lElbow'|'lHand'|'rElbow'|'rHand'|'lKnee'|'lFoot'|'rKnee'|'rFoot'`
  - `type Skeleton = Record<Joint, {x:number;y:number}>`, in a 300 × 400 drawing box.
  - `POSES: Record<Pose, Skeleton>`
  - `poseAt(pose: Pose, frame: number): Skeleton`. Applies the pose's idle motion: thinking taps the chin, running cycles the legs every 12 frames, celebrate jumps, wave waves. Everything else breathes slightly.
  - `blendPose(a: Skeleton, b: Skeleton, t: number): Skeleton`. Uses an eased linear blend with `t` clamped to 0–1.
  - `boil(s: Skeleton, frame: number, px: number): Skeleton`. Deterministic jitter that changes every 4 frames, using a hash of `Math.floor(frame/4)` and the joint.
  - `EXPRESSION_POSE: Record<Expression, Pose>`. The presenter's body for each face:
    - happy → wave
    - thinking → thinking
    - surprised → shocked
    - wink → pointing
    - excited → celebrate
    - laughing → celebrate
    - shocked → shocked
    - sad → sad
- Produces (`ink.tsx`): `Stroke` and `Shape` primitives that apply an `InkStyle`:
  - stroke colour and width;
  - a glow `filter: drop-shadow` (static);
  - an offset shadow copy;
  - draw-on through `pathLength={1}`, `strokeDasharray=1` and `strokeDashoffset={1-progress}`.
- Produces (`Stickman.tsx`): `Stickman: React.FC<{ skeleton: Skeleton; ink: InkStyle; pose?: Pose; face?: Expression; mouthOpen?: number; blink?: boolean; drawProgress?: number; width?: number }>`. Draws an SVG with the head circle and face, plus pose extras (the laptop for `laptop`, a "?" bubble for `thinking`, a small bulb above for `idea`). Uses no Remotion hooks.

- [x] **Step 1: Write the failing tests**

- `every pose stays inside the drawing box`: every joint of `poseAt(p, f)` for f in 0..60 lies within 0..300 × 0..400, with a 10 px margin.
- `poses are distinct`: every pair differs by more than 20 px total joint distance.
- `blendPose endpoints`: `t=0` gives `a` and `t=1` gives `b`; `t=0.5` lies between them.
- `boil is deterministic and bounded`: same input, same output; changes only when `Math.floor(frame/4)` changes; offset ≤ px.
- `Stickman renders every pose in every theme's ink`: `renderToStaticMarkup` for every `Pose` × every `resolveTheme(id, brand).ink` contains `<svg` and doesn't throw.
- `draw-on hides lines at progress 0`: the markup has `stroke-dashoffset="1"`.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/video/src/drawings/stickman.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement `skeleton.ts`, `ink.tsx` and `Stickman.tsx`**

- [x] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

Message: `feat(video): stickman skeleton, poses and blending`

---

### Task 4: Props — 24 objects with their own motions

**Files:**
- Create: `packages/video/src/drawings/props.tsx`
- Create: `packages/video/src/drawings/motion.ts`
- Test: `packages/video/src/drawings/props.test.tsx`

**Interfaces:**
- Consumes: `Prop` (Task 1); `InkStyle`, `Stroke`/`Shape` (Tasks 2–3).
- Produces (`motion.ts`): `propMotion(prop: Prop, since: number): { x: number; y: number; scale: number; rotate: number; opacity: number; progress: number }`. `since` is the number of frames since the prop appeared, and `progress` (0–1) drives draw-on and the inner animation. Motions:
  - coins fall and bounce
  - rocket flies up
  - chartUp/chartDown draw their line
  - clock hands spin
  - bulb flickers on
  - heart beats
  - lock clicks shut
  - warning flashes
  - gift lid pops
  - fire flickers
  - check/cross draw on
  - search sweeps
  - everything else pops

  By frame 30, everything is at rest (`x=y=rotate=0`, `scale=1`, `opacity=1`, `progress=1`) apart from the looping idles. The idle loops are heart, fire, clock and coins glint. Their idle amplitude stays ≤ 6 % scale and ≤ 6 px.
- Also produces (`motion.ts`): `SETTLE_FRAMES = 30`, `IDLE_PROPS: Prop[]` (heart, fire, coins, clock) — named by the tests.
- Produces (`props.tsx`): `PropDrawing: React.FC<{ prop: Prop; ink: InkStyle; since: number; size?: number }>`. Draws an SVG in a 200 × 200 box and uses no Remotion hooks.

- [x] **Step 1: Write the failing tests**

- `every prop renders in every ink`: Prop × theme ink, `renderToStaticMarkup` contains `<svg`.
- `motions settle by frame 30`: for every prop, `propMotion(p, 30)` is within the idle tolerance of rest.
- `motions start hidden or small`: at `since=0`, either `opacity` < 0.5, `scale` < 0.5, `progress` is 0, or `|y|` > 100.
- `coins fall from above and bounce`: y is negative at 0, reaches 0 by about 12, and goes negative again shortly after (the bounce).
- `rocket rises`: y decreases from 0 to 6.
- `deterministic`: same input, same output.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/video/src/drawings/props.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement `motion.ts` and `props.tsx`**

- [x] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

Message: `feat(video): 24 animated props`

---

### Task 5: Themed reel — backgrounds, fonts, surfaces, captions, stickers, presenter, end card

**Files:**
- Create: `packages/video/src/themes/Background.tsx`
- Create: `packages/video/src/themes/Surface.tsx`
- Modify: `packages/video/src/Reel.tsx`
- Modify: `packages/video/src/blocks/common.tsx` (add `theme` to `BlockProps`)
- Modify: `packages/video/src/blocks/Title.tsx`
- Modify: `packages/video/src/blocks/Card.tsx`
- Modify: `packages/video/src/blocks/BigNumber.tsx`
- Modify: `packages/video/src/blocks/List.tsx`
- Modify: `packages/video/src/blocks/Sticker.tsx`
- Modify: `packages/video/src/Karaoke.tsx`
- Modify: `packages/video/src/EndCard.tsx`
- Modify: `packages/video/src/layout.ts` (`fitText` gains `charWidth = 0.55` as its last parameter)
- Modify: `packages/video/src/exports.ts`
- Test: `packages/video/src/themes/themedReel.test.tsx`
- Test: `packages/video/src/layout.test.ts`

**Interfaces:**
- Consumes: `resolveTheme`, `ResolvedTheme` (Task 2); `Stickman`, `poseAt`, `EXPRESSION_POSE` (Task 3); `reelTheme`, `effectSettings` (Task 1).
- Produces:
  - `Background: React.FC<{ theme: ResolvedTheme; frame: number; sceneIndex: number }>`. Fills the frame. Textures are static, built from deterministic seeded dots or lines, or from CSS gradients. Movement is a cheap transform: the neon grid scrolls, shapes float, the `bold` block colour changes with `sceneIndex`.
  - `Surface: React.FC<{ theme: ResolvedTheme; children; style? }>`. The themed panel behind card, list, title and big number.
  - `BlockProps<B>` gains `theme: ResolvedTheme`.
  - `fitText(text, maxWidth, maxFontPx, minFontPx = 36, maxLines = 3, charWidth = 0.55)`.
  - `Karaoke` takes `theme: ResolvedTheme` instead of `brand`. When `theme.caption.plate` is set, it draws a plate in `caption.backdrop` (≥ 85 % opacity) behind the band. `UPCOMING` stays exported.
  - `EndCard` takes `theme: ResolvedTheme`.
  - `Reel` computes `theme = resolveTheme(reelTheme(reel), brand)` and loads `headingFont` and `bodyFont` with `useBrandFont`. It passes `theme` everywhere and uses `effectSettings(reel)` (now theme-aware). Presenter:
    - `'mascot'`: today's `Mascot`, wrapped with `theme.mascotFilter`;
    - `'stickman'`: `Stickman` with `poseAt(EXPRESSION_POSE[expression], frame)`, `face={expression}`, `mouthOpen={open}`, `blink`;
    - `'none'`: nothing.
  - Confetti uses `theme.confetti`.
  - Export `resolveTheme` and `type ResolvedTheme` from `exports.ts`.
  - *(Added in build)* `ResolvedTheme.onBg: { text; accent }`: colours for titles, numbers, lists and the end card drawn on the background (tested ≥ 4.5 / ≥ 3 against `brand.bg`); `Background` also takes `sinceScene` (news BREAKING flash); `themes/style.ts` holds `headingStyle`, `fontStack`, `seeded`.

- [x] **Step 1: Write the failing tests**

In `layout.test.ts`: `fitText with a wider charWidth picks a smaller size` (same text, 0.55 vs 0.7).

In `themedReel.test.tsx`, render `Reel` through a minimal frame harness: mock `remotion`'s `useCurrentFrame`/`useVideoConfig`/`delayRender`/`continueRender`/`Audio`/`Img` with `vi.mock`, and render with `renderToStaticMarkup`, the way existing video tests do if they exist, otherwise as described here.
- `classic reel renders as before`: markup for a fixture reel with no theme contains `brand.bg` as the root background.
- `every theme renders a frame`: every ThemeId, at frame 30 of the demo props, renders without throwing.
- `stickman themes present with the stickman even when the owner uses My character`: `mascot.kind='image'` and `theme:'notebook'` give no `<img` for the mascot, and the stickman svg is present.
- `bold has no presenter`.
- `plate themes draw a caption plate`: `theme:'neon'` has an element with `data-caption-plate`.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/video/src/themes packages/video/src/layout.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement**

Work in this order: Background, Surface, the block changes, Karaoke, EndCard, then Reel.
- Every block passes `theme.charWidth` to `fitText` and uses `theme.headingFont`, `uppercase` and `textGlow`.
- `Sticker` draws `theme.sticker`. `burst` is a jagged SVG star behind the agent's own text.

- [x] **Step 4: Run to pass, then look at stills**

Run: `npm test && npm run typecheck`
Expected: PASS.

Then render one still per theme from the demo props, with the `theme` set per run. Use `npx remotion still` from `packages/video` with a props file written to the scratchpad. Open the stills, compare them against spec §5, and check that nothing leaves the safe box (use `debugSafeZones: true`). Fix whatever looks wrong before committing.

- [x] **Step 5: Commit**

Message: `feat(video): themed backgrounds, surfaces, captions and presenter`

---

### Task 6: Scene block and stickman morph between scenes

**Files:**
- Create: `packages/video/src/blocks/Scene.tsx`
- Modify: `packages/video/src/cues.ts`
- Modify: `packages/video/src/Reel.tsx` (`MainBlock` and the transition branch)
- Modify: `packages/video/src/effects.ts` (`sfxEvents`: a scene block counts as a main block; each prop entrance that is coins, rocket or check gets `bubble`, keeping the 6-frame spacing)
- Test: `packages/video/src/cues.test.ts`
- Test: `packages/video/src/blocks/scene.test.tsx`
- Test: `packages/video/src/effects.test.ts`

**Interfaces:**
- Consumes: `Stickman`, `poseAt`, `blendPose`, `boil` (Task 3); `PropDrawing`, `propMotion` (Task 4); `ResolvedTheme` (Task 2).
- Produces:
  - `isMorph(previous: Cue | undefined, main: Cue | undefined): boolean`, in `cues.ts`. True when both are `scene` blocks with a `pose`.
  - `MORPH_FRAMES = 8`.
  - *(Added in build)* `PROP_STAGGER = 6`, `propDelay(block, k)` (objects wait one step for the stickman) and `mainBefore(cues, words, main)`: the main block `main` replaced. `previous` from `activeCues` only lasts the 10-frame overlap, so the morph uses `mainBefore` to keep `fromPose` for the whole scene.
  - `Scene: React.FC<BlockProps<SceneBlock> & { fromPose?: Pose }>`. Layout inside `BLOCK_SLOT`:
    - optional `text` heading on top, using `fitText` with `theme.charWidth`;
    - the stickman large, at left/centre, about 55 % of the slot height;
    - up to 3 props around it. With no pose, the props are centred and larger.
    - Each prop appears 6 frames after the previous one.
    - With `fromPose`, the stickman blends from it over `MORPH_FRAMES` instead of running its entrance.
    - `theme.id === 'bold'` skips the drawings and renders `text` as giant type. A `bold` scene with no `text` renders nothing in the slot. The agent is told that `bold` scenes need `text` (Task 7).
  - Rule in `Reel.tsx`: when `isMorph(previous, main)` holds, render only the new `Scene` with `fromPose={previous.block.pose}`. The old block isn't drawn and no slide/whip/zoom is applied to the stickman. The props and text use the normal entrance.

- [x] **Step 1: Write the failing tests**

- `isMorph`: scene+scene with poses → true; scene → card → false; scene without pose → false; undefined → false.
- `scene renders pose, props and text`: markup contains the stickman svg, 2 prop svgs and the text.
- `scene props are staggered`: at `since = 3`, the second prop's motion is still at its start state.
- `bold scene shows text, not drawings`.
- `sfxEvents treats a scene block as a main block`: a reel whose first main cue is a scene gives `tick` at its frame.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/video/src/cues.test.ts packages/video/src/blocks packages/video/src/effects.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement `Scene.tsx`, `isMorph`, the `Reel.tsx` branch and the `sfxEvents` change**

- [x] **Step 4: Run to pass, then check stills**

Run: `npm test && npm run typecheck`
Expected: PASS.

Render stills across a scene → scene change: the frame before it, +4 and +8. Confirm the stickman eases between the poses without jumping.

- [x] **Step 5: Commit**

Message: `feat(video): scene block with acted-out drawings`

---

### Task 7: Agent — theme-aware scene planning

**Files:**
- Modify: `packages/server/src/agent/prompts.ts`
- Modify: `.claude/skills/reels/SKILL.md` (a short "Themes and drawings" section)
- Test: `packages/server/src/agent/run.test.ts`

**Interfaces:**
- Consumes: `reelTheme`, `THEME_INFO`, `POSE_MEANING`, `PROP_MEANING`, `Pose`, `Prop` (Task 1).
- Produces: `scenesPrompt` (same signature) adds:
  - the line `Theme: <label> — <description>`;
  - the `"scene"` block format `{ "type": "scene", "pose"?: …, "props"?: [up to 3], "text"?: … }`;
  - every pose and every prop as `name — meaning`;
  - these rules:
    - match the drawings to what the line says, never at random;
    - if `THEME_INFO[t].acts`, most main cues are scene blocks;
    - otherwise mix scenes with cards, numbers and lists as the content suits;
    - in `bold`, scene blocks need `text`;
    - use only the listed names.
- The `header` sentence becomes: keep "audio", "effects" and "theme" exactly as they are unless the owner asks.

- [x] **Step 1: Write the failing tests**

- `scenes prompt names the theme and lists every pose and prop with its meaning`: loop over `Pose.options` and `Prop.options`; the prompt contains each one with `POSE_MEANING[p]` / `PROP_MEANING[p]`.
- `acting themes ask for mostly scene blocks`: the prompt for `theme:'stickman'` contains `most main cues`, and the one for `theme:'news'` doesn't.
- `header keeps theme`.
- `agent edit with an unknown prop is rejected and names the field`: a cue with `props:['money']` gives `ok:false`, and the message contains `cues.0.block.props.0`. The existing restore-on-failure test path proves the reel is rolled back.

- [x] **Step 2: Run to fail**

Run: `npx vitest run packages/server/src/agent`
Expected: FAIL.

- [x] **Step 3: Implement the prompt changes and the SKILL.md section**

- [x] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

Message: `feat(agent): theme-aware scenes with drawings`

---

### Task 8: Web — choose a theme (create form, Scenes step, library card)

**Files:**
- Create: `packages/web/src/components/ThemePicker.tsx`
- Create: `packages/video/src/themes/ThemeSwatch.tsx` (exported from `exports.ts`)
- Modify: `packages/web/src/pages/Library.tsx`
- Modify: `packages/web/src/api.ts`
- Modify: `packages/server/src/routes/reels.ts`
- Modify: `packages/server/src/store.ts` (`createReel` accepts `theme`; `ReelSummary` gains `theme`)
- Modify: `packages/web/src/steps/ScenesStep.tsx`
- Modify: `packages/web/src/components/SoundPanel.tsx`
- Modify: `packages/web/src/components/ReelCard.tsx`
- Test: `packages/web/src/components/ThemePicker.test.tsx`
- Test: `packages/web/src/components/SoundPanel.test.tsx`
- Test: `packages/server/src/routes/reels.test.ts`

**Interfaces:**
- Consumes: `THEME_INFO`, `ThemeId`, `effectsForTheme`, `effectSettings` (Task 1); `resolveTheme` (Task 2); `Stickman`/`poseAt` (Task 3).
- Produces:
  - `ThemeSwatch: React.FC<{ id: ThemeId; brand: Brand; width?: number }>`. A static mini preview: the theme background, "Aa" in the heading font and a small stickman or prop in the theme's ink. Pure, with no Remotion hooks.
  - `ThemePicker: React.FC<{ value: ThemeId; onChange: (id: ThemeId) => void; brand: Brand }>`. A radio group (`role="radiogroup"`, one `role="radio"` per theme with `aria-checked`, its label from `THEME_INFO`), showing a swatch and the label. Arrow keys move between options.
  - `POST /api/reels` accepts optional `theme: ThemeId`. `api.createReel` input gains `theme?`.
  - `ReelSummary.theme: ThemeId`, from `reelTheme(reel)`.
  - In ScenesStep, a "Theme" `ThemePicker` above `SoundPanel`. On change, it saves `{ ...reel, theme: id, effects: effectsForTheme(reel.effects, id) }` and shows the hint: `Theme changed. Ask the agent again so the scenes suit it.`
  - `SoundPanel` reads `effectSettings(reel)` (theme-aware), so a reel with no `effects` shows the theme's defaults.

- [ ] **Step 1: Write the failing tests**

- `ThemePicker shows all 11 themes and reports the choice`: 11 radios; clicking "Comic" calls `onChange('comic')`; `aria-checked` on the current one.
- `ThemePicker arrow keys move the selection`.
- `create reel with a theme`: `POST /api/reels {topic, theme:'neon'}` gives the reel `theme: 'neon'`. An invalid theme gives 400.
- `library summary includes theme`: an old reel gives `'classic'`.
- `SoundPanel shows the theme defaults when effects are unset`: `theme:'comic'` with no effects selects comic's transition.
- `switching theme resets transition and captions but keeps emotion`: test the ScenesStep handler, or extract `themeChange(reel, id): Reel` into `ScenesStep.tsx` and test that.

- [ ] **Step 2: Run to fail**

Run: `npx vitest run packages/web packages/server/src/routes/reels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The create form puts a `ThemePicker` under the length choice. It loads the brand with the existing brand API call. Use classic's colours until the brand has loaded.

`ReelCard` shows `THEME_INFO[summary.theme].label` as a small tag.

- [ ] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

Message: `feat(web): pick a theme when creating a reel and in Scenes`

---

### Task 9: Web — edit scene blocks

**Files:**
- Modify: `packages/web/src/components/CueEditor.tsx`
- Test: `packages/web/src/components/CueEditor.test.tsx`

**Interfaces:**
- Consumes: `Pose`, `Prop`, `POSE_MEANING`, `PROP_MEANING` (Task 1); `Stickman`, `PropDrawing` (Tasks 3–4); `resolveTheme` (Task 2).
- Produces: `defaultBlock('scene')` returns `{ type: 'scene', pose: 'explain' }`. The `scene` fields are:
  - a "Pose" select with "(none)" plus 12 options, each labelled `name — meaning`;
  - 3 "Object 1–3" selects with "(none)" plus 24 options, and a small `PropDrawing` preview next to each chosen object;
  - an optional "Text" input.

  Choosing "(none)" removes the field (and the `props` entry). If an edit would leave the block empty, `pose` resets to `'explain'` and the editor shows `A scene needs a pose, an object or text.`

- [ ] **Step 1: Write the failing tests**

- `switching to scene gives a valid default`: `{type:'scene', pose:'explain'}`.
- `picking objects builds the props list`: Object 1 = coins and Object 2 = rocket give `props:['coins','rocket']`; Object 1 = (none) then gives `props:['rocket']`.
- `clearing the last field keeps the scene valid`: pose (none) with no props and no text calls `onChange` with `pose:'explain'`, and the message is shown.
- Every `onChange` payload passes `Cue.safeParse`.

- [ ] **Step 2: Run to fail**

Run: `npx vitest run packages/web/src/components/CueEditor.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run to pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

Message: `feat(web): edit scene blocks`

---

### Task 10: Samples, render-time check and docs

**Files:**
- Create: `scripts/theme-samples.ts`
- Create: `scripts/theme-samples.test.ts`
- Create: `packages/server/src/themes.render.test.ts` (slow; skipped unless `REEL_SLOW=1`)
- Modify: `package.json` (script `"samples:themes": "node scripts/theme-samples.ts"`)
- Modify: `README.md` (themes in "Making your first reel", the samples command, files table)
- Modify: `docs/superpowers/plans/2026-11-03-reelmaker.md` (one "Task 12d — themes" note pointing to this plan)

**Interfaces:**
- Consumes: the HTTP API on `http://127.0.0.1:4000` (`POST /api/reels`, `PUT /api/reels/:id`, `GET /api/reels/:id`, `POST …/voice`, `POST …/timing`, `POST …/render`, `GET /api/jobs/:id`); `ThemeId` (Task 1).
- Produces:
  - `sampleScript(): Pick<Reel,'title'|'topic'|'targetSeconds'|'lines'|'cues'|'keywords'>`. The fixed demo is 12–15 s of Hinglish:
    - all 6 moods appear at least once;
    - it mentions money, time, an idea, a number and a question;
    - its cues use scene blocks (with poses and props), one `bigNumber`, one `card`, one `list` and one `sticker`.
  - `nextSteps(status: ReelStatus): ('voice'|'timing')[]`. Voice only when it isn't fresh, timing only when it isn't fresh.
  - The script:
    1. Checks the app is running. If not, it prints `Start the app first: npm run dev` and exits 1.
    2. Finds the reel titled `Theme samples`, or creates it.
    3. PUTs the script, then runs `nextSteps`, polling the jobs.
    4. For every `ThemeId`, PUTs `theme` (and `effects: effectsForTheme(undefined, id)`), renders, and copies `out/reel.mp4` to `data/samples/themes/<id>.mp4`.
    5. Prints one line per theme with its render seconds and its ratio to `classic`.

    It uses `fetch` only: no shell and no new dependency.
  - `themes.render.test.ts`: with `REEL_SLOW=1`, renders frame 45 of the demo props as a still for every theme with `@remotion/renderer` and expects a PNG larger than 10 KB.

- [ ] **Step 1: Write the failing tests**

- `sample script is a valid reel`: merge it into a minimal reel; `Reel.safeParse` succeeds; every `Mood` is present; there's at least one scene block with props.
- `sample length fits 12–15 s`: `totalWords / 2.3` is between 12 and 15.
- `nextSteps`: fresh/fresh gives `[]`; stale voice gives `['voice','timing']`; fresh voice with missing timing gives `['timing']`.

- [ ] **Step 2: Run to fail**

Run: `npx vitest run scripts/theme-samples.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the script, the slow test and the docs**

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck` — PASS.
Run: `py\.venv\Scripts\python -m pytest py\tests` — PASS (unchanged).
Run, with the owner's app running: `npm run samples:themes`.
Expected: 11 MP4s in `data\samples\themes\`, every ratio ≤ 1.30. Watch each one: the drawings match the words, captions are readable, nothing leaves the safe box. Fix any theme that fails, then rerun.

If the owner's own `npm run dev` is the one running, ask them before using it. Never stop it.

- [ ] **Step 5: Commit**

Message: `feat: theme samples, render check and docs`
