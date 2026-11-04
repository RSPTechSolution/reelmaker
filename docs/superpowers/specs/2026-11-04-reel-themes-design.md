# Reel Themes — Design Spec

Date: 2026-11-04 · Status: approved by owner in chat ("Go ahead"), including the reel-schema change.
Builds on `2026-11-03-reelmaker-design.md`. Everything there still holds unless this document says otherwise.

## 1. Intent

Today every reel has one look: brand colours, rounded cards, big numbers, stickers, the robot, pop captions.
The owner wants a **theme** per reel that restyles the whole reel at once, and, in the drawing themes,
**drawings that act out what is being said** (a thinking stickman while a question is asked, coins falling
when money is mentioned). Every theme must ship with **one sample MP4** so the owner can compare them.

Success = the owner picks a theme for a reel, asks the agent to plan scenes, and gets a reel that looks
clearly different per theme and whose drawings match the words, with no extra manual work.

## 2. Goals / non-goals / anti-goals

**Goals**
- 10 themes, plus `classic` (today's look, the default):
  `stickman` (Stickman story), `objects` (Animated objects), `chalkboard`, `comic`, `neon` (Neon tech),
  `paper` (Paper cut-out), `notebook` (Notebook doodle), `bold` (Bold typography), `news` (Breaking news),
  `bollywood` (Retro Bollywood).
- A theme changes: background (with texture/motion), fonts, card/number/list/sticker/title styling, caption
  colours, default transition, sticker style, confetti colours, the presenter character's styling, end-card styling.
- A library of **drawings** (stickman poses + objects) that the agent places on cues; each theme draws them
  in its own ink style.
- Theme picked when creating a reel, changeable later in the Scenes step. Voice, captions, timing untouched.
- One command produces the 10 sample MP4s (voiced) on the owner's PC.

**Non-goals**
- Owner-made custom themes or a theme editor.
- AI image generation, stock art, downloaded illustration packs. All drawings are hand-authored SVG in code.
- Changing the layout zones (block slot, caption band, mascot box, safe box) — themes restyle inside them.

**Anti-goals (a failure even if it "works")**
- Themes that are just recolours. Each must be recognisable in a single frame.
- Captions that become hard to read (contrast below WCAG AA 4.5:1 against their background).
- Anything leaving the Instagram safe box, or renders noticeably slower on the i5 (budget: ≤ +30 % render time vs `classic`).
- Drawings that ignore the words (random poses).
- A paid API, cloud service or new npm/Python dependency.

## 3. Constraints

All constraints of the main spec and CLAUDE.md: Windows i5 CPU-only, free, Remotion 4.0.540 pinned,
test-first, one commit per task, no new dependency without asking. Fonts come from `@remotion/google-fonts`
(already a dependency) through the existing `loadBrandFont` loader.

## 4. Decided by the owner

- Themes are the **whole look of the reel**, not the mascot.
- All 10 themes above are wanted.
- In the drawing themes the drawings **act out what is being said**.
- Each theme gets one sample video.
- The theme's colours **replace** the brand colours for that reel; the brand **handle** still shows on the end
  card. (Proposed in chat as a guess; owner approved the description.)
- The reel schema may change as described in section 6.

## 5. What each theme looks like

| id | Look | Fonts (Google) | Presenter | Drawings |
|---|---|---|---|---|
| `classic` | today's reel, brand colours | brand font | owner's mascot (robot / My character) | flat brand-colour style |
| `stickman` | off-white paper, black marker lines that draw themselves on, one accent colour (marker red) | Patrick Hand / Caveat | stickman (marker) | marker, draw-on, slight line boil |
| `objects` | bright flat gradient background, floating soft shapes; motion-graphics feel | Poppins | owner's mascot | flat filled icons with bounce, squash, orbit motions |
| `chalkboard` | dark green board with chalk dust, wooden frame edge; text writes on stroke by stroke | Kalam / Gochi Hand | stickman (chalk) | chalk lines, rough edges |
| `comic` | yellow/cyan halftone, panel borders, speech-bubble cards, stickers drawn as jagged "BOOM!"-style bursts (shape only — the sticker keeps the agent's own text) | Bangers + Comic Neue | owner's mascot with ink outline | thick black ink + flat fill |
| `neon` | near-black with moving grid and glow | Orbitron + Exo 2 | owner's mascot with neon outline | glowing outlines |
| `paper` | textured paper layers with drop shadows sliding in | Fredoka | owner's mascot | cut-paper shapes with offset shadow |
| `notebook` | ruled copy page with margin line, pen doodles, highlighter on keywords | Patrick Hand | stickman (blue pen) | ballpoint lines, highlighter fills |
| `bold` | solid colour blocks that swap per scene; giant words slam, stretch, stack | Anton | none (type only) | none — text only (scene blocks render their `text` as type) |
| `news` | studio-blue background, lower-third headline bars, ticker, red "BREAKING" flash on scene changes | Oswald + Roboto | owner's mascot | flat news-graphic icons |
| `bollywood` | warm poster colours, sunburst rays, film grain, vignette | Rozha One + Yatra One | owner's mascot | poster-style bold shapes |

Exact colours, sizes and textures are the builder's call within the look described, subject to the
contrast and performance rules in section 9.

## 6. Schema changes (approved)

In `packages/shared/src/schema.ts`:

```ts
export const ThemeId = z.enum(['classic','stickman','objects','chalkboard','comic','neon',
  'paper','notebook','bold','news','bollywood']);

export const Pose = z.enum(['thinking','pointing','shrug','running','celebrate','facepalm',
  'explain','laptop','wave','sad','shocked','idea']);

export const Prop = z.enum(['phone','coins','rocket','chartUp','chartDown','clock','bulb','heart',
  'lock','moneyBag','trophy','warning','gift','camera','laptop','book','fire','star','check',
  'cross','calendar','chat','search','target']);

// new Block variant — a main block (occupies the block slot like title/card)
{ type: 'scene', pose?: Pose, props?: Prop[] (0–3), text?: string }   // at least one of pose / props / text

Reel.theme?: ThemeId          // missing = 'classic'
```

- Old reels (no `theme`, no `scene` blocks) load and render exactly as today.
- `theme` is **not** part of `spokenHash` (changing theme must not invalidate voice or captions).
- Agent edits keep `theme` when the agent omits it (same rule as `audio` / `effects` in `readAgentEdit`).
- `docs/reel-schema.md` is updated.

## 7. Drawings that act out the words

- **Poses**: the stickman in 12 poses (section 6). Each pose is one SVG built from strokes (head, body,
  arms, legs, plus small extras like a laptop or a "?" bubble), with a short idle motion per pose
  (thinking taps chin, running cycles legs, celebrate jumps).
  *(Builder's call, settled in review:)* poses are defined as **joint positions on one shared skeleton**
  (the presenter stickman uses the same skeleton), so any two poses can be blended. When a scene block
  replaces another scene block **back to back** (the previous one is still the main block at the change,
  i.e. the case where `Reel.tsx` runs a transition today), the stickman stays in place and eases into the
  new pose over ~8 frames while only the props and text run the theme's transition. With a gap, or when a
  different block type is involved, the normal transition runs.
- **Props**: 24 objects. Each has an entrance motion that fits it (coins fall and bounce, rocket flies up,
  chart lines draw upward/downward, clock hands spin, bulb flickers on, heart beats, lock clicks shut,
  warning flashes, gift lid pops, fire flickers, check/cross draw on, search glass sweeps).
- **Scene block layout**: inside the block slot — pose large (left or centre), up to 3 props arranged
  around it, optional short `text` as a heading. With no pose, props are the hero.
- **Ink styles**: one drawing definition, many renderings. Each theme supplies an ink style
  (stroke colour, stroke width, fill/no-fill, draw-on vs pop entrance, roughness/boil, glow, shadow).
  `bold` renders the scene block's `text` (or a word from the line) as big type and skips drawings.
- **In non-drawing presenter themes** the stickman pose still appears inside scene blocks (it is a
  drawing, not the presenter); the presenter in the mascot box is the owner's mascot as in section 5.
- **Agent**: the scenes prompt receives the theme and the full pose/prop list with one-line meanings
  (e.g. `coins` = money, price, earning, saving). Rules for the agent:
  - match the pose/props to what the line says; never decorative-random;
  - in `stickman`, `chalkboard`, `notebook` and `objects`, most main cues should be `scene` blocks;
  - in other themes scene blocks are mixed with cards/numbers/lists as the content suits;
  - in `bold`, prefer `title`/`bigNumber`/`scene` with `text`.
- **Presenter stickman** (in `stickman`, `chalkboard`, `notebook`): replaces the mascot in the mascot box,
  maps the current expression to a pose/face (happy, thinking, surprised, wink, excited, laughing,
  shocked, sad), moves its mouth with loudness, blinks. The owner's `data/mascot.json` is not changed.
- **Editor**: the cue editor supports the `scene` block: pose dropdown, up to 3 prop pickers (with a small
  drawn preview of each), optional text.

## 8. Choosing a theme (web app)

- **Create reel** form on the Reels page: a theme picker (grid of 11 small cards, each a still preview of
  the theme). Default `classic`.
- **Scenes step**: a "Theme" control in or next to the Music & effects panel to switch theme; the live
  Player updates. After switching, a hint suggests "Ask agent" again so cues suit the new theme.
- Reel cards in the library show the theme name.
- A theme sets a default scene transition and caption style. *(Builder's call, settled in review:)*
  `effects` stays one all-or-nothing object (no schema change). While a reel has no `effects`, the theme's
  defaults apply and the Music & effects panel shows them. **Switching theme** writes the new theme's
  transition and caption style into `effects` and keeps the owner's `emotion` choice; after that the owner
  can change them freely in Music & effects.

## 9. Quality rules

- **Contrast** *(builder's call, settled in review)*: each theme defines a solid caption colour to test
  against — either its plain background colour or, for busy backgrounds (neon grid, halftone, sunburst,
  film grain, paper layers), a **caption plate** (solid or ≥ 85 % opaque panel behind the caption band).
  Spoken words and keywords must be ≥ 4.5:1 against it; not-yet-spoken words ≥ 3:1. A unit test checks
  every theme in the registry. `classic` is excluded because its colours come from the owner's brand.
- **Safe box**: all theme decoration that carries meaning (text, drawings, presenter) stays inside the safe
  box; pure background texture may fill the frame. Existing layout tests keep passing.
- **Performance**: no per-frame SVG filters that are expensive on CPU (e.g. animated `feTurbulence`);
  textures are static (generated once per render) or cheap CSS. Measure render time of the sample reel in
  `classic` vs each theme; each must be ≤ +30 %.
- **Determinism**: all motion is a function of the frame (no `Math.random` at render time) so preview,
  contact sheet and render match.
- **Fonts**: every theme font loads through `loadBrandFont`; if loading fails the theme falls back to Baloo 2
  and still renders.

## 10. Samples

- A fixed demo script (Hinglish, ~12–15 s, every mood at least once, mentions money, time, an idea, a
  number and a question) with hand-planned cues that use scene blocks, a big number, a card, a list and
  stickers.
- `npm run samples:themes` voices it once with Kokoro, syncs captions, then renders it in all 11 themes
  (`classic` for comparison) to `data/samples/themes/<theme>.mp4`, plus a cover PNG per theme.
  Re-running reuses the voice if the script is unchanged.
- The builder renders the samples on this PC as part of verification and gives the owner the folder path.

## 11. Testing

Test-first as usual. Must include:
- schema: `theme`, `scene` block, pose/prop enums, old reels still valid, `spokenHash` ignores theme;
- theme registry: every `ThemeId` has a theme; contrast test; fonts listed exist in `@remotion/google-fonts`;
- drawings: every pose and prop renders (server-side render) in every ink style without throwing and stays
  inside its box;
- agent: prompt includes theme + pose/prop meanings; `readAgentEdit` keeps `theme`;
- web: theme picker on create and in Scenes saves `theme`; cue editor edits a scene block;
- render: a smoke render per theme (a few frames) in the slow test set.

## 12. Left to the builder

Exact palettes, textures, font pairings within section 5, SVG artwork, motion curves, how the plan splits
into tasks, file layout under `packages/video/src/themes/` and `packages/video/src/drawings/`, and the
wording of the agent's pose/prop meanings.
