import type { FastifyInstance } from 'fastify';
import { HttpError } from '../errors.ts';
import { getJob, subscribe, type JobEvent } from '../jobs.ts';

type IdParams = { Params: { id: string } };

function sseChunk(e: JobEvent): string {
  const { type, ...data } = e;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function jobRoutes(app: FastifyInstance) {
  app.get<IdParams>('/api/jobs/:id', async (req) => {
    const job = getJob(req.params.id);
    if (!job) throw new HttpError(404, 'job not found');
    const { events, ...snapshot } = job;
    return snapshot;
  });

  // Server-sent events: replays past events, then streams live ones; ends after done/error.
  app.get<IdParams>('/api/jobs/:id/events', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) throw new HttpError(404, 'job not found');

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    for (const e of job.events) res.write(sseChunk(e));
    if (job.status !== 'running') {
      res.end();
      return;
    }
    const off = subscribe(job.id, (e) => {
      res.write(sseChunk(e));
      if (e.type === 'done' || e.type === 'error') {
        off();
        res.end();
      }
    });
    req.raw.on('close', off);
  });
}
