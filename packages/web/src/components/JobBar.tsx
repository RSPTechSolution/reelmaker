import type { JobState } from '../useJob.ts';

/** Progress of a running job, or its error. Nothing when idle or done. */
export function JobBar({ job, running }: { job: JobState; running: string }) {
  if (job.status === 'error') {
    return (
      <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 text-sm font-semibold text-sindoor">
        {job.error}
      </p>
    );
  }
  if (job.status !== 'running') return null;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{running}</span>
        <span className="text-ink-soft">{job.message ?? ''}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-faint/50">
        <div className="h-full bg-marigold transition-[width]" style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </div>
    </div>
  );
}
