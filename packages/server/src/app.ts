import { mkdirSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { HttpError } from './errors.ts';
import { REELS_DIR } from './paths.ts';
import { jobRoutes } from './routes/jobs.ts';
import { reelRoutes } from './routes/reels.ts';
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
 * `allowedHosts` exists for tests; the real server uses 127.0.0.1:4000 / localhost:4000.
 */
export function buildApp(opts: { logger?: boolean; allowedHosts?: string[] } = {}): FastifyInstance {
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
  app.register(reelRoutes);
  app.register(settingsRoutes);
  app.register(jobRoutes);
  return app;
}
