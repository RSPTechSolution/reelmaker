import './testing.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

// Default allow-list: the real server address only.
const app = buildApp();
beforeAll(() => app.ready());
afterAll(() => app.close());

const create = (headers: Record<string, string>) =>
  app.inject({ method: 'POST', url: '/api/reels', payload: { topic: 'sec' }, headers });

describe('local-only guard', () => {
  it('accepts the real local Host names', async () => {
    for (const host of ['127.0.0.1:4000', 'localhost:4000']) {
      const res = await app.inject({ method: 'GET', url: '/api/reels', headers: { host } });
      expect(res.statusCode, host).toBe(200);
    }
  });

  it('rejects any other Host (DNS rebinding)', async () => {
    for (const host of ['evil.example:4000', 'evil.example', '127.0.0.1.evil.example:4000', '192.168.1.5:4000']) {
      const res = await app.inject({ method: 'GET', url: '/api/reels', headers: { host } });
      expect(res.statusCode, host).toBe(403);
    }
    const files = await app.inject({ method: 'GET', url: '/files/x', headers: { host: 'evil.example:4000' } });
    expect(files.statusCode).toBe(403);
  });

  it('rejects state-changing requests from a foreign Origin', async () => {
    const res = await create({ host: '127.0.0.1:4000', origin: 'https://evil.example' });
    expect(res.statusCode).toBe(403);
    const nullOrigin = await create({ host: '127.0.0.1:4000', origin: 'null' });
    expect(nullOrigin.statusCode).toBe(403);
  });

  it('accepts the app origins and requests without Origin (curl, server-side)', async () => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4000']) {
      expect((await create({ host: '127.0.0.1:4000', origin })).statusCode, origin).toBe(200);
    }
    expect((await create({ host: 'localhost:4000' })).statusCode).toBe(200);
  });
});
