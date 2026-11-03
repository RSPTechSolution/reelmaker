// Test helpers. Import this BEFORE any server module: it points REEL_DATA_DIR at a fresh
// temp folder, and paths.ts reads that env var once at import time.
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Reel } from '@reelmaker/shared';

process.env.REEL_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'reelmaker test '));

const here = path.dirname(fileURLToPath(import.meta.url));

export function exampleReel(): Reel {
  const file = path.join(here, '..', '..', 'shared', 'fixtures', 'example-reel.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}
