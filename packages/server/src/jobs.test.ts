import './testing.ts';
import { describe, expect, it } from 'vitest';
import { getJob, startJob, subscribe, type JobEvent } from './jobs.ts';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('jobs', () => {
  it('runs fn, records progress/log events and finishes with done', async () => {
    const job = startJob('test', 'reel-a', async (ctx) => {
      ctx.progress(0.5, 'half');
      ctx.log('hello');
      return { answer: 42 };
    });
    const seen: JobEvent[] = [];
    subscribe(job.id, (e) => seen.push(e));
    await tick();
    await tick();
    expect(getJob(job.id)!.status).toBe('done');
    expect(seen.map((e) => e.type)).toEqual(['progress', 'log', 'done']);
    expect(seen.at(-1)).toEqual({ type: 'done', result: { answer: 42 } });
    expect(getJob(job.id)!.progress).toBe(1);
  });

  it('a thrown error ends the job with an error event', async () => {
    const job = startJob('test', 'reel-b', async () => {
      throw new Error('boom');
    });
    await tick();
    await tick();
    expect(getJob(job.id)).toMatchObject({ status: 'error', error: 'boom' });
    expect(job.events.at(-1)).toEqual({ type: 'error', error: 'boom' });
  });

  it('second job on same reel is refused with 409 while the first runs', async () => {
    let finish!: () => void;
    const first = startJob('voice', 'reel-c', () => new Promise<void>((r) => (finish = r)));
    expect(() => startJob('timing', 'reel-c', async () => {})).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => startJob('timing', 'reel-d', async () => {})).not.toThrow();
    await tick();
    finish();
    await tick();
    expect(getJob(first.id)!.status).toBe('done');
    expect(() => startJob('timing', 'reel-c', async () => {})).not.toThrow();
  });

  it('unsubscribe stops events', async () => {
    let go!: () => void;
    const job = startJob('test', 'reel-e', async (ctx) => {
      await new Promise<void>((r) => (go = r));
      ctx.log('late');
    });
    const seen: JobEvent[] = [];
    const off = subscribe(job.id, (e) => seen.push(e));
    off();
    await tick();
    go();
    await tick();
    expect(seen).toEqual([]);
  });
});
