import { z } from 'zod';

/** Words are split on any run of whitespace; caption word i is spoken word i. */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Ids end up in file paths (lines/<id>.wav, data/reels/<id>/) and the agent can edit them,
 * so only letters, digits, _ and - are allowed, and never a Windows device name (CON, NUL, COM1…).
 */
export const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

export const SafeId = z
  .string()
  .regex(SAFE_ID_RE, 'id must be 1–64 characters: letters, digits, _ or -')
  .refine((id) => !WINDOWS_RESERVED_RE.test(id), 'id cannot be a Windows device name (CON, NUL, COM1, …)');

/** How a line is delivered: sets voice pace, the pause after it, and the mascot's face. */
export const Mood = z.enum(['excited', 'curious', 'serious', 'funny', 'calm', 'shocked']);
export type Mood = z.infer<typeof Mood>;

export const Line = z
  .object({
    id: SafeId,
    caption: z.string(),
    spoken: z.string(),
    mood: Mood.optional(),
  })
  .superRefine((line, ctx) => {
    const c = splitWords(line.caption).length;
    const s = splitWords(line.spoken).length;
    if (c !== s) {
      ctx.addIssue({
        code: 'custom',
        path: ['spoken'],
        message: `line ${line.id}: caption has ${c} words, spoken has ${s}`,
      });
    }
  });
export type Line = z.infer<typeof Line>;

export const Expression = z.enum(['happy', 'thinking', 'surprised', 'wink', 'excited', 'laughing', 'shocked', 'sad']);
export type Expression = z.infer<typeof Expression>;

/** Whole look of a reel (missing = 'classic', today's brand look). */
export const ThemeId = z.enum([
  'classic',
  'stickman',
  'objects',
  'chalkboard',
  'comic',
  'neon',
  'paper',
  'notebook',
  'bold',
  'news',
  'bollywood',
]);
export type ThemeId = z.infer<typeof ThemeId>;

/** Stickman poses a scene block can act out. */
export const Pose = z.enum([
  'thinking',
  'pointing',
  'shrug',
  'running',
  'celebrate',
  'facepalm',
  'explain',
  'laptop',
  'wave',
  'sad',
  'shocked',
  'idea',
]);
export type Pose = z.infer<typeof Pose>;

/** Drawn objects a scene block can show. */
export const Prop = z.enum([
  'phone',
  'coins',
  'rocket',
  'chartUp',
  'chartDown',
  'clock',
  'bulb',
  'heart',
  'lock',
  'moneyBag',
  'trophy',
  'warning',
  'gift',
  'camera',
  'laptop',
  'book',
  'fire',
  'star',
  'check',
  'cross',
  'calendar',
  'chat',
  'search',
  'target',
]);
export type Prop = z.infer<typeof Prop>;

