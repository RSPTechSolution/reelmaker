import { exampleReel } from './testing.ts';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { spokenHash } from '@reelmaker/shared';
import { DATA_DIR, reelDir, reelFile } from './paths.ts';
import {
  backupReel,
  createReel,
  getBrand,
  getReel,
  listReels,
  reelFiles,
  reelStatus,
  restoreReel,
  saveBrand,
  saveReel,
} from './store.ts';

async function savedExample(id: string) {
  const reel = { ...exampleReel(), id };
  await mkdir(reelDir(id), { recursive: true });
  return saveReel(reel);
}

describe('paths', () => {
  it('uses REEL_DATA_DIR (a folder with spaces in its name)', () => {
    expect(DATA_DIR).toBe(process.env.REEL_DATA_DIR);
    expect(DATA_DIR).toContain(' ');
    expect(reelFile('abc')).toBe(path.join(DATA_DIR, 'reels', 'abc', 'reel.json'));
  });

  it.each(['..', '../x', 'a/b', 'a\\b', 'CON', ''])('reelDir rejects unsafe id %j', (id) => {
    expect(() => reelDir(id)).toThrow();
  });
});

describe('store', () => {
  it('createReel makes a dated slug id and a valid empty reel', async () => {
    const reel = await createReel({ topic: 'AI se Video kaise banaye?!', hook: 'Easy hai' });
    expect(reel.id).toMatch(/^\d{8}-\d{4}-ai-se-video-kaise-banaye$/);
    expect(reel.targetSeconds).toBe(30);
    expect(reel.lines).toEqual([]);
    expect(reel.voice).toEqual({ engine: 'kokoro', voiceId: 'hf_alpha', speed: 1 });
    expect(await getReel(reel.id)).toEqual(reel);
  });

  it('createReel never reuses an id', async () => {
    const a = await createReel({ topic: 'same topic' });
    const b = await createReel({ topic: 'same topic' });
    expect(b.id).not.toBe(a.id);
  });

  it('createReel handles a topic with no latin letters', async () => {
    const reel = await createReel({ topic: 'नमस्ते' });
    expect(reel.id).toMatch(/^\d{8}-\d{4}-reel(-\d+)?$/);
  });

  it('saveReel is atomic', async () => {
    const reel = await savedExample('atomic-1');
    await saveReel({ ...reel, title: 'changed' });
    expect((await getReel('atomic-1')).title).toBe('changed');
    const leftovers = readdirSync(reelDir('atomic-1')).filter((f) => f.includes('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('saveReel rejects an invalid reel and keeps the old file', async () => {
    const reel = await savedExample('invalid-1');
    const bad = { ...reel, lines: [{ id: 'l1', caption: 'a b', spoken: 'अ' }] };
    await expect(saveReel(bad)).rejects.toThrow(/caption has 2 words, spoken has 1/);
    expect((await getReel('invalid-1')).lines).toEqual(reel.lines);
  });

  it('getReel of a missing reel is a 404', async () => {
    await expect(getReel('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('backupReel and restoreReel round-trip', async () => {
    const reel = await savedExample('backup-1');
    await backupReel('backup-1');
    await saveReel({ ...reel, title: 'agent edit' });
    await restoreReel('backup-1');
    expect((await getReel('backup-1')).title).toBe(reel.title);
  });

  it('listReels returns summaries newest first', async () => {
    const list = await listReels();
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) expect(Object.keys(s).sort()).toEqual(['id', 'status', 'title', 'updatedAt']);
    const times = list.map((s) => s.updatedAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('brand falls back to defaults and saves', async () => {
    const brand = await getBrand();
    expect(brand.font).toBe('Baloo 2');
    await saveBrand({ ...brand, accent: '#FF0000' });
    expect((await getBrand()).accent).toBe('#FF0000');
    expect(existsSync(path.join(DATA_DIR, 'brand.json'))).toBe(true);
  });
});

describe('reelStatus', () => {
  it('marks voice stale when spoken text changes', async () => {
    const reel = await savedExample('stale-1');
    await writeFile(path.join(reelDir('stale-1'), 'vo.wav'), 'x');
    reel.hashes.voice = spokenHash(reel);
    const files = await reelFiles('stale-1');
    expect(reelStatus(reel, files).voice).toBe('ok');

    const captionOnly = structuredClone(reel);
    captionOnly.lines[0].caption = captionOnly.lines[0].caption.toUpperCase();
    expect(reelStatus(captionOnly, files).voice).toBe('ok');

    const spokenEdit = structuredClone(reel);
    spokenEdit.lines[0].spoken = spokenEdit.lines[0].spoken.replace('एआई', 'आई');
    expect(reelStatus(spokenEdit, files).voice).toBe('stale');
  });

  it('reports none without files and script false without lines', async () => {
    const reel = exampleReel();
    const none = { vo: false, words: false, mp4: false };
    expect(reelStatus(reel, none)).toEqual({ script: true, voice: 'none', timing: 'none', rendered: false });
    expect(reelStatus({ ...reel, lines: [], cues: [] }, none).script).toBe(false);
  });

  it('timing goes stale with the voice', async () => {
    const reel = exampleReel();
    reel.hashes = { voice: spokenHash(reel), timing: spokenHash(reel) };
    const all = { vo: true, words: true, mp4: true };
    expect(reelStatus(reel, all)).toEqual({ script: true, voice: 'ok', timing: 'ok', rendered: true });
    reel.voice.speed = 1.2;
    expect(reelStatus(reel, all)).toMatchObject({ voice: 'stale', timing: 'stale' });
  });
});
