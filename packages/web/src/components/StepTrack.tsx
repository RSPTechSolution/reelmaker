import type { ReelStatus } from '../api.ts';

type StepState = 'done' | 'stale' | 'todo';

export function steps(status: ReelStatus): { label: string; state: StepState }[] {
  const of = (s: 'none' | 'ok' | 'stale'): StepState => (s === 'ok' ? 'done' : s === 'stale' ? 'stale' : 'todo');
  return [
    { label: 'Script', state: status.script ? 'done' : 'todo' },
    { label: 'Voice', state: of(status.voice) },
    { label: 'Captions', state: of(status.timing) },
    { label: 'Render', state: status.rendered ? (status.timing === 'stale' ? 'stale' : 'done') : 'todo' },
  ];
}

const bar: Record<StepState, string> = {
  done: 'bg-leaf',
  stale: 'bg-sindoor',
  todo: 'bg-ink-faint/50',
};
const words: Record<StepState, string> = { done: 'done', stale: 'out of date', todo: 'not yet' };

/** Script → Voice → Captions → Render, as four joined segments. */
export function StepTrack({ status }: { status: ReelStatus }) {
  const list = steps(status);
  return (
    <ol className="grid w-full max-w-72 grid-cols-4 gap-[3px]" aria-label="Progress">
      {list.map((s) => (
        <li key={s.label} aria-label={`${s.label}: ${words[s.state]}`}>
          <div className={`h-1.5 ${bar[s.state]}`} />
          <div className={`mt-1 text-xs ${s.state === 'stale' ? 'font-semibold text-sindoor' : 'text-ink-soft'}`}>
            {s.label}
          </div>
        </li>
      ))}
    </ol>
  );
}
