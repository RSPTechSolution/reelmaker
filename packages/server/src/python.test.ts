import './testing.ts';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.ts';
import { PyWorker, venvPython } from './python.ts';

const FAKE = path.join(REPO_ROOT, 'packages', 'server', 'test', 'fake-worker.py');
const PYTHON = venvPython();

const workers: PyWorker[] = [];
function fake(env: Record<string, string> = {}) {
  const w = new PyWorker({ script: FAKE, env });
  workers.push(w);
  return w;
}
afterEach(() => {
  for (const w of workers.splice(0)) w.stop();
});

describe.runIf(existsSync(PYTHON))('PyWorker', () => {
  it('call resolves by id with progress', async () => {
    const w = fake();
    const progress: [number, string][] = [];
    const [a, b] = await Promise.all([
      w.call<{ echo: unknown }>('echo', { text: 'नमस्ते' }, (p, m) => progress.push([p, m])),
      w.call<{ echo: unknown }>('echo', { n: 2 }),
    ]);
    expect(a).toEqual({ echo: { text: 'नमस्ते' } });
    expect(b).toEqual({ echo: { n: 2 } });
    expect(progress).toEqual([[0.5, 'half way']]);
  });

  it('an ok:false result rejects with the worker error', async () => {
    await expect(fake().call('fail', {})).rejects.toThrow('fake failure');
  });

  it('worker crash rejects in-flight call with stderr tail', async () => {
    const w = fake();
    const err = await w.call('crash', {}).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/audio worker stopped \(exit code 3\)/);
    expect(msg).toContain('stderr line 29');
    expect(msg).toContain('stderr line 10');
    expect(msg).not.toContain('stderr line 9\n'); // only the last 20 lines
  });

  it('restarts once after a crash and keeps serving', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pyw '));
    const marker = path.join(dir, 'starts.txt');
    const w = fake({ FAKE_WORKER_STARTS: marker });
    await w.call('echo', {});
    await w.call('crash', {}).catch(() => {});
    expect(await w.call('echo', { again: true })).toEqual({ echo: { again: true } });
    expect(readFileSync(marker, 'utf8').trim().split('\n')).toHaveLength(2);
  });

  it('starts lazily and only once for concurrent calls', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pyw '));
    const marker = path.join(dir, 'starts.txt');
    const w = fake({ FAKE_WORKER_STARTS: marker });
    expect(existsSync(marker)).toBe(false);
    await Promise.all([w.call('echo', {}), w.call('echo', {}), w.call('slow', { seconds: 0.05 })]);
    expect(readFileSync(marker, 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

describe('PyWorker without Python', () => {
  it('reports a missing venv clearly', async () => {
    const w = new PyWorker({ python: path.join(os.tmpdir(), 'no such dir', 'python.exe'), script: FAKE });
    await expect(w.call('echo', {})).rejects.toThrow(/npm run setup/);
    w.stop();
  });
});
