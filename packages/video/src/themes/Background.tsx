import React, { useMemo } from 'react';
import { HEIGHT, WIDTH } from '@reelmaker/shared';
import { SAFE_BOX } from '../layout.ts';
import { headingStyle, seeded } from './style.ts';
import type { ResolvedTheme } from './types.ts';

const fill: React.CSSProperties = { position: 'absolute', inset: 0 };
const BOLD_BLOCKS = ['#111111', '#C1121F', '#1D3557', '#3A0CA3'];
const FLASH_FRAMES = 14;

/** Static specks (paper fibre, chalk dust, film grain): generated once per theme, never per frame. */
function Specks({ seed, count, color, max, opacity }: { seed: number; count: number; color: string; max: number; opacity: [number, number] }) {
  const dots = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: count }, () => ({
      x: r() * WIDTH,
      y: r() * HEIGHT,
      s: 0.8 + r() * max,
      o: opacity[0] + r() * (opacity[1] - opacity[0]),
    }));
  }, [seed, count, max, opacity]);
  return (
    <svg width={WIDTH} height={HEIGHT} style={fill}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.s} fill={color} opacity={d.o} />
      ))}
    </svg>
  );
}

const PAPER_OPACITY: [number, number] = [0.05, 0.16];
const CHALK_OPACITY: [number, number] = [0.04, 0.2];
const GRAIN_OPACITY: [number, number] = [0.06, 0.22];

function NeonGrid({ frame }: { frame: number }) {
  const horizon = HEIGHT * 0.58;
  const gap = 90;
  const shift = (frame * 3) % gap;
  const rows = Array.from({ length: 12 }, (_, i) => horizon + Math.pow(i * gap + shift, 1.18) / 2.2);
  const cols = Array.from({ length: 17 }, (_, i) => (i - 8) * 150);
  return (
    <svg width={WIDTH} height={HEIGHT} style={fill}>
      <defs>
        <linearGradient id="neon-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39F3FF" stopOpacity={0} />
          <stop offset="1" stopColor="#39F3FF" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <g stroke="url(#neon-fade)" strokeWidth={2}>
        {rows.filter((y) => y < HEIGHT).map((y, i) => (
          <line key={`r${i}`} x1={0} y1={y} x2={WIDTH} y2={y} />
        ))}
        {cols.map((x, i) => (
          <line key={`c${i}`} x1={WIDTH / 2 + x * 0.15} y1={horizon} x2={WIDTH / 2 + x * 1.6} y2={HEIGHT} />
        ))}
      </g>
      <line x1={0} y1={horizon} x2={WIDTH} y2={horizon} stroke="#FF3FD8" strokeWidth={3} opacity={0.8} />
    </svg>
  );
}

function Shapes({ frame }: { frame: number }) {
  const shapes = useMemo(() => {
    const r = seeded(7);
    const colors = ['#FFD166', '#FF6B6B', '#00B894', '#74B9FF', '#FFFFFF'];
    return Array.from({ length: 9 }, (_, i) => ({
      x: r() * WIDTH,
      y: r() * HEIGHT,
      size: 80 + r() * 200,
      round: i % 3 === 0 ? '50%' : i % 3 === 1 ? '28%' : '8%',
      color: colors[i % colors.length],
      speed: 30 + r() * 40,
      phase: r() * 6,
    }));
  }, []);
  return (
    <>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x - s.size / 2,
            top: s.y - s.size / 2,
            width: s.size,
            height: s.size,
            borderRadius: s.round,
            background: s.color,
            opacity: 0.14,
            transform: `translate(${Math.sin(frame / s.speed + s.phase) * 40}px, ${Math.cos(frame / s.speed + s.phase) * 50}px) rotate(${(frame / s.speed) * 20}deg)`,
          }}
        />
      ))}
    </>
  );
}

function PaperLayers({ frame }: { frame: number }) {
  const drift = Math.sin(frame / 60) * 10;
  const layers = [
    { d: `M0 ${HEIGHT * 0.12} Q${WIDTH * 0.3} ${HEIGHT * 0.06} ${WIDTH * 0.6} ${HEIGHT * 0.11} T${WIDTH} ${HEIGHT * 0.08} V0 H0 Z`, c: '#E9D8B8', k: 1 },
    { d: `M0 ${HEIGHT * 0.86} Q${WIDTH * 0.25} ${HEIGHT * 0.8} ${WIDTH * 0.55} ${HEIGHT * 0.85} T${WIDTH} ${HEIGHT * 0.82} V${HEIGHT} H0 Z`, c: '#D9C29A', k: -1 },
    { d: `M0 ${HEIGHT * 0.93} Q${WIDTH * 0.4} ${HEIGHT * 0.89} ${WIDTH * 0.7} ${HEIGHT * 0.94} T${WIDTH} ${HEIGHT * 0.9} V${HEIGHT} H0 Z`, c: '#2F7D6D', k: 1.5 },
  ];
  return (
    <svg width={WIDTH} height={HEIGHT} style={{ ...fill, filter: 'drop-shadow(0 10px 0 rgba(60,40,20,0.18))' }}>
      {layers.map((l, i) => (
        <path key={i} d={l.d} fill={l.c} transform={`translate(0 ${drift * l.k})`} />
      ))}
    </svg>
  );
}

