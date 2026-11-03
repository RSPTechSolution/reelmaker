import { exampleReel } from '../testing.ts';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { startJob } from '../jobs.ts';
import { reelDir } from '../paths.ts';

const app = buildApp({ allowedHosts: ['localhost:80'] }); // app.inject's default Host

// Test-only route that starts a long job, to check the HTTP mapping of the one-job-per-reel rule.
let release: () => void = () => {};
app.post<{ Params: { id: string } }>('/test/slow-job/:id', async (req) => {
  const job = startJob('slow', req.params.id, () => new Promise<void>((r) => (release = r)));
  return { jobId: job.id };
});
app.post<{ Params: { id: string } }>('/test/quick-job/:id', async (req) => {
  const job = startJob('quick', req.params.id, async (ctx) => {
    ctx.progress(0.5, 'half way');
    ctx.log('agent says hi');
    return { ok: 1 };
  });
  return { jobId: job.id };
});

beforeAll(() => app.ready());
afterAll(() => app.close());

async function create(topic = 'AI se video') {
  const res = await app.inject({ method: 'POST', url: '/api/reels', payload: { topic } });
  expect(res.statusCode).toBe(200);
  return res.json();
}

/** A created reel filled with the example's script and cues. */
async function filled() {
  const created = await create();
  const reel = { ...exampleReel(), id: created.id, createdAt: created.createdAt };
  const res = await app.inject({ method: 'PUT', url: `/api/reels/${created.id}`, payload: reel });
  expect(res.statusCode).toBe(200);
  return res.json();
}

describe('reels API', () => {
  it('creates and lists a reel', async () => {
    const reel = await create('Mera pehla reel');
    expect(reel.topic).toBe('Mera pehla reel');
    const list = (await app.inject({ method: 'GET', url: '/api/reels' })).json();
    expect(list.some((s: { id: string }) => s.id === reel.id)).toBe(true);
    const one = (await app.inject({ method: 'GET', url: `/api/reels/${reel.id}` })).json();
    expect(one.reel).toEqual(reel);
    expect(one.status).toEqual({ script: false, voice: 'none', timing: 'none', rendered: false });
  });

  it('POST validates the body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/reels', payload: { topic: '' } });
    expect(res.statusCode).toBe(400);
    const res2 = await app.inject({ method: 'POST', url: '/api/reels', payload: { topic: 'x', targetSeconds: 90 } });
    expect(res2.statusCode).toBe(400);
  });

  it('PUT rejects word-count mismatch with 400', async () => {
    const reel = await filled();
    reel.lines[0].spoken = 'एआई से';
    const res = await app.inject({ method: 'PUT', url: `/api/reels/${reel.id}`, payload: reel });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.issues.some((i: { message: string }) => /caption has 8 words, spoken has 2/.test(i.message))).toBe(true);
  });

  it('PUT rejects a body whose id differs from the URL', async () => {
    const reel = await filled();
    const res = await app.inject({ method: 'PUT', url: `/api/reels/${reel.id}`, payload: { ...reel, id: 'other' } });
    expect(res.statusCode).toBe(400);
  });

  it('PUT keeps server-owned hashes and createdAt', async () => {
    const reel = await filled();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/reels/${reel.id}`,
      payload: { ...reel, hashes: { voice: 'forged' }, createdAt: '2000-01-01T00:00:00.000Z' },
    });
    expect(res.json().hashes).toEqual({});
    expect(res.json().createdAt).toBe(reel.createdAt);
  });

  it.each(['..%2F..%2Fetc', 'CON', 'a%5Cb'])('rejects unsafe :id %s with 400', async (id) => {
    const res = await app.inject({ method: 'GET', url: `/api/reels/${id}` });
    expect(res.statusCode).toBe(400);
  });

  it('GET unknown reel is 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/reels/nope-123' })).statusCode).toBe(404);
  });

  it('GET includes words and report when present', async () => {
    const reel = await filled();
    await writeFile(path.join(reelDir(reel.id), 'words.json'), '[{"i":0}]');
    await writeFile(path.join(reelDir(reel.id), 'report.json'), '{"matched":1}');
    const one = (await app.inject({ method: 'GET', url: `/api/reels/${reel.id}` })).json();
    expect(one.words).toEqual([{ i: 0 }]);
    expect(one.report).toEqual({ matched: 1 });
  });

  it('serves reel files under /files/ but not outside the reels folder', async () => {
    const reel = await filled();
    await writeFile(path.join(reelDir(reel.id), 'hello.txt'), 'hi');
    const ok = await app.inject({ method: 'GET', url: `/files/${reel.id}/hello.txt` });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('hi');
    const ranged = await app.inject({ method: 'GET', url: `/files/${reel.id}/hello.txt`, headers: { range: 'bytes=1-1' } });
    expect(ranged.statusCode).toBe(206);
    const escape = await app.inject({ method: 'GET', url: '/files/..%2Fbrand.json' });
    expect(escape.statusCode).not.toBe(200);
  });
});

describe('settings API', () => {
  it('GET/PUT brand and mascot with validation', async () => {
    const brand = (await app.inject({ method: 'GET', url: '/api/brand' })).json();
    expect(brand.handle).toBe('@yourhandle');
    const put = await app.inject({ method: 'PUT', url: '/api/brand', payload: { ...brand, handle: '@me' } });
    expect(put.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/brand' })).json().handle).toBe('@me');
    const bad = await app.inject({ method: 'PUT', url: '/api/mascot', payload: { body: '#000' } });
    expect(bad.statusCode).toBe(400);
    const mascot = (await app.inject({ method: 'GET', url: '/api/mascot' })).json();
    expect(mascot.signature).toBe('antenna');
  });
});

describe('jobs API', () => {
  it('second job on same reel returns 409', async () => {
    const first = await app.inject({ method: 'POST', url: '/test/slow-job/reel-x' });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: '/test/slow-job/reel-x' });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toMatch(/already running/);
    release();
  });

  it('SSE stream ends with done', async () => {
    const { jobId } = (await app.inject({ method: 'POST', url: '/test/quick-job/reel-y' })).json();
    const res = await app.inject({ method: 'GET', url: `/api/jobs/${jobId}/events` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = [...res.body.matchAll(/^event: (\w+)$/gm)].map((m) => m[1]);
    expect(events).toEqual(['progress', 'log', 'done']);
    expect(res.body).toContain('data: {"text":"agent says hi"}');
  });

  it('SSE for unknown job is 404', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/jobs/nope/events' })).statusCode).toBe(404);
  });
});
