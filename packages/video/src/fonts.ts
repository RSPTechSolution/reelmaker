import { getAvailableFonts } from '@remotion/google-fonts';
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export const FALLBACK_FONT = 'Baloo 2';
const WEIGHTS = ['400', '600', '700', '800'];

const loaded = new Map<string, Promise<string>>();

/** Loads a Google font by family name (falls back to Baloo 2) and resolves its CSS family. */
export function loadBrandFont(family: string): Promise<string> {
  let p = loaded.get(family);
  if (!p) {
    const fonts = getAvailableFonts();
    const entry = fonts.find((f) => f.fontFamily === family) ?? fonts.find((f) => f.fontFamily === FALLBACK_FONT)!;
    p = entry.load().then(async (font) => {
      const info = font.getInfo();
      const normal = info.fonts.normal ?? {};
      const weights = WEIGHTS.filter((w) => w in normal);
      const subsets = ['latin', 'latin-ext'].filter((s) => info.subsets.includes(s));
      const handle = font.loadFont('normal', {
        ...(weights.length ? { weights } : {}),
        ...(subsets.length ? { subsets } : {}),
        ignoreTooManyRequestsWarning: true,
      });
      await handle.waitUntilDone();
      return handle.fontFamily;
    });
    loaded.set(family, p);
  }
  return p;
}

/** CSS font-family for the brand font; holds the render until the font is ready. */
export function useBrandFont(family: string): string {
  const [css, setCss] = useState(family);
  const [handle] = useState(() => delayRender(`Loading font ${family}`));
  const released = useRef(false);
  useEffect(() => {
    let live = true;
    loadBrandFont(family)
      .then((f) => live && setCss(f))
      .catch(() => live && setCss(FALLBACK_FONT))
      .finally(() => {
        if (!released.current) {
          released.current = true;
          continueRender(handle);
        }
      });
    return () => {
      live = false;
    };
  }, [family, handle]);
  return css;
}
