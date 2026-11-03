import { exampleReel } from '../testing.ts';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spokenHash, type Reel } from '@reelmaker/shared';
import { buildApp } from '../app.ts';
import { getJob } from '../jobs.ts';
import { reelDir } from '../paths.ts';
import { getReel, saveReel } from '../store.ts';

type Call = { op: string; args: Record<string, unknown> };
const calls: Call[] = [];
let ttsHook: (() => Promise<void>) | null = null;

// Mocked Python bridge: records calls and writes the files the real ops would.
const worker = {
  async call<T>(op: string, args: object, onProgress?: (p: number, m: string) => void): Promise<T> {
    const a = args as Record<string, unknown>;
    calls.push({ op, args: a });
    onProgress?.(0.5, 'working');
    const dir = a.dir as string;
    if (op === 'tts') {
      if (ttsHook) await ttsHook();
      await writeFile(path.join(dir, 'vo.wav'), 'RIFF');
      return { windows: [[0, 1], [1.15, 2]], duration: 2 } as T;
    }
    if (op === 'timing') {
      await writeFile(path.join(dir, 'words.json'), '[]');
      return { matched: 38, filled: 2, filledRanges: [[3, 4, 1.0, 1.4]] } as T;
    }
    throw new Error(`unexpected op ${op}`);
  },
};

const converted: { input: string; output: string }[] = [];
async function convertAudio(input: string, output: string) {
  converted.push({ input, output });
  await writeFile(output, 'RIFF-converted');
}

const app = buildApp({ allowedHosts: ['localhost:80'], worker, convertAudio });
beforeAll(() => app.ready());
afterAll(() => app.close());

let n = 0;
async function reelWithScript(): Promise<Reel> {
  const reel = { ...exampleReel(), id: `audio-${++n}` };
  await mkdir(reelDir(reel.id), { recursive: true });
  return saveReel(reel);
}

