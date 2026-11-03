import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Reel } from '@reelmaker/shared';
import { HttpError } from '../errors.ts';
import { reelDir } from '../paths.ts';
import { createReel, getReel, listReels, reelFiles, reelStatus, saveReel } from '../store.ts';

const CreateBody = z.object({
  topic: z.string().trim().min(1).max(200),
  hook: z.string().trim().max(300).optional(),
  targetSeconds: z.number().int().min(20).max(60).optional(),
});

type IdParams = { Params: { id: string } };

async function readOptionalJson(file: string): Promise<unknown> {
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : undefined;
}

export async function reelRoutes(app: FastifyInstance) {
  app.post('/api/reels', async (req) => createReel(CreateBody.parse(req.body ?? {})));

  app.get('/api/reels', async () => listReels());

  app.get<IdParams>('/api/reels/:id', async (req) => {
    const reel = await getReel(req.params.id);
    const dir = reelDir(reel.id);
    return {
      reel,
      status: reelStatus(reel, await reelFiles(reel.id)),
      words: await readOptionalJson(path.join(dir, 'words.json')),
      report: await readOptionalJson(path.join(dir, 'report.json')),
    };
  });

  app.put<IdParams>('/api/reels/:id', async (req) => {
    const existing = await getReel(req.params.id);
    const body = req.body as Partial<Reel> | null;
    if (!body || typeof body !== 'object') throw new HttpError(400, 'body must be a reel object');
    if (body.id !== existing.id) throw new HttpError(400, `reel id ${JSON.stringify(body.id)} does not match URL`);
    // hashes and createdAt belong to the server: a client cannot mark stale audio as fresh.
    return saveReel({ ...(body as Reel), hashes: existing.hashes, createdAt: existing.createdAt });
  });
}
