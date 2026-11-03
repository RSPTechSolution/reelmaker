import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { Expression, type MascotConfig } from '@reelmaker/shared';
import { HttpError } from '../errors.ts';
import { DATA_DIR } from '../paths.ts';
import { getBrand, getMascot, saveBrand, saveMascot } from '../store.ts';

export const CHARACTER_DIR = path.join(DATA_DIR, 'mascot');
export const MAX_CHARACTER_BYTES = 5 * 1024 * 1024;

/** Sniff the file type from its first bytes; the name and Content-Type are not trusted. */
function imageType(buf: Buffer): 'png' | 'webp' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function parseExpression(raw: string) {
  const parsed = Expression.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, `unknown expression ${JSON.stringify(raw)}`);
  return parsed.data;
}

/** Delete every stored file for one expression (names are `<expression>-<hex>.<ext>`). */
async function removeImages(expression: string) {
  for (const f of await readdir(CHARACTER_DIR)) {
    if (f.startsWith(`${expression}-`)) await rm(path.join(CHARACTER_DIR, f), { force: true });
  }
}

export async function settingsRoutes(app: FastifyInstance) {
  mkdirSync(CHARACTER_DIR, { recursive: true });
  // Uploaded character images (the owner's own character / face), one per expression.
  app.register(fastifyStatic, { root: CHARACTER_DIR, prefix: '/character/', decorateReply: false });

  app.get('/api/brand', async () => getBrand());
  app.put('/api/brand', async (req) => saveBrand(req.body));
  app.get('/api/mascot', async () => getMascot());
  app.put('/api/mascot', async (req) => saveMascot(req.body));

  app.post<{ Params: { expression: string } }>('/api/mascot/image/:expression', async (req) => {
    const expression = parseExpression(req.params.expression);
    const file = await req.file({ limits: { fileSize: MAX_CHARACTER_BYTES, files: 1 } });
    if (!file) throw new HttpError(400, 'no image uploaded');
    const buf = await file.toBuffer().catch(() => {
      throw new HttpError(413, 'image is larger than 5 MB');
    });
    const type = imageType(buf);
    if (!type) throw new HttpError(400, 'upload a PNG or WebP image (a transparent background looks best)');

    const name = `${expression}-${randomBytes(4).toString('hex')}.${type}`;
    await removeImages(expression);
    await writeFile(path.join(CHARACTER_DIR, name), buf);
    const mascot = await getMascot();
    const next: MascotConfig = { ...mascot, images: { ...mascot.images, [expression]: `/character/${name}` } };
    return saveMascot(next);
  });

  app.delete<{ Params: { expression: string } }>('/api/mascot/image/:expression', async (req) => {
    const expression = parseExpression(req.params.expression);
    await removeImages(expression);
    const mascot = await getMascot();
    const images = { ...mascot.images };
    delete images[expression];
    return saveMascot({ ...mascot, images });
  });
}
