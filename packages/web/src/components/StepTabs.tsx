import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

export type Mark = 'done' | 'stale' | 'todo';
export type TabStep = { key: string; label: string; mark: Mark };

const markStyle: Record<Mark, string> = { done: 'bg-leaf', stale: 'bg-sindoor', todo: 'bg-ink-faint' };
const markWord: Record<Mark, string> = { done: 'done', stale: 'out of date', todo: 'not yet' };
const BASE = 100; // indicator is 100px wide and scaled, so only transform animates

/** Numbered step tabs; an underline slides to the active step. */
export function StepTabs({ reelId, steps, active }: { reelId: string; steps: TabStep[]; active: string }) {
  const list = useRef<HTMLOListElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, steps]);

  return (
    <nav aria-label="Steps" className="relative">
      <ol ref={list} className="relative flex flex-wrap gap-1 border-b border-ink-faint/60">
        {steps.map((s, i) => (
          <li key={s.key}>
            <NavLink
              to={`/reels/${reelId}/${s.key}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-[15px] ${isActive ? 'font-semibold' : 'text-ink-soft hover:text-ink'}`
              }
            >
              <span className={`h-2 w-2 rounded-full ${markStyle[s.mark]}`} aria-hidden />
              <span>
                {i + 1}. {s.label}
              </span>
              <span className="sr-only">({markWord[s.mark]})</span>
            </NavLink>
          </li>
        ))}
        {bar ? (
          <span
            aria-hidden
            className="tab-indicator absolute -bottom-px left-0 h-0.5 bg-ink"
            style={{ width: BASE, transformOrigin: 'left', transform: `translateX(${bar.x}px) scaleX(${bar.w / BASE})` }}
          />
        ) : null}
      </ol>
    </nav>
  );
}
