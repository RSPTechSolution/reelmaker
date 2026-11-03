import { exampleReel } from './testing.ts';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spokenHash, type ReelProps } from '@reelmaker/shared';
import { buildApp } from './app.ts';
import { reelDir, REPO_ROOT } from './paths.ts';
import { buildProps, contactFrames, coverFrame, renderMp4, REEL_COMPOSITION_ID } from './render.ts';
import { saveReel } from './store.ts';

let n = 0;
async function reel(opts: { words?: boolean; timingHash?: 'ok' | 'stale' } = {}) {
  const r = { ...exampleReel(), id: `render-${++n}` };
  await mkdir(reelDir(r.id), { recursive: true });
  if (opts.timingHash) r.hashes = { timing: opts.timingHash === 'ok' ? spokenHash(r) : 'old' };
  await saveReel(r);
  if (opts.words) {
    const words = r.lines.flatMap((l) => l.caption.split(' ')).map((c, i) => ({
      i,
      caption: c,
      spoken: c,
      start: i * 0.4,
      end: i * 0.4 + 0.3,
      filled: false,
    }));
    await writeFile(path.join(reelDir(r.id), 'words.json'), JSON.stringify(words));
  }
  return r;
}

describe('contactFrames', () => {
  it('contactFrames returns 9 increasing frames within range', () => {
    const f = contactFrames(900);
    expect(f).toHaveLength(9);
    expect(f[0]).toBe(0);
    expect(f.at(-1)!).toBeLessThanOrEqual(889);
    expect(f.at(-1)!).toBeGreaterThan(850);
    for (let k = 1; k < f.length; k++) expect(f[k]).toBeGreaterThan(f[k - 1]);
  });

  it('works for short reels and other counts', () => {
    expect(contactFrames(90)).toHaveLength(9);
    expect(Math.max(...contactFrames(90))).toBeLessThanOrEqual(79);
    expect(contactFrames(300, 4)).toHaveLength(4);
  });
});

describe('buildProps', () => {
  it('buildProps fails clearly without words.json', async () => {
    const r = await reel();
    await expect(buildProps(r.id)).rejects.toThrow(/run Captions step first/);
  });

  it('collects reel, words, loudness, brand, mascot and audio URL', async () => {
    const r = await reel({ words: true });
    await writeFile(path.join(reelDir(r.id), 'loudness.json'), '[0, 0.5, 1]');
    await writeFile(path.join(reelDir(r.id), 'vo.wav'), 'RIFF');
    const props = await buildProps(r.id);
    expect(props.reel.id).toBe(r.id);
    expect(props.words).toHaveLength(40);
    expect(props.loudness).toEqual([0, 0.5, 1]);
    expect(props.brand.font).toBe('Baloo 2');
    expect(props.mascot.signature).toBe('antenna');
    expect(props.audioSrc).toBe(`http://127.0.0.1:4000/files/${r.id}/vo.wav`);
  });

  it('has no audio without vo.wav and no loudness without loudness.json', async () => {
    const r = await reel({ words: true });
    const props = await buildProps(r.id);
    expect(props.audioSrc).toBeNull();
    expect(props.loudness).toEqual([]);
  });
});

describe('coverFrame', () => {
  const words = [0, 1, 2, 3].map((i) => ({ i, caption: 'w', spoken: 'w', start: i, end: i + 0.5, filled: false }));
  it('uses reel.coverFrame when set', () => {
    expect(coverFrame({ ...exampleReel(), coverFrame: 42 }, words, 300)).toBe(42);
  });
  it('defaults to 10 frames after the first cue (by word order)', () => {
    const r = exampleReel();
    r.cues = [
      { id: 'b', atWord: 3, block: { type: 'title', text: 'b' } },
      { id: 'a', atWord: 2, block: { type: 'title', text: 'a' } },
    ];
    expect(coverFrame(r, words, 300)).toBe(70);
  });
  it('stays inside the video', () => {
    expect(coverFrame({ ...exampleReel(), coverFrame: 5000 }, words, 300)).toBe(299);
    expect(coverFrame({ ...exampleReel(), cues: [] }, words, 300)).toBe(0);
  });
});

it('REEL_COMPOSITION_ID matches the video package', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'packages', 'video', 'src', 'Reel.tsx'), 'utf8');
  expect(src).toContain(`export const REEL_COMPOSITION_ID = '${REEL_COMPOSITION_ID}';`);
});

describe('render routes', () => {
  const app = buildApp({ allowedHosts: ['localhost:80'] });
  beforeAll(() => app.ready());
  afterAll(() => app.close());

  it.each(['render', 'contact-sheet'])('%s refuses without captions (409)', async (route) => {
    const r = await reel();
    const res = await app.inject({ method: 'POST', url: `/api/reels/${r.id}/${route}`, payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/run Captions step first/);
  });

  it.each(['render', 'contact-sheet'])('%s refuses when captions are stale (409)', async (route) => {
    const r = await reel({ words: true, timingHash: 'stale' });
    const res = await app.inject({ method: 'POST', url: `/api/reels/${r.id}/${route}`, payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/stale/);
  });
});

// Real Chrome + ffmpeg render; ~1 min on the target i5. Run with SLOW=1.
describe.runIf(process.env.SLOW === '1')('slow: real render', () => {
  it('renders a 3-second demo mp4', { timeout: 600_000 }, async () => {
    const demo: ReelProps = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'packages', 'video', 'fixtures', 'demo-props.json'), 'utf8'),
    );
    const props: ReelProps = { ...demo, words: demo.words.slice(0, 1) }; // → 90 frames
    const out = path.join(await mkdtemp(path.join(os.tmpdir(), 'render test ')), 'demo.mp4');
    const progress: number[] = [];
    const frames = await renderMp4(props, out, (p) => progress.push(p));
    expect(frames).toBe(90);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(10 * 1024);
    expect(progress.at(-1)).toBe(1);
  });
});
