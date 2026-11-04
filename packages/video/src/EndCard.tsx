import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText, SAFE_BOX } from './layout.ts';
import { headingStyle } from './themes/style.ts';
import type { ResolvedTheme } from './themes/types.ts';

export const END_CARD_FRAMES = 45;

/** Last 1.5 s: handle + "Follow for more", inside the safe box. */
export const EndCard: React.FC<{ theme: ResolvedTheme; start: number }> = ({ theme, start }) => {
  const brand = theme.brand;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame - start, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pop = spring({ frame: frame - start - 4, fps, config: { damping: 12 } });
  return (
    <div style={{ position: 'absolute', inset: 0, background: brand.bg, opacity: fade }}>
      <div
        style={{
          position: 'absolute',
          left: SAFE_BOX.x,
          top: SAFE_BOX.y,
          width: SAFE_BOX.w,
          height: SAFE_BOX.h,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          transform: `scale(${0.7 + 0.3 * pop})`,
        }}
      >
        <div style={{ fontSize: fitText(brand.handle, SAFE_BOX.w, 110, 48, 1, theme.charWidth), fontWeight: 800, color: theme.onBg.accent, ...headingStyle(theme) }}>
          {brand.handle}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            // classic keeps today's white-on-ink button; themes invert their own background
            color: theme.id === 'classic' ? '#FFFFFF' : brand.bg,
            background: theme.onBg.text,
            padding: '20px 56px',
            borderRadius: 999,
          }}
        >
          Follow for more
        </div>
      </div>
    </div>
  );
};
