import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.ts';

export type JobEvent =
  | { type: 'progress'; progress: number; message?: string }
  | { type: 'log'; text: string }
  | { type: 'done'; result: unknown }
  | { type: 'error'; error: string };

export type JobContext = { progress(p: number, msg?: string): void; log(text: string): void };

export type Job = {
  id: string;
  kind: string;
  reelId: string;
  status: 'running' | 'done' | 'error';
  progress: number;
  message?: string;
  result?: unknown;
  error?: string;
  /** Every event so far, so a late SSE subscriber can replay them. */
  events: JobEvent[];
};

type Listener = (e: JobEvent) => void;

const MAX_FINISHED = 100;
const jobs = new Map<string, Job>();
const listeners = new Map<string, Set<Listener>>();

function emit(job: Job, e: JobEvent) {
  job.events.push(e);
  for (const l of listeners.get(job.id) ?? []) l(e);
}

function prune() {
  const finished = [...jobs.values()].filter((j) => j.status !== 'running');
  for (const j of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED))) {
    jobs.delete(j.id);
    listeners.delete(j.id);
  }
}

/** Starts fn in the background. Throws HttpError 409 if this reel already has a running job. */
export function startJob(kind: string, reelId: string, fn: (ctx: JobContext) => Promise<unknown>): Job {
  const busy = [...jobs.values()].find((j) => j.reelId === reelId && j.status === 'running');
  if (busy) throw new HttpError(409, `a ${busy.kind} job is already running for this reel`);

  const job: Job = { id: randomUUID(), kind, reelId, status: 'running', progress: 0, events: [] };
  jobs.set(job.id, job);
  const ctx: JobContext = {
    progress(p, msg) {
      if (job.status !== 'running') return;
      job.progress = Math.max(0, Math.min(1, p));
      job.message = msg;
      emit(job, { type: 'progress', progress: job.progress, ...(msg ? { message: msg } : {}) });
    },
    log(text) {
      if (job.status === 'running') emit(job, { type: 'log', text });
    },
  };

  // Start on a later tick so the caller can subscribe before the first event.
  setImmediate(() => {
    Promise.resolve()
      .then(() => fn(ctx))
      .then(
        (result) => {
          job.status = 'done';
          job.progress = 1;
          job.result = result;
          emit(job, { type: 'done', result: result ?? null });
        },
        (err: unknown) => {
          job.status = 'error';
          job.error = err instanceof Error ? err.message : String(err);
          emit(job, { type: 'error', error: job.error });
        },
      )
      .finally(prune);
  });
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Listen to future events of a job. Returns an unsubscribe function. */
export function subscribe(id: string, listener: Listener): () => void {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(listener);
  return () => set.delete(listener);
}
