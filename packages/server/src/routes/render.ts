import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.ts';
import { startJob } from '../jobs.ts';
import { getServeUrl, renderContactSheet, renderCover, renderReel } from '../render.ts';
import { getReel, reelFiles, reelStatus } from '../store.ts';
import type { AudioWorker } from './audio.ts';
import { ensureBuiltinAudio } from './audioLibrary.ts';

type IdParams = { Params: { id: string }; Querystring: { rebundle?: string } };
const ContactBody = z.object({ debugSafeZones: z.boolean().optional() });

/** 409 unless captions exist and match the current script. */
async function requireFreshTiming(id: string) {
  const reel = await getReel(id);
  const status = reelStatus(reel, await reelFiles(id));
  if (status.timing === 'none') throw new HttpError(409, 'no captions yet — run Captions step first');
  if (status.timing === 'stale') throw new HttpError(409, 'captions are stale — run Captions step again');
  return reel;
}

export function renderRoutes(deps: { worker: AudioWorker }) {
  return async (app: FastifyInstance) => {
    app.post<IdParams>('/api/reels/:id/contact-sheet', async (req) => {
      const reel = await requireFreshTiming(req.params.id);
      const { debugSafeZones } = ContactBody.parse(req.body ?? {});
      const rebundle = req.query.rebundle === '1';
      const job = startJob('contact-sheet', reel.id, async (ctx) => {
        ctx.progress(0, 'bundling');
        await ensureBuiltinAudio(deps.worker);
        await getServeUrl({ rebundle });
        await renderContactSheet(reel.id, debugSafeZones ?? false, (p, m) => ctx.progress(0.05 + p * 0.95, m));
        return { file: `/files/${reel.id}/out/contact.png` };
      });
      return { jobId: job.id };
    });

    app.post<IdParams>('/api/reels/:id/render', async (req) => {
      const reel = await requireFreshTiming(req.params.id);
      const rebundle = req.query.rebundle === '1';
      const job = startJob('render', reel.id, async (ctx) => {
        ctx.progress(0, 'bundling');
        await ensureBuiltinAudio(deps.worker); // sound effects and beats must exist before Chrome fetches them
        await getServeUrl({ rebundle });
        await renderReel(reel.id, (p, m) => ctx.progress(0.05 + p * 0.9, m));
        ctx.progress(0.96, 'cover');
        await renderCover(reel.id);
        return { mp4: `/files/${reel.id}/out/reel.mp4`, cover: `/files/${reel.id}/out/cover.png` };
      });
      return { jobId: job.id };
    });
  };
}
