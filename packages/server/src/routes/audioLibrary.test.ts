import '../testing.ts';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { DATA_DIR } from '../paths.ts';

const AUDIO = path.join(DATA_DIR, 'audio');
const calls: { op: string; args: Record<string, unknown> }[] = [];
// Fake worker: "generates" the built-ins by writing small files.
const worker = {
  async call<T>(op: string, args: object): Promise<T> {
    calls.push({ op, args: args as Record<string, unknown> });
    if (op !== 'assets') throw new Error('unexpected ' + op);
    const dir = (args as { dir: string }).dir;
    await mkdir(path.join(dir, 'sfx'), { recursive: true });
    await mkdir(path.join(dir, 'music'), { recursive: true });
    for (const s of ['whoosh', 'pop', 'ding', 'boom', 'riser']) await writeFile(path.join(dir, 'sfx', `${s}.wav`), 'RIFF');
    for (const m of ['lofi', 'upbeat', 'dramatic']) await writeFile(path.join(dir, 'music', `builtin-${m}.wav`), 'RIFF');
    return { sfx: [], music: [], labels: { lofi: 'Lo-fi chill', upbeat: 'Upbeat pop', dramatic: 'Dramatic' } } as T;
  },
};
const app = buildApp({ allowedHosts: ['localhost:80'], worker });
beforeAll(() => app.ready());
afterAll(() => app.close());

const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64, 1)]);
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)]);
const M4A = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(64)]);
function multipart(filename: string, content: Buffer) {
  const b = '----audio';
  return {
    payload: Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
    headers: { 'content-type': `multipart/form-data; boundary=${b}` },
  };
}
const upload = (name: string, content: Buffer) => app.inject({ method: 'POST', url: '/api/audio/music', ...multipart(name, content) });

describe('audio library', () => {
  it('generates the built-ins on first use and lists them', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/audio' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sfx).toEqual(['whoosh', 'pop', 'ding', 'boom', 'riser']);
    expect(body.music).toEqual([
      { file: 'builtin-lofi.wav', label: 'Lo-fi chill', kind: 'builtin' },
      { file: 'builtin-upbeat.wav', label: 'Upbeat pop', kind: 'builtin' },
      { file: 'builtin-dramatic.wav', label: 'Dramatic', kind: 'builtin' },
    ]);
    expect(calls.filter((c) => c.op === 'assets')).toHaveLength(1);
    await app.inject({ method: 'GET', url: '/api/audio' });
    expect(calls.filter((c) => c.op === 'assets')).toHaveLength(1); // not regenerated
    expect((await app.inject({ method: 'GET', url: '/audio/sfx/pop.wav' })).statusCode).toBe(200);
  });

  it('uploads my own tracks under a safe name and lists them', async () => {
    const res = await upload('My Song (final).mp3', MP3);
    expect(res.statusCode).toBe(200);
    const file = res.json().file as string;
    expect(file).toMatch(/^upload-my-song-final-[0-9a-f]{8}\.mp3$/);
    expect(existsSync(path.join(AUDIO, 'music', file))).toBe(true);
    expect((await upload('beat.wav', WAV)).json().file).toMatch(/\.wav$/);
    expect((await upload('voice memo.m4a', M4A)).json().file).toMatch(/\.m4a$/);
    const list = (await app.inject({ method: 'GET', url: '/api/audio' })).json().music;
    expect(list.find((m: { file: string }) => m.file === file)).toEqual({ file, label: 'My Song (final)', kind: 'upload' });
  });

  it('rejects files that are not audio', async () => {
    expect((await upload('song.mp3', Buffer.from('<html>not audio</html>'))).statusCode).toBe(400);
  });

  it('deletes uploads but never the built-ins', async () => {
    const file = (await upload('temp.mp3', MP3)).json().file as string;
    expect((await app.inject({ method: 'DELETE', url: `/api/audio/music/${file}` })).statusCode).toBe(200);
    expect(existsSync(path.join(AUDIO, 'music', file))).toBe(false);
    expect((await app.inject({ method: 'DELETE', url: '/api/audio/music/builtin-lofi.wav' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/api/audio/music/..%2F..%2Fbrand.json' })).statusCode).toBe(400);
  });
});
