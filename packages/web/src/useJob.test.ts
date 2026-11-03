import { describe, expect, it } from 'vitest';
import { JobStream, type EventSourceLike } from './useJob.ts';

/** Fake EventSource: tests push named events into it. */
class FakeSource implements EventSourceLike {
  static last: FakeSource;
  listeners = new Map<string, ((e: MessageEvent | Event) => void)[]>();
  closed = false;
  readyState = 1;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSource.last = this;
  }
  addEventListener(type: string, fn: (e: MessageEvent | Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, data?: unknown) {
    const e = data === undefined ? new Event(type) : new MessageEvent(type, { data: JSON.stringify(data) });
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
}

describe('JobStream (useJob)', () => {
  it('useJob collects logs and finishes', () => {
    const states: string[] = [];
    const stream = new JobStream('j1', FakeSource);
    stream.subscribe(() => states.push(stream.getState().status));
    expect(FakeSource.last.url).toBe('/api/jobs/j1/events');
    expect(stream.getState()).toEqual({ status: 'running', progress: 0, logs: [] });

    FakeSource.last.emit('progress', { progress: 0.4, message: 'voice line 2/6' });
    FakeSource.last.emit('log', { text: 'Script likh raha hoon' });
    FakeSource.last.emit('log', { text: 'Ho gaya!' });
    FakeSource.last.emit('done', { result: { ok: true } });

    expect(stream.getState()).toEqual({
      status: 'done',
      progress: 1,
      message: 'voice line 2/6',
      logs: ['Script likh raha hoon', 'Ho gaya!'],
      result: { ok: true },
    });
    expect(FakeSource.last.closed).toBe(true); // no auto-reconnect replaying the job
    expect(states.at(-1)).toBe('done');
  });

  it('a job error event ends with the server message', () => {
    const stream = new JobStream('j2', FakeSource);
    FakeSource.last.emit('error', { error: 'voice is stale' });
    expect(stream.getState()).toMatchObject({ status: 'error', error: 'voice is stale' });
    expect(FakeSource.last.closed).toBe(true);
  });

  it('a dropped connection (no data) is reported, not mistaken for a job error', () => {
    const stream = new JobStream('j3', FakeSource);
    FakeSource.last.readyState = 2;
    FakeSource.last.emit('error');
    expect(stream.getState()).toMatchObject({ status: 'error', error: expect.stringContaining('Lost connection') });
  });

  it('close() stops listening', () => {
    const stream = new JobStream('j4', FakeSource);
    stream.close();
    FakeSource.last.emit('log', { text: 'late' });
    expect(stream.getState().logs).toEqual([]);
  });
});
