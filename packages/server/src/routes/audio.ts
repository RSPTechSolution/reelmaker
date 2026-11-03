import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { splitWords, spokenHash, type Reel } from '@reelmaker/shared';
import { HttpError } from '../errors.ts';
import { startJob } from '../jobs.ts';
import { reelDir } from '../paths.ts';
import { getReel, reelFiles, reelStatus, saveReel } from '../store.ts';

/** What the routes need from the Python bridge (PyWorker satisfies it; tests pass a fake). */
export type AudioWorker = {
  call<T>(op: string, args: object, onProgress?: (p: number, msg: string) => void): Promise<T>;
};
export type ConvertAudio = (input: string, output: string) => Promise<void>;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_TYPES = new Set(['.wav', '.mp3', '.m4a']);

type TtsResult = { windows: [number, number][]; duration: number };
type TimingReport = { matched: number; filled: number; filledRanges: [number, number, number, number][] };
type IdParams = { Params: { id: string } };

const VoiceBody = z.object({ only: z.array(z.string()).min(1).optional() });

/** 24 kHz mono WAV via the ffmpeg bundled with Remotion (`remotion ffmpeg`), run through node. */
export const remotionFfmpegConvert: ConvertAudio = (input, output) => {
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
  const args = [cli, 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-ar', '24000', '-ac', '1', output];
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 && existsSync(output)
        ? resolve()
        : reject(new Error(`could not convert the recording (ffmpeg exit ${code}): ${stderr.trim().slice(-800)}`)),
    );
  });
};

function scriptWords(reel: Reel) {
  const words: { i: number; caption: string; spoken: string; line: number }[] = [];
  reel.lines.forEach((line, li) => {
    const caption = splitWords(line.caption);
    const spoken = splitWords(line.spoken);
    caption.forEach((c, k) => words.push({ i: words.length, caption: c, spoken: spoken[k], line: li }));
  });
  return words;
}

/** Re-read the reel (it may have been edited while the job ran) and apply `change`. */
async function updateReel(id: string, change: (reel: Reel) => void): Promise<Reel> {
  const reel = structuredClone(await getReel(id));
  change(reel);
  return saveReel(reel);
}

export function audioRoutes(deps: { worker: AudioWorker; convertAudio: ConvertAudio }) {
  return async (app: FastifyInstance) => {
    app.post<IdParams>('/api/reels/:id/voice', async (req) => {
      const reel = await getReel(req.params.id);
      const { only } = VoiceBody.parse(req.body ?? {});
      if (reel.lines.length === 0) throw new HttpError(409, 'script has no lines yet');
      const ids = new Set(reel.lines.map((l) => l.id));
      for (const id of only ?? []) if (!ids.has(id)) throw new HttpError(400, `unknown line id ${id}`);

      const voiced: Reel = { ...reel, voice: { ...reel.voice, engine: 'kokoro' } };
      const voicedHash = spokenHash(voiced); // of the text actually sent, not of later edits
      const dir = reelDir(reel.id);
      const job = startJob('voice', reel.id, async (ctx) => {
        const result = await deps.worker.call<TtsResult>(
          'tts',
          {
            lines: voiced.lines.map((l) => ({ id: l.id, spoken: l.spoken })),
            voice: voiced.voice.voiceId,
            speed: voiced.voice.speed,
            dir,
            ...(only ? { only } : {}),
          },
          (p, msg) => ctx.progress(p, msg),
        );
        await writeFile(path.join(dir, 'windows.json'), JSON.stringify(result.windows));
        await updateReel(reel.id, (r) => {
          r.voice.engine = 'kokoro';
          r.hashes.voice = voicedHash;
          delete r.hashes.timing; // new audio: captions must be re-synced
        });
        return result;
      });
      return { jobId: job.id };
    });

    app.post<IdParams>('/api/reels/:id/voice/upload', async (req) => {
      const reel = await getReel(req.params.id);
      const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
      if (!file) throw new HttpError(400, 'no file uploaded');
      const ext = path.extname(file.filename).toLowerCase();
      if (!UPLOAD_TYPES.has(ext)) {
        file.file.resume();
        throw new HttpError(400, 'upload a .wav, .mp3 or .m4a file');
      }
      const dir = reelDir(reel.id);
      const input = path.join(dir, `upload-${randomBytes(4).toString('hex')}${ext}`);
      await pipeline(file.file, createWriteStream(input));
      if (file.file.truncated) {
        await rm(input, { force: true });
        throw new HttpError(413, 'recording is larger than 50 MB');
      }

      let job;
      try {
        job = startJob('voice-upload', reel.id, async (ctx) => {
          try {
            ctx.progress(0.1, 'converting recording');
            const tmp = path.join(dir, 'vo.wav.tmp.wav');
            await deps.convertAudio(input, tmp);
            await rename(tmp, path.join(dir, 'vo.wav'));
            await rm(path.join(dir, 'windows.json'), { force: true }); // line windows unknown now
            await updateReel(reel.id, (r) => {
              r.voice.engine = 'upload';
              r.hashes.voice = spokenHash(r);
              delete r.hashes.timing;
            });
            return { ok: true };
          } finally {
            await rm(input, { force: true });
          }
        });
      } catch (err) {
        await rm(input, { force: true });
        throw err;
      }
      return { jobId: job.id };
    });

    app.post<IdParams>('/api/reels/:id/timing', async (req) => {
      const reel = await getReel(req.params.id);
      const files = await reelFiles(reel.id);
      if (!files.vo) throw new HttpError(409, 'no voice yet — run the Voice step first');
      if (reelStatus(reel, files).voice === 'stale') throw new HttpError(409, 'voice is stale');

      const dir = reelDir(reel.id);
      const windowsFile = path.join(dir, 'windows.json');
      const windows =
        reel.voice.engine === 'kokoro' && existsSync(windowsFile)
          ? (JSON.parse(await readFile(windowsFile, 'utf8')) as [number, number][])
          : null;
      const timedHash = spokenHash(reel);
      const job = startJob('timing', reel.id, async (ctx) => {
        const report = await deps.worker.call<TimingReport>(
          'timing',
          { dir, words: scriptWords(reel), windows, prompt: reel.lines.map((l) => l.spoken).join(' ') },
          (p, msg) => ctx.progress(p, msg),
        );
        await writeFile(path.join(dir, 'report.json'), JSON.stringify(report));
        await updateReel(reel.id, (r) => {
          r.hashes.timing = timedHash;
        });
        return report;
      });
      return { jobId: job.id };
    });
  };
}
