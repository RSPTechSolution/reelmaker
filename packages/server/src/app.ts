import { mkdirSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { HttpError } from './errors.ts';
import { REELS_DIR } from './paths.ts';
import { jobRoutes } from './routes/jobs.ts';
import { reelRoutes } from './routes/reels.ts';
import { settingsRoutes } from './routes/settings.ts';

/** Builds the Fastify app without listening (tests use app.inject). */
export function buildApp(opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  mkdirSync(REELS_DIR, { recursive: true });

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
