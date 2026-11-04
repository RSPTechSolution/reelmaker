import React from 'react';
import type { ResolvedTheme } from './types.ts';

/** Hand-drawn rectangle outline (marker / chalk), slightly uneven on purpose. */
function RoughFrame({ color, width }: { color: string; width: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: -6, width: 'calc(100% + 12px)', height: 'calc(100% + 12px)', overflow: 'visible' }}
    >
      <path
        d="M2 3 Q50 0.5 98 2.5 Q99.5 50 97.5 97 Q50 99.5 2.5 98 Q0.5 50 2 3 M4 1.5 L96 4"
        fill="none"
        stroke={color}
        strokeWidth={width}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The themed panel behind a card (and other boxed blocks). Children supply the content. */
export const Surface: React.FC<{ theme: ResolvedTheme; children: React.ReactNode; style?: React.CSSProperties }> = ({
  theme,
  children,
  style,
}) => {
  const b = theme.brand;
  const base: React.CSSProperties = { position: 'relative', padding: 56, ...style };
  switch (theme.surface) {
    case 'brand':
      return (
        <div
          style={{
            ...base,
            background: b.surface,
            borderRadius: b.radius,
            boxShadow: '0 24px 60px rgba(20,22,26,0.12)',
            borderTop: `14px solid ${b.accent}`,
          }}
        >
          {children}
        </div>
      );
    case 'marker':
      return (
        <div style={{ ...base, background: b.surface, transform: 'rotate(-1deg)' }}>
          <RoughFrame color={theme.ink.stroke} width={7} />
          {children}
        </div>
      );
    case 'chalk':
      return (
        <div style={{ ...base, background: 'rgba(255,255,255,0.03)' }}>
          <RoughFrame color="rgba(244,241,232,0.85)" width={5} />
          {children}
        </div>
      );
    case 'flat':
      return (
        <div style={{ ...base, background: b.surface, borderRadius: b.radius, boxShadow: '0 30px 0 rgba(20,10,60,0.25)' }}>
          {children}
        </div>
      );
    case 'bubble':
      return (
        <div
          style={{
            ...base,
            background: b.surface,
            border: '7px solid #111111',
            borderRadius: b.radius,
            boxShadow: '12px 12px 0 #111111',
          }}
        >
          {children}
          <svg width={90} height={70} style={{ position: 'absolute', left: 70, bottom: -64 }}>
            <path d="M4 0 L30 66 L76 0" fill={b.surface} stroke="#111111" strokeWidth={7} strokeLinejoin="round" />
            <path d="M8 -6 h66 v10 h-66 z" fill={b.surface} />
          </svg>
        </div>
      );
    case 'neon':
      return (
        <div
          style={{
            ...base,
            background: 'rgba(17,24,39,0.88)',
            border: `4px solid ${b.accent}`,
            borderRadius: b.radius,
            boxShadow: `0 0 28px rgba(57,243,255,0.55), inset 0 0 22px rgba(57,243,255,0.25)`,
          }}
        >
          {children}
        </div>
      );
    case 'cutout':
      return (
        <div
          style={{
            ...base,
            background: b.surface,
            borderRadius: b.radius,
            transform: 'rotate(-1.5deg)',
            boxShadow: '10px 14px 0 rgba(60,40,20,0.25)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -26,
              left: '50%',
              width: 170,
              height: 48,
              marginLeft: -85,
              background: 'rgba(244,211,94,0.75)',
              transform: 'rotate(3deg)',
            }}
          />
          {children}
        </div>
      );
    case 'note':
      return (
        <div style={{ ...base, background: '#FFF59D', transform: 'rotate(1.5deg)', boxShadow: '0 18px 30px rgba(27,42,107,0.18)' }}>
          {children}
        </div>
      );
    case 'type':
      return <div style={{ ...base, padding: 0 }}>{children}</div>;
    case 'lowerThird':
      return (
        <div style={{ ...base, background: b.surface, borderLeft: `26px solid ${b.accent}`, boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}>
          {children}
        </div>
      );
    case 'poster':
      return (
        <div
          style={{
            ...base,
            background: b.surface,
            borderRadius: b.radius,
            border: `8px solid ${b.text}`,
            outline: `5px solid ${b.accent2}`,
            outlineOffset: -22,
            boxShadow: '0 20px 50px rgba(20,5,0,0.5)',
          }}
        >
          {children}
        </div>
      );
  }
};
