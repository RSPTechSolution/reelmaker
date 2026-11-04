import { mkdirSync } from 'node:fs';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { HttpError } from './errors.ts';
import { REELS_DIR } from './paths.ts';
import { getWorker } from './python.ts';
import { agentRoutes } from './routes/agent.ts';
import { audioLibraryRoutes } from './routes/audioLibrary.ts';
import type { SpawnFn } from './agent/run.ts';
import { audioRoutes, MAX_UPLOAD_BYTES, remotionFfmpegConvert, type AudioWorker, type ConvertAudio } from './routes/audio.ts';
import { jobRoutes } from './routes/jobs.ts';
import { reelRoutes } from './routes/reels.ts';
import { renderRoutes } from './routes/render.ts';
import { settingsRoutes } from './routes/settings.ts';

export const PORT = 4000;
const DEFAULT_HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
// Pages allowed to change data: the Vite dev server and the server itself.
const ALLOWED_ORIGINS = new Set(
  ['localhost', '127.0.0.1'].flatMap((h) => [`http://${h}:5173`, `http://${h}:${PORT}`]),
);
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Builds the Fastify app without listening (tests use app.inject).
 * `allowedHosts`, `worker` and `convertAudio` exist for tests; the real server uses
 * 127.0.0.1:4000 / localhost:4000, the shared Python worker and Remotion's ffmpeg.
 */
export function buildApp(
  opts: {
    logger?: boolean;
    allowedHosts?: string[];
    worker?: AudioWorker;
    convertAudio?: ConvertAudio;
    spawnClaude?: SpawnFn;
  } = {},
): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  mkdirSync(REELS_DIR, { recursive: true });
  const allowedHosts = new Set((opts.allowedHosts ?? DEFAULT_HOSTS).map((h) => h.toLowerCase()));

  // No auth on this local API, so: a Host check stops DNS rebinding, and an Origin check stops
  // other websites from changing data (Claude Code runs, file writes) via the owner's browser.
  app.addHook('onRequest', async (req, reply) => {
    const host = (req.headers.host ?? '').toLowerCase();
    if (!allowedHosts.has(host)) return reply.status(403).send({ error: `host ${host} not allowed` });
    const origin = req.headers.origin;
    if (origin !== undefined && UNSAFE_METHODS.has(req.method) && !ALLOWED_ORIGINS.has(origin)) {
      return reply.status(403).send({ error: `origin ${origin} not allowed` });
    }
  });

  app.setErrorHandler((err: FastifyError | HttpError | Error, req, reply) => {
    if (err.name === 'ZodError' && 'issues' in err) {
      return reply.status(400).send({ error: 'invalid data', issues: err.issues });
    }
    const status = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    return reply.status(status).send({ error: err.message });
  });

  // Generated media (wav, mp4, png). Range requests are supported, which audio seeking needs.
  app.register(fastifyStatic, { root: REELS_DIR, prefix: '/files/', decorateReply: false });
  app.register(fastifyMultipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  app.register(reelRoutes);
  // getWorker() is lazy: the Python process starts on the first voice/timing/sound job.
  const worker: AudioWorker = opts.worker ?? { call: (op, args, onProgress) => getWorker().call(op, args, onProgress) };
  app.register(audioRoutes({ worker, convertAudio: opts.convertAudio ?? remotionFfmpegConvert }));
  app.register(audioLibraryRoutes({ worker }));
  app.register(renderRoutes({ worker }));
  app.register(agentRoutes({ spawnFn: opts.spawnClaude }));
  app.register(settingsRoutes);
  app.register(jobRoutes);
  return app;
}
