import { useEffect, useState, useSyncExternalStore } from 'react';

export type JobState = {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  message?: string;
  logs: string[];
  error?: string;
  result?: unknown;
};

export type EventSourceLike = {
  readyState: number;
  addEventListener(type: string, fn: (e: MessageEvent | Event) => void): void;
  close(): void;
};
type EventSourceCtor = new (url: string) => EventSourceLike;

const IDLE: JobState = { status: 'idle', progress: 0, logs: [] };
const CLOSED = 2;

/** Follows one job's SSE stream (`progress`, `log`, `done`, `error`) as an external store. */
export class JobStream {
  private state: JobState = { status: 'running', progress: 0, logs: [] };
  private listeners = new Set<() => void>();
  private source: EventSourceLike;
  private open = true;

  constructor(jobId: string, Source: EventSourceCtor = EventSource as unknown as EventSourceCtor) {
    this.source = new Source(`/api/jobs/${encodeURIComponent(jobId)}/events`);
    const on = (type: string, fn: (data: Record<string, unknown>) => Partial<JobState>, end = false) =>
      this.source.addEventListener(type, (e) => {
        if (!this.open) return;
        const raw = (e as MessageEvent).data;
        if (raw === undefined || raw === null || raw === '') {
          // EventSource's own error event carries no data: the connection dropped.
          if (type === 'error' && this.source.readyState === CLOSED) {
            this.set({ status: 'error', error: 'Lost connection to the server. Check that it is still running.' });
            this.close();
          }
          return;
        }
        this.set(fn(JSON.parse(raw)));
        // Close after done/error, or EventSource reconnects and replays the whole job.
        if (end) this.close();
      });
    on('progress', (d) => ({ progress: d.progress as number, ...(d.message ? { message: d.message as string } : {}) }));
    on('log', (d) => ({ logs: [...this.state.logs, d.text as string] }));
    on('done', (d) => ({ status: 'done', progress: 1, result: d.result }), true);
    on('error', (d) => ({ status: 'error', error: d.error as string }), true);
  }

  getState = (): JobState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  close() {
    this.open = false;
    this.source.close();
  }

  private set(patch: Partial<JobState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
}

const idleStore = { getState: () => IDLE, subscribe: () => () => {} };

/** Live state of a job; idle when jobId is null. */
export function useJob(jobId: string | null): JobState {
  const [stream, setStream] = useState<JobStream | null>(null);
  useEffect(() => {
    if (!jobId) {
      setStream(null);
      return;
    }
    const s = new JobStream(jobId);
    setStream(s);
    return () => s.close();
  }, [jobId]);
  const store = stream ?? idleStore;
  return useSyncExternalStore(store.subscribe, store.getState);
}