export const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('title'), text: z.string() }),
  z.object({ type: z.literal('card'), title: z.string(), body: z.string().optional(), icon: z.string().optional() }),
  z.object({
    type: z.literal('bigNumber'),
    to: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  z.object({ type: z.literal('sticker'), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()).min(1).max(5) }),
  z.object({ type: z.literal('expression'), expression: Expression }),
  /** Acted-out drawing: a stickman pose and/or up to 3 objects, with optional heading text. */
  z.object({
    type: z.literal('scene'),
    pose: Pose.optional(),
    props: z.array(Prop).max(3).optional(),
    text: z.string().optional(),
  }),
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block['type'];

/** How a block enters the screen. */
export const Anim = z.enum(['pop', 'slide', 'zoom', 'bounce', 'typewriter']);
export type Anim = z.infer<typeof Anim>;

export const SCENE_EMPTY = 'scene needs a pose, a prop or text';

/** A scene block must show something. */
export function sceneIsEmpty(block: Block): boolean {
  return block.type === 'scene' && !block.pose && !block.props?.length && !block.text?.trim();
}

export const Cue = z
  .object({
    id: SafeId,
    atWord: z.number().int().min(0),
    untilWord: z.number().int().min(0).optional(),
    anim: Anim.optional(),
    block: Block,
  })
  .superRefine((cue, ctx) => {
    if (sceneIsEmpty(cue.block)) ctx.addIssue({ code: 'custom', path: ['block'], message: `cue ${cue.id}: ${SCENE_EMPTY}` });
  });
export type Cue = z.infer<typeof Cue>;

export const VoiceSettings = z.object({
  engine: z.enum(['kokoro', 'upload']),
  voiceId: z.enum(['hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi']),
  speed: z.number().min(0.8).max(1.3),
});
export type VoiceSettings = z.infer<typeof VoiceSettings>;

export const WordTiming = z.object({
  i: z.number().int().min(0),
  caption: z.string(),
  spoken: z.string(),
  start: z.number(),
  end: z.number(),
  filled: z.boolean(),
});
export type WordTiming = z.infer<typeof WordTiming>;

/** Built-in or uploaded audio file in DATA_DIR/audio/music (never a URL or a path). */
export const AudioFile = z
  .string()
  .regex(/^(builtin|upload)-[a-z0-9-]{1,60}\.(wav|mp3|m4a)$/, 'not an audio file from the music library');

export const AudioSettings = z.object({
  sfx: z.boolean(),
  sfxVolume: z.number().min(0).max(1),
  music: z.object({ track: AudioFile, volume: z.number().min(0).max(1) }).optional(),
});
export type AudioSettings = z.infer<typeof AudioSettings>;

export const EffectSettings = z.object({
  transition: z.enum(['none', 'slide', 'whip', 'zoom']),
  captions: z.enum(['color', 'pop', 'bounce']),
  emotion: z.boolean(),
});
export type EffectSettings = z.infer<typeof EffectSettings>;

/** Total number of words in the script (caption words; equal to spoken words when valid). */
export function totalWords(lines: { caption: string }[]): number {
  return lines.reduce((n, l) => n + splitWords(l.caption).length, 0);
}

export const Reel = z
  .object({
    id: SafeId,
    title: z.string(),
    topic: z.string(),
    hook: z.string().optional(),
    targetSeconds: z.number().int().min(20).max(60),
    lines: z.array(Line),
    voice: VoiceSettings,
    cues: z.array(Cue),
    keywords: z.array(z.string()),
    coverFrame: z.number().int().min(0).optional(),
    audio: AudioSettings.optional(),
    effects: EffectSettings.optional(),
    theme: ThemeId.optional(),
    hashes: z.object({ voice: z.string().optional(), timing: z.string().optional() }),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((reel, ctx) => {
    const dupes = (kind: 'line' | 'cue', ids: string[]) => {
      const seen = new Set<string>();
      ids.forEach((id, k) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: [kind === 'line' ? 'lines' : 'cues', k, 'id'],
            message: `duplicate ${kind} id ${id}`,
          });
        }
        seen.add(id);
      });
    };
    dupes('line', reel.lines.map((l) => l.id));
    dupes('cue', reel.cues.map((c) => c.id));

    const total = totalWords(reel.lines);
    reel.cues.forEach((cue, k) => {
      if (cue.atWord >= total) {
        ctx.addIssue({
          code: 'custom',
          path: ['cues', k, 'atWord'],
          message: `cue ${cue.id}: atWord ${cue.atWord} is beyond the last word (script has ${total} words, last index ${total - 1})`,
        });
      }
    });
  });
export type Reel = z.infer<typeof Reel>;

export const Brand = z.object({
  bg: z.string(),
  surface: z.string(),
  text: z.string(),
  accent: z.string(),
  accent2: z.string(),
  font: z.string(),
  radius: z.number().min(0),
  handle: z.string(),
});
export type Brand = z.infer<typeof Brand>;

/** Uploaded character image: served by our server under /character/ only. */
export const CharacterImage = z
  .string()
  .regex(/^(http:\/\/127\.0\.0\.1:4000)?\/character\/[A-Za-z0-9_-]{1,80}\.(png|webp)$/, 'not a character image path');

export const MascotConfig = z.object({
  body: z.string(),
  face: z.string(),
  accent: z.string(),
  signature: z.enum(['antenna', 'glasses', 'cap']),
  /** 'robot' (built-in SVG, default) or 'image' (the owner's uploaded character / face). */
  kind: z.enum(['robot', 'image']).optional(),
  images: z.partialRecord(Expression, CharacterImage).optional(),
});
export type MascotConfig = z.infer<typeof MascotConfig>;

export const ReelProps = z.object({
  reel: Reel,
  words: z.array(WordTiming),
  loudness: z.array(z.number()),
  brand: Brand,
  mascot: MascotConfig,
  audioSrc: z.string().nullable(),
  /** Origin for /audio/ files: '' in the web app, http://127.0.0.1:4000 for the renderer. */
  assetBase: z.string().optional(),
  debugSafeZones: z.boolean().optional(),
});
export type ReelProps = z.infer<typeof ReelProps>;
