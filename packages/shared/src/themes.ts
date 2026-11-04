import type { EffectSettings, Reel, ThemeId } from './schema.ts';

export type ThemeInfo = {
  label: string;
  description: string;
  /** default scene transition and caption style (used while the reel has no own `effects`) */
  transition: EffectSettings['transition'];
  captions: EffectSettings['captions'];
  /** drawing-led theme: most main cues should be acted-out scene blocks */
  acts: boolean;
};

export const THEME_INFO: Record<ThemeId, ThemeInfo> = {
  classic: {
    label: 'Classic',
    description: 'your brand colours, rounded cards and the mascot',
    transition: 'slide',
    captions: 'pop',
    acts: false,
  },
  stickman: {
    label: 'Stickman story',
    description: 'white paper, black marker lines that draw themselves, a stickman acting out the idea',
    transition: 'none',
    captions: 'color',
    acts: true,
  },
  objects: {
    label: 'Animated objects',
    description: 'motion graphics: bright flat icons and shapes that fly in, bounce and orbit',
    transition: 'zoom',
    captions: 'bounce',
    acts: true,
  },
  chalkboard: {
    label: 'Chalkboard',
    description: 'dark green board, chalk writing and drawings, a teacher explaining',
    transition: 'none',
    captions: 'pop',
    acts: true,
  },
  comic: {
    label: 'Comic',
    description: 'comic panels, halftone dots, speech bubbles and BOOM-style bursts',
    transition: 'zoom',
    captions: 'bounce',
    acts: false,
  },
  neon: {
    label: 'Neon tech',
    description: 'dark background with a glowing grid and neon outlines, for tech and AI topics',
    transition: 'whip',
    captions: 'pop',
    acts: false,
  },
  paper: {
    label: 'Paper cut-out',
    description: 'textured paper layers with soft shadows sliding in, like a handmade collage',
    transition: 'slide',
    captions: 'bounce',
    acts: false,
  },
  notebook: {
    label: 'Notebook doodle',
    description: 'ruled copy page, blue pen doodles and highlighter, like student notes',
    transition: 'slide',
    captions: 'color',
    acts: true,
  },
  bold: {
    label: 'Bold typography',
    description: 'no pictures: giant words that slam, stretch and stack on solid colour',
    transition: 'whip',
    captions: 'bounce',
    acts: false,
  },
  news: {
    label: 'Breaking news',
    description: 'news studio graphics: headline bars, a ticker and a BREAKING flash',
    transition: 'slide',
    captions: 'color',
    acts: false,
  },
  bollywood: {
    label: 'Retro Bollywood',
    description: 'old film poster: bold lettering, sunburst rays, warm colours and film grain',
    transition: 'zoom',
    captions: 'pop',
    acts: false,
  },
};

/** The reel's theme; reels made before themes are 'classic'. */
export function reelTheme(reel: Pick<Reel, 'theme'>): ThemeId {
  return reel.theme ?? 'classic';
}