async function finished(jobId: string) {
  for (let i = 0; i < 200; i++) {
    const job = getJob(jobId)!;
    if (job.status !== 'running') return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('job did not finish');
}

async function post(url: string, payload?: object) {
  return app.inject({ method: 'POST', url, payload: payload ?? {} });
}

describe('voice job', () => {
  it('voice job sets voice hash', async () => {
    const reel = await reelWithScript();
    const res = await post(`/api/reels/${reel.id}/voice`);
    expect(res.statusCode).toBe(200);
    const job = await finished(res.json().jobId);
    expect(job.status).toBe('done');

    const saved = await getReel(reel.id);
    expect(saved.hashes.voice).toBe(spokenHash(saved));
    const windows = JSON.parse(await readFile(path.join(reelDir(reel.id), 'windows.json'), 'utf8'));
    expect(windows).toEqual([[0, 1], [1.15, 2]]);

    const call = calls.at(-1)!;
    expect(call.op).toBe('tts');
    expect(call.args).toMatchObject({ voice: 'hf_alpha', speed: 1, dir: reelDir(reel.id) });
    expect(call.args.lines).toEqual(reel.lines.map((l) => ({ id: l.id, spoken: l.spoken })));
    expect(call.args.only).toBeUndefined();
    expect(job.events.some((e) => e.type === 'progress')).toBe(true);
  });

  it('passes only[] through and rejects unknown line ids', async () => {
    const reel = await reelWithScript();
    const ok = await post(`/api/reels/${reel.id}/voice`, { only: ['l2'] });
    await finished(ok.json().jobId);
    expect(calls.at(-1)!.args.only).toEqual(['l2']);
    const bad = await post(`/api/reels/${reel.id}/voice`, { only: ['nope'] });
    expect(bad.statusCode).toBe(400);
  });

  it('records the hash of the text it voiced, not text edited meanwhile', async () => {
    const reel = await reelWithScript();
    const voicedHash = spokenHash(reel);
    ttsHook = async () => {
      const edited = structuredClone(await getReel(reel.id));
      edited.lines[0].spoken = edited.lines[0].spoken.replace('एआई', 'आई');
      await saveReel(edited);
    };
    try {
      await finished((await post(`/api/reels/${reel.id}/voice`)).json().jobId);
    } finally {
      ttsHook = null;
    }
    const saved = await getReel(reel.id);
    expect(saved.hashes.voice).toBe(voicedHash);
    const status = (await app.inject({ method: 'GET', url: `/api/reels/${reel.id}` })).json().status;
    expect(status.voice).toBe('stale');
  });

  it('new voice audio clears the timing hash', async () => {
    const reel = await reelWithScript();
    await saveReel({ ...reel, hashes: { timing: spokenHash(reel) } });
    await finished((await post(`/api/reels/${reel.id}/voice`)).json().jobId);
    expect((await getReel(reel.id)).hashes.timing).toBeUndefined();
  });

  it('refuses a reel without lines', async () => {
    const reel = await reelWithScript();
    await saveReel({ ...reel, lines: [], cues: [] });
    expect((await post(`/api/reels/${reel.id}/voice`)).statusCode).toBe(409);
  });
});

describe('timing job', () => {
  it('timing refuses when voice stale', async () => {
    const reel = await reelWithScript();
    await finished((await post(`/api/reels/${reel.id}/voice`)).json().jobId);
    const edited = await getReel(reel.id);
    edited.lines[0].spoken = edited.lines[0].spoken.replace('एआई', 'आई');
    await saveReel(edited);
    const res = await post(`/api/reels/${reel.id}/timing`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('voice is stale');
  });

  it('refuses when there is no voice yet', async () => {
    const reel = await reelWithScript();
    const res = await post(`/api/reels/${reel.id}/timing`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/no voice/);
  });

  it('sends words, windows and prompt; stores report and timing hash', async () => {
    const reel = await reelWithScript();
    await finished((await post(`/api/reels/${reel.id}/voice`)).json().jobId);
    const job = await finished((await post(`/api/reels/${reel.id}/timing`)).json().jobId);
    expect(job.status).toBe('done');

    const call = calls.at(-1)!;
    expect(call.op).toBe('timing');
    expect(call.args.windows).toEqual([[0, 1], [1.15, 2]]);
    expect(call.args.prompt).toBe(reel.lines.map((l) => l.spoken).join(' '));
    const words = call.args.words as { i: number; caption: string; spoken: string; line: number }[];
    expect(words).toHaveLength(40);
    expect(words[9]).toEqual({ i: 9, caption: '3', spoken: 'तीन', line: 1 });
    expect(words.at(-1)!.line).toBe(5);

    const saved = await getReel(reel.id);
    expect(saved.hashes.timing).toBe(spokenHash(saved));
    const report = JSON.parse(readFileSync(path.join(reelDir(reel.id), 'report.json'), 'utf8'));
    expect(report).toEqual({ matched: 38, filled: 2, filledRanges: [[3, 4, 1.0, 1.4]] });
    const status = (await app.inject({ method: 'GET', url: `/api/reels/${reel.id}` })).json().status;
    expect(status).toMatchObject({ voice: 'ok', timing: 'ok' });
  });
});

function multipart(filename: string, content: Buffer, contentType = 'audio/wav') {
  const boundary = '----reelmakertest';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('voice upload', () => {
  it('converts the upload to vo.wav, sets engine upload and drops windows', async () => {
    const reel = await reelWithScript();
    await writeFile(path.join(reelDir(reel.id), 'windows.json'), '[[0,1]]');
    const res = await app.inject({
      method: 'POST',
      url: `/api/reels/${reel.id}/voice/upload`,
      ...multipart('my voice.m4a', Buffer.from('fake m4a'), 'audio/mp4'),
    });
    expect(res.statusCode).toBe(200);
    const job = await finished(res.json().jobId);
    expect(job.status).toBe('done');

    const dir = reelDir(reel.id);
    expect(readFileSync(path.join(dir, 'vo.wav'), 'utf8')).toBe('RIFF-converted');
    expect(existsSync(path.join(dir, 'windows.json'))).toBe(false);
    expect(converted.at(-1)!.output).toBe(path.join(dir, 'vo.wav.tmp.wav'));
    expect(existsSync(converted.at(-1)!.input)).toBe(false); // upload temp file cleaned up
    const saved = await getReel(reel.id);
    expect(saved.voice.engine).toBe('upload');
    expect(saved.hashes.voice).toBe(spokenHash(saved));

    // timing over an uploaded file uses no line windows
    await finished((await post(`/api/reels/${reel.id}/timing`)).json().jobId);
    expect(calls.at(-1)!.args.windows).toBeNull();
  });

  it('rejects other file types', async () => {
    const reel = await reelWithScript();
    const res = await app.inject({
      method: 'POST',
      url: `/api/reels/${reel.id}/voice/upload`,
      ...multipart('notes.txt', Buffer.from('hi'), 'text/plain'),
    });
    expect(res.statusCode).toBe(400);
  });
});
