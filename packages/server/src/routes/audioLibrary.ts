import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { AUDIO_ASSETS_VERSION, AudioFile, SFX_NAMES } from '@reelmaker/shared';
import { HttpError } from '../errors.ts';
import { DATA_DIR } from '../paths.ts';
import { writeJsonAtomic } from '../store.ts';
import type { AudioWorker } from './audio.ts';

export const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const MUSIC_DIR = path.join(AUDIO_DIR, 'music');
const LABELS_FILE = path.join(MUSIC_DIR, 'labels.json');
export const MAX_MUSIC_BYTES = 20 * 1024 * 1024;
const BUILTIN = ['lofi', 'upbeat', 'dramatic'] as const;

type Track = { file: string; label: string; kind: 'builtin' | 'upload' };

/** Sniff the audio type from its first bytes; the file name is not trusted. */
function audioType(buf: Buffer): 'mp3' | 'wav' | 'm4a' | null {
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (buf.length >= 3 && buf.toString('latin1', 0, 3) === 'ID3') return 'mp3';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3'; // MPEG frame sync
  if (buf.length >= 8 && buf.toString('latin1', 4, 8) === 'ftyp') return 'm4a';
  return null;
}

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return s || 'track';
}

async function readLabels(): Promise<Record<string, string>> {
  return existsSync(LABELS_FILE) ? JSON.parse(await readFile(LABELS_FILE, 'utf8')) : {};
}

let generating: Promise<void> | null = null;
let builtinLabels: Record<string, string> = { lofi: 'Lo-fi chill', upbeat: 'Upbeat pop', dramatic: 'Dramatic' };

/** Generate missing built-in sounds once (a few seconds of numpy). Renders call this too. */
export async function ensureBuiltinAudio(worker: AudioWorker): Promise<void> {
  const versionFile = path.join(AUDIO_DIR, 'version.txt');
  const outdated = !existsSync(versionFile) || (await readFile(versionFile, 'utf8')).trim() !== String(AUDIO_ASSETS_VERSION);
  const missing =
    outdated ||
    SFX_NAMES.some((s) => !existsSync(path.join(AUDIO_DIR, 'sfx', `${s}.wav`))) ||
    BUILTIN.some((m) => !existsSync(path.join(MUSIC_DIR, `builtin-${m}.wav`)));
  if (!missing) return;
  generating ??= worker
    .call<{ labels?: Record<string, string> }>('assets', { dir: AUDIO_DIR })
    .then((r) => {
      if (r?.labels) builtinLabels = r.labels;
    })
    .finally(() => (generating = null));
  await generating;
}

export function audioLibraryRoutes(deps: { worker: AudioWorker }) {
  const ensureBuiltins = () => ensureBuiltinAudio(deps.worker);
  return async (app: FastifyInstance) => {
    mkdirSync(MUSIC_DIR, { recursive: true });
    mkdirSync(path.join(AUDIO_DIR, 'sfx'), { recursive: true });
    app.register(fastifyStatic, { root: AUDIO_DIR, prefix: '/audio/', decorateReply: false });

    app.get('/api/audio', async () => {
      await ensureBuiltins();
      const labels = await readLabels();
      const uploads: Track[] = (await readdir(MUSIC_DIR))
        .filter((f) => f.startsWith('upload-') && AudioFile.safeParse(f).success)
        .sort()
        .map((file) => ({ file, label: labels[file] ?? file, kind: 'upload' }));
      const builtins: Track[] = BUILTIN.map((m) => ({ file: `builtin-${m}.wav`, label: builtinLabels[m], kind: 'builtin' }));
      return { sfx: [...SFX_NAMES], music: [...builtins, ...uploads] };
    });

    app.post('/api/audio/music', async (req) => {
      const part = await req.file({ limits: { fileSize: MAX_MUSIC_BYTES, files: 1 } });
      if (!part) throw new HttpError(400, 'no file uploaded');
      const buf = await part.toBuffer().catch(() => {
        throw new HttpError(413, 'track is larger than 20 MB');
      });
      const type = audioType(buf);
      if (!type) throw new HttpError(400, 'upload an MP3, WAV or M4A file');
      const label = path.parse(part.filename).name.slice(0, 80) || 'Track';
      const file = `upload-${slug(label)}-${randomBytes(4).toString('hex')}.${type}`;
      await writeFile(path.join(MUSIC_DIR, file), buf);
      await writeJsonAtomic(LABELS_FILE, { ...(await readLabels()), [file]: label });
      return { file, label, kind: 'upload' } satisfies Track;
    });

    app.delete<{ Params: { file: string } }>('/api/audio/music/:file', async (req) => {
      const { file } = req.params;
      if (!AudioFile.safeParse(file).success || !file.startsWith('upload-')) {
        throw new HttpError(400, 'only your uploaded tracks can be deleted');
      }
      await rm(path.join(MUSIC_DIR, file), { force: true });
      const labels = await readLabels();
      delete labels[file];
      await writeJsonAtomic(LABELS_FILE, labels);
      return { ok: true };
    });
  };
}
