import type { JobState } from '../useJob.ts';

/** A job's progress (with a shimmer while it runs), its error, or a ✓ confirmation when it finishes. */
export function JobBar({ job, running, done }: { job: JobState; running: string; done?: string }) {
  if (job.status === 'error') {
    return (
      <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 text-sm font-semibold text-sindoor">
        {job.error}
      </p>
    );
  }
  if (job.status === 'done') {
    return done ? (
      <p role="status" className="job-done flex items-center gap-2 text-sm font-semibold text-leaf">
        ✓ {done}
      </p>
    ) : null;
  }
  if (job.status !== 'running') return null;
  const pct = Math.round(job.progress * 100);
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{running}</span>
        <span className="text-ink-soft">{job.message ?? ''}</span>
      </div>
      <div
        role="progressbar"
        aria-label={running}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="relative h-1.5 overflow-hidden rounded bg-ink-faint/50"
      >
        <div className="job-fill h-full origin-left bg-marigold" style={{ transform: `scaleX(${Math.max(0.02, job.progress)})` }} />
        <div className="job-shimmer pointer-events-none absolute inset-0" aria-hidden />
      </div>
    </div>
  );
}
