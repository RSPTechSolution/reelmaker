import type { AudioSettings, EffectSettings, Reel, ThemeId } from './schema.ts';
import { reelTheme, THEME_INFO } from './themes.ts';

export const DEFAULT_AUDIO: AudioSettings = { sfx: true, sfxVolume: 0.6 };
export const DEFAULT_EFFECTS: EffectSettings = { transition: 'slide', captions: 'pop', emotion: true };

/** The reel's sound settings, or the defaults (SFX on, no music). */
export function audioSettings(reel: Pick<Reel, 'audio'>): AudioSettings {
  return reel.audio ?? DEFAULT_AUDIO;
}

/** The reel's animation settings, or its theme's transition and caption style (emotion on). */
export function effectSettings(reel: Pick<Reel, 'effects' | 'theme'>): EffectSettings {
  return reel.effects ?? effectsForTheme(undefined, reelTheme(reel));
}

/** Settings after switching to `theme`: its transition and caption style, keeping the owner's emotion choice. */
export function effectsForTheme(current: EffectSettings | undefined, theme: ThemeId): EffectSettings {
  const { transition, captions } = THEME_INFO[theme];
  return { transition, captions, emotion: current?.emotion ?? DEFAULT_EFFECTS.emotion };
}

export const SFX_NAMES = ['swipe', 'tick', 'bubble', 'ding', 'boom', 'riser'] as const;
/** Version of the built-in sounds; equals ASSETS_VERSION in py/ops/assets.py. */
export const AUDIO_ASSETS_VERSION = 2;
export type SfxName = (typeof SFX_NAMES)[number];
