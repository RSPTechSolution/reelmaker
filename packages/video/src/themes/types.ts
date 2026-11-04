import type { Brand, ThemeId } from '@reelmaker/shared';

/** How a theme draws the stickman and the objects. */
export type InkStyle = {
  stroke: string;
  fill: string;
  accent: string;
  width: number;
  /** lines draw themselves on (stroke-dashoffset) instead of popping in */
  drawOn: boolean;
  /** 0–3 px deterministic jitter, re-rolled every 4 frames (hand-drawn "boil") */
  boil: number;
  /** neon: drop-shadow colour */
  glow?: string;
  /** paper: offset shadow colour */
  shadow?: string;
};

export type BackgroundKind =
  | 'brand'
  | 'paper'
  | 'shapes'
  | 'chalk'
  | 'halftone'
  | 'neonGrid'
  | 'paperLayers'
  | 'ruled'
  | 'blocks'
  | 'studio'
  | 'sunburst';
export type SurfaceKind =
  | 'brand'
  | 'marker'
  | 'flat'
  | 'chalk'
  | 'bubble'
  | 'neon'
  | 'cutout'
  | 'note'
  | 'type'
  | 'lowerThird'
  | 'poster';
export type StickerKind = 'pill' | 'burst' | 'tape' | 'neon' | 'stamp' | 'flash';

export type ResolvedTheme = {
  id: ThemeId;
  /** colours/font/radius the blocks read; the handle is always the owner's */
  brand: Brand;
  /** Google font families */
  headingFont: string;
  bodyFont: string;
  /** average glyph width / font size, for fitText (Baloo 2 = 0.55) */
  charWidth: number;
  uppercase: boolean;
  /** CSS text-shadow for headings (neon glow) */
  textGlow?: string;
  background: BackgroundKind;
  surface: SurfaceKind;
  sticker: StickerKind;
  ink: InkStyle;
  presenter: 'mascot' | 'stickman' | 'none';
  /** CSS filter on the mascot wrapper (ink outline / neon glow) */
  mascotFilter?: string;
  /** backdrop = the solid colour behind the captions (the plate's colour when plate is true) */
  caption: { backdrop: string; plate: boolean; spoken: string; keyword: string; upcoming: string };
  confetti: string[];
};