/** Breaking-news flash behind the content when a new scene starts. */
function BreakingFlash({ theme, sinceScene }: { theme: ResolvedTheme; sinceScene: number }) {
  if (sinceScene < 0 || sinceScene >= FLASH_FRAMES) return null;
  const t = sinceScene / FLASH_FRAMES;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: SAFE_BOX.y + SAFE_BOX.h * 0.38,
        height: 170,
        background: theme.brand.accent,
        opacity: 0.85 * (1 - t),
        transform: `translateX(${(t - 0.2) * 260}px) skewX(-12deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 120,
        fontWeight: 700,
        ...headingStyle(theme),
      }}
    >
      BREAKING
    </div>
  );
}

/**
 * Full-frame theme background. Textures are static; motion is a cheap transform of the frame.
 * `sceneIndex` counts started main blocks (bold swaps colour per scene); `sinceScene` = frames since
 * the current main block started (news flash).
 */
export const Background: React.FC<{ theme: ResolvedTheme; frame: number; sceneIndex: number; sinceScene?: number }> = ({
  theme,
  frame,
  sceneIndex,
  sinceScene = -1,
}) => {
  const bg = theme.brand.bg;
  switch (theme.background) {
    case 'brand':
      return null;
    case 'paper':
      return <Specks seed={11} count={260} color="#6B5B45" max={1.6} opacity={PAPER_OPACITY} />;
    case 'shapes':
      return (
        <>
          <div style={{ ...fill, background: `linear-gradient(160deg, ${bg} 0%, #2E2585 100%)` }} />
          <Shapes frame={frame} />
        </>
      );
    case 'chalk':
      return (
        <>
          <div
            style={{
              ...fill,
              background: `radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.07), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(255,255,255,0.05), transparent 50%)`,
            }}
          />
          <Specks seed={23} count={420} color="#FFFFFF" max={1.4} opacity={CHALK_OPACITY} />
          <div style={{ ...fill, border: '26px solid #6B4A2B', boxShadow: 'inset 0 0 0 6px #4A3220' }} />
        </>
      );
    case 'halftone':
      return (
        <>
          <div
            style={{
              ...fill,
              backgroundImage: 'radial-gradient(circle, rgba(200,16,46,0.16) 4px, transparent 4.5px)',
              backgroundSize: '26px 26px',
            }}
          />
          <div style={{ ...fill, inset: 22, border: '10px solid #111111', borderRadius: 6 }} />
        </>
      );
    case 'neonGrid':
      return (
        <>
          <div style={{ ...fill, background: `radial-gradient(ellipse at 50% 58%, #1B1340 0%, ${bg} 60%)` }} />
          <NeonGrid frame={frame} />
        </>
      );
    case 'paperLayers':
      return (
        <>
          <Specks seed={31} count={220} color="#7A5C3A" max={1.5} opacity={PAPER_OPACITY} />
          <PaperLayers frame={frame} />
        </>
      );
    case 'ruled':
      return (
        <>
          <div
            style={{
              ...fill,
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 70px, rgba(27,58,158,0.18) 70px, rgba(27,58,158,0.18) 72px)',
              backgroundPosition: '0 40px',
            }}
          />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 96, width: 3, background: 'rgba(214,40,57,0.45)' }} />
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{ position: 'absolute', left: 28, top: 140 + i * 200, width: 34, height: 34, borderRadius: 17, background: '#E7E3D4' }}
            />
          ))}
        </>
      );
    case 'blocks':
      return <div style={{ ...fill, background: BOLD_BLOCKS[sceneIndex % BOLD_BLOCKS.length] }} />;
    case 'studio':
      return (
        <>
          <div style={{ ...fill, background: `radial-gradient(ellipse at 50% 30%, #1A4CA8 0%, ${bg} 55%, #06173A 100%)` }} />
          <div
            style={{
              ...fill,
              backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 60px, transparent 60px 140px)',
              transform: `translateX(${(frame * 1.5) % 140}px)`,
              left: -140,
            }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: theme.brand.accent }}>
            <div
              style={{
                height: '100%',
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.9) 0 18px, transparent 18px 60px)',
                transform: `translateX(${-(frame * 4) % 60}px)`,
                opacity: 0.35,
              }}
            />
          </div>
          <BreakingFlash theme={theme} sinceScene={sinceScene} />
        </>
      );
    case 'sunburst':
      return (
        <>
          <div
            style={{
              ...fill,
              background: `repeating-conic-gradient(from ${frame * 0.25}deg at 50% 38%, #8A2727 0deg 7deg, ${bg} 7deg 14deg)`,
            }}
          />
          <div style={{ ...fill, background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(20,5,0,0.65) 100%)' }} />
          <div style={{ ...fill, transform: `translate(${(Math.floor(frame / 2) % 3) * 7}px, ${(Math.floor(frame / 2) % 2) * 9}px)` }}>
            <Specks seed={47} count={500} color="#FFF1D6" max={1.3} opacity={GRAIN_OPACITY} />
          </div>
        </>
      );
  }
};
