import type { AudioSettings, EffectSettings, Reel } from './schema.ts';

export const DEFAULT_AUDIO: AudioSettings = { sfx: true, sfxVolume: 0.6 };
export const DEFAULT_EFFECTS: EffectSettings = { transition: 'slide', captions: 'pop', emotion: true };

/** The reel's sound settings, or the defaults (SFX on, no music). */
export function audioSettings(reel: Pick<Reel, 'audio'>): AudioSettings {
  return reel.audio ?? DEFAULT_AUDIO;
}

/** The reel's animation settings, or the defaults. */
export function effectSettings(reel: Pick<Reel, 'effects'>): EffectSettings {
  return reel.effects ?? DEFAULT_EFFECTS;
}

export const SFX_NAMES = ['swipe', 'tick', 'bubble', 'ding', 'boom', 'riser'] as const;
/** Version of the built-in sounds; equals ASSETS_VERSION in py/ops/assets.py. */
export const AUDIO_ASSETS_VERSION = 2;
export type SfxName = (typeof SFX_NAMES)[number];
