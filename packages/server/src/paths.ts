import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SafeId } from '@reelmaker/shared';
import { HttpError } from './errors.ts';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DATA_DIR = path.resolve(process.env.REEL_DATA_DIR ?? path.join(REPO_ROOT, 'data'));
export const REELS_DIR = path.join(DATA_DIR, 'reels');

/** Folder of one reel. Throws 400 for ids that are not SafeIds or that would leave REELS_DIR. */
export function reelDir(id: string): string {
  if (!SafeId.safeParse(id).success) throw new HttpError(400, `invalid reel id ${JSON.stringify(id)}`);
  const dir = path.resolve(REELS_DIR, id);
  if (path.dirname(dir) !== REELS_DIR) throw new HttpError(400, `invalid reel id ${JSON.stringify(id)}`);
  return dir;
}

export function reelFile(id: string): string {
  return path.join(reelDir(id), 'reel.json');
}
