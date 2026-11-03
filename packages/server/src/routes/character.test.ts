import '../testing.ts';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { DATA_DIR } from '../paths.ts';

const app = buildApp({ allowedHosts: ['localhost:80'] });
beforeAll(() => app.ready());
afterAll(() => app.close());

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64, 2)]);

function multipart(filename: string, content: Buffer, type: string) {
  const b = '----character';
  return {
    payload: Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    headers: { 'content-type': `multipart/form-data; boundary=${b}` },
  };
}
const upload = (expression: string, name: string, content: Buffer, type = 'image/png') =>
  app.inject({ method: 'POST', url: `/api/mascot/image/${expression}`, ...multipart(name, content, type) });
const mascotDir = () => path.join(DATA_DIR, 'mascot');

describe('character images', () => {
  it('uploads a PNG for an expression, records its path and serves it', async () => {
    const res = await upload('happy', 'me.png', PNG);
    expect(res.statusCode).toBe(200);
    const happy = res.json().images.happy as string;
    expect(happy).toMatch(/^\/character\/happy-[0-9a-f]{8}\.png$/);
    expect(existsSync(path.join(mascotDir(), path.basename(happy)))).toBe(true);
    const served = await app.inject({ method: 'GET', url: happy });
    expect(served.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/mascot' })).json().images.happy).toBe(happy);
  });

  it('replacing an image removes the old file', async () => {
    const first = (await upload('wink', 'a.png', PNG)).json().images.wink as string;
    const second = (await upload('wink', 'b.webp', WEBP, 'image/webp')).json().images.wink as string;
    expect(second).toMatch(/\.webp$/);
    expect(existsSync(path.join(mascotDir(), path.basename(first)))).toBe(false);
    expect(readdirSync(mascotDir()).filter((f) => f.startsWith('wink-'))).toHaveLength(1);
  });

  it('rejects files that are not PNG/WebP and unknown expressions', async () => {
    expect((await upload('happy', 'x.png', Buffer.from('<svg onload=alert(1)>'))).statusCode).toBe(400);
    expect((await upload('happy', 'x.png', Buffer.from('GIF89a' + 'x'.repeat(40)), 'image/png')).statusCode).toBe(400);
    expect((await upload('angry', 'x.png', PNG)).statusCode).toBe(400);
  });

  it('decides the type from the bytes, not the file name', async () => {
    const res = await upload('surprised', 'photo.gif', PNG, 'image/gif');
    expect(res.statusCode).toBe(200);
    expect(res.json().images.surprised).toMatch(/\.png$/);
  });

  it('DELETE removes the image for one expression', async () => {
    const file = (await upload('sad', 's.png', PNG)).json().images.sad as string;
    const res = await app.inject({ method: 'DELETE', url: '/api/mascot/image/sad' });
    expect(res.statusCode).toBe(200);
    expect(res.json().images?.sad).toBeUndefined();
    expect(existsSync(path.join(mascotDir(), path.basename(file)))).toBe(false);
  });

  it('PUT /api/mascot cannot point images outside /character/', async () => {
    const m = (await app.inject({ method: 'GET', url: '/api/mascot' })).json();
    const res = await app.inject({ method: 'PUT', url: '/api/mascot', payload: { ...m, images: { happy: 'https://evil.example/x.png' } } });
    expect(res.statusCode).toBe(400);
  });
});
