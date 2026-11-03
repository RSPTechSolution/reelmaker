import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  Brand,
  defaultBrand,
  defaultMascot,
  MascotConfig,
  Reel,
  spokenHash,
} from '@reelmaker/shared';
import { HttpError } from './errors.ts';
import { DATA_DIR, reelDir, reelFile, REELS_DIR } from './paths.ts';

export type ReelStatus = {
  script: boolean;
  voice: 'none' | 'ok' | 'stale';
  timing: 'none' | 'ok' | 'stale';
  rendered: boolean;
};
export type ReelSummary = { id: string; title: string; updatedAt: string; status: ReelStatus };
/** Which generated files exist for a reel. */
export type ReelFiles = { vo: boolean; words: boolean; mp4: boolean };

const BACKUP = 'reel.backup.json';

/** Write via a temp file in the same folder + rename, so readers never see a half-written file. */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  try {
    // Windows: rename can briefly fail with EPERM/EBUSY while antivirus or an indexer holds the target.
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, file);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (attempt >= 4 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw err;
        await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
      }
    }
  } finally {
    await rm(tmp, { force: true });
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

function slugify(topic: string): string {
  const slug = topic
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'reel';
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function createReel(input: { topic: string; hook?: string; targetSeconds?: number }): Promise<Reel> {
  const now = new Date();
  const base = `${stamp(now)}-${slugify(input.topic)}`;
  await mkdir(REELS_DIR, { recursive: true });
  let id = base;
  for (let n = 2; ; n++) {
    try {
      await mkdir(reelDir(id)); // fails if it exists, so two creates never share a folder
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      id = `${base}-${n}`;
    }
  }
  const iso = now.toISOString();
  const reel: Reel = {
    id,
    title: input.topic,
    topic: input.topic,
    ...(input.hook ? { hook: input.hook } : {}),
    targetSeconds: input.targetSeconds ?? 30,
    lines: [],
    voice: { engine: 'kokoro', voiceId: 'hf_alpha', speed: 1 },
    cues: [],
    keywords: [],
    hashes: {},
    createdAt: iso,
    updatedAt: iso,
  };
  await writeJsonAtomic(reelFile(id), Reel.parse(reel));
  return reel;
}

export async function getReel(id: string): Promise<Reel> {
  const file = reelFile(id);
  if (!existsSync(file)) throw new HttpError(404, `reel ${id} not found`);
  return Reel.parse(await readJson(file));
}

/** Validates (throws ZodError), stamps updatedAt and writes atomically. Returns the saved reel. */
export async function saveReel(reel: Reel): Promise<Reel> {
  const parsed = Reel.parse({ ...reel, updatedAt: new Date().toISOString() });
  await mkdir(reelDir(parsed.id), { recursive: true });
  await writeJsonAtomic(reelFile(parsed.id), parsed);
  return parsed;
}

export async function backupReel(id: string): Promise<void> {
  await copyFile(reelFile(id), path.join(reelDir(id), BACKUP));
}

export async function restoreReel(id: string): Promise<void> {
  const backup = await readJson(path.join(reelDir(id), BACKUP));
  await writeJsonAtomic(reelFile(id), backup);
}

export async function reelFiles(id: string): Promise<ReelFiles> {
  const dir = reelDir(id);
  return {
    vo: existsSync(path.join(dir, 'vo.wav')),
    words: existsSync(path.join(dir, 'words.json')),
    mp4: existsSync(path.join(dir, 'out', 'reel.mp4')),
  };
}

export function reelStatus(reel: Reel, files: ReelFiles): ReelStatus {
  const current = spokenHash(reel);
  const state = (exists: boolean, hash?: string) => (!exists || !hash ? 'none' : hash === current ? 'ok' : 'stale');
  return {
    script: reel.lines.length > 0,
    voice: state(files.vo, reel.hashes.voice),
    timing: state(files.words, reel.hashes.timing),
    rendered: files.mp4,
  };
}

export async function listReels(): Promise<ReelSummary[]> {
  if (!existsSync(REELS_DIR)) return [];
  const out: ReelSummary[] = [];
  for (const entry of await readdir(REELS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const reel = await getReel(entry.name);
      out.push({ id: reel.id, title: reel.title, updatedAt: reel.updatedAt, status: reelStatus(reel, await reelFiles(reel.id)) });
    } catch {
      // unreadable or invalid reel folder: leave it out of the library
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getSetting<T>(name: string, schema: { parse(v: unknown): T }, fallback: T): Promise<T> {
  const file = path.join(DATA_DIR, name);
  if (!existsSync(file)) return fallback;
  return schema.parse(await readJson(file));
}

async function saveSetting<T>(name: string, schema: { parse(v: unknown): T }, value: unknown): Promise<T> {
  const parsed = schema.parse(value);
  await mkdir(DATA_DIR, { recursive: true });
  await writeJsonAtomic(path.join(DATA_DIR, name), parsed);
  return parsed;
}

export const getBrand = () => getSetting('brand.json', Brand, defaultBrand);
export const saveBrand = (brand: unknown) => saveSetting('brand.json', Brand, brand);
export const getMascot = () => getSetting('mascot.json', MascotConfig, defaultMascot);
export const saveMascot = (mascot: unknown) => saveSetting('mascot.json', MascotConfig, mascot);
