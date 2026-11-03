import { z } from 'zod';

/** Words are split on any run of whitespace; caption word i is spoken word i. */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export const Line = z
  .object({
    id: z.string().min(1),
    caption: z.string(),
    spoken: z.string(),
  })
  .superRefine((line, ctx) => {
    const c = splitWords(line.caption).length;
    const s = splitWords(line.spoken).length;
    if (c !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['spoken'],
        message: `line ${line.id}: caption has ${c} words, spoken has ${s}`,
      });
    }
  });
export type Line = z.infer<typeof Line>;

export const Expression = z.enum(['happy', 'thinking', 'surprised', 'wink']);
export type Expression = z.infer<typeof Expression>;

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
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block['type'];

export const Cue = z.object({
  id: z.string().min(1),
  atWord: z.number().int().min(0),
  untilWord: z.number().int().min(0).optional(),
  block: Block,
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

/** Total number of words in the script (caption words; equal to spoken words when valid). */
export function totalWords(lines: { caption: string }[]): number {
  return lines.reduce((n, l) => n + splitWords(l.caption).length, 0);
}

export const Reel = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    topic: z.string(),
    hook: z.string().optional(),
    targetSeconds: z.number().int().min(20).max(60),
    lines: z.array(Line),
    voice: VoiceSettings,
    cues: z.array(Cue),
    keywords: z.array(z.string()),
    coverFrame: z.number().int().min(0).optional(),
    hashes: z.object({ voice: z.string().optional(), timing: z.string().optional() }),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((reel, ctx) => {
    const total = totalWords(reel.lines);
    reel.cues.forEach((cue, k) => {
      if (cue.atWord >= total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
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

export const MascotConfig = z.object({
  body: z.string(),
  face: z.string(),
  accent: z.string(),
  signature: z.enum(['antenna', 'glasses', 'cap']),
});
export type MascotConfig = z.infer<typeof MascotConfig>;

export const ReelProps = z.object({
  reel: Reel,
  words: z.array(WordTiming),
  loudness: z.array(z.number()),
  brand: Brand,
  mascot: MascotConfig,
  audioSrc: z.string().nullable(),
  debugSafeZones: z.boolean().optional(),
});
export type ReelProps = z.infer<typeof ReelProps>;
