import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { splitWords, totalWords, type Line, type Reel } from '@reelmaker/shared';
import { ApiError } from '../api.ts';

const WORDS_PER_SEC = 2.3;

function nextId(lines: Line[]): string {
  const max = lines.reduce((m, l) => Math.max(m, Number(/^l(\d+)$/.exec(l.id)?.[1] ?? 0)), 0);
  return `l${max + 1}`;
}

/**
 * Script editor: each line twice (Roman caption, Devanagari spoken) with live word counts.
 * Save stays disabled while any line's counts differ. `agent` is the Ask-agent panel slot.
 */
export function ScriptStep({
  reel,
  onSave,
  agent,
}: {
  reel: Reel;
  onSave: (reel: Reel) => Promise<Reel> | void;
  agent?: ReactNode;
}) {
  const [lines, setLines] = useState<Line[]>(reel.lines);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setLines(reel.lines), [reel.lines]);

  const counts = lines.map((l) => [splitWords(l.caption).length, splitWords(l.spoken).length] as const);
  const mismatched = counts.filter(([c, s]) => c !== s).length;
  const empty = lines.some((l) => !l.caption.trim());
  const dirty = useMemo(() => JSON.stringify(lines) !== JSON.stringify(reel.lines), [lines, reel.lines]);
  const words = totalWords(lines);

  const update = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const move = (i: number, by: number) => {
    const next = [...lines];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setLines(next);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...reel, lines });
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...(e.issues ?? []).map((i) => i.message)].join(' — ') : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          {words} words, about {Math.round(words / WORDS_PER_SEC)} s{' '}
          <span className="text-ink-faint">(target {reel.targetSeconds} s)</span>
        </p>
        <div className="flex items-center gap-3">
          <span role="status" className={`text-sm ${mismatched ? 'font-semibold text-sindoor' : 'text-ink-soft'}`}>
            {mismatched
              ? `${mismatched} ${mismatched === 1 ? 'line needs' : 'lines need'} the same number of words in both rows`
              : dirty
                ? 'Unsaved changes'
                : ''}
          </span>
          <button className="btn-primary" onClick={save} disabled={!dirty || mismatched > 0 || empty || saving}>
            Save script
          </button>
        </div>
      </div>
      {error ? <p className="text-sm font-semibold text-sindoor">{error}</p> : null}

      {lines.length === 0 ? (
        <p className="text-ink-soft">No lines yet. Ask the agent to write the script, or add a line.</p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {lines.map((l, i) => {
          const [c, s] = counts[i];
          const bad = c !== s;
          const n = i + 1;
          return (
            <li
              key={l.id}
              aria-invalid={bad}
              className={`grid grid-cols-[2rem_1fr_auto] gap-x-3 gap-y-1.5 rounded-md bg-paper p-3 ${bad ? 'ring-2 ring-sindoor/60' : ''}`}
            >
              <span className="row-span-2 pt-2 text-sm font-semibold text-ink-soft">{n}</span>
              <input
                className="field"
                aria-label={`Line ${n} caption (Roman)`}
                value={l.caption}
                onChange={(e) => update(i, { caption: e.target.value })}
              />
              <div className="row-span-2 flex flex-col items-end justify-between gap-1">
                <span className={`text-xs ${bad ? 'font-semibold text-sindoor' : 'text-ink-soft'}`}>
                  {bad ? `${c} words vs ${s}` : `${c} words`}
                </span>
                <div className="flex gap-1">
                  <button className="btn-quiet px-2 py-1 text-sm" aria-label={`Move line ${n} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button
                    className="btn-quiet px-2 py-1 text-sm"
                    aria-label={`Move line ${n} down`}
                    disabled={i === lines.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="btn-quiet px-2 py-1 text-sm"
                    aria-label={`Remove line ${n}`}
                    onClick={() => setLines(lines.filter((_, k) => k !== i))}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <input
                className="field text-ink-soft"
                lang="hi"
                aria-label={`Line ${n} spoken (Devanagari)`}
                value={l.spoken}
                onChange={(e) => update(i, { spoken: e.target.value })}
              />
            </li>
          );
        })}
      </ol>
      <div>
        <button className="btn-quiet" onClick={() => setLines([...lines, { id: nextId(lines), caption: '', spoken: '' }])}>
          Add line
        </button>
      </div>
      {agent}
    </div>
  );
}
