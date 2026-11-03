import { describe, expect, it } from 'vitest';
import { checkTools, type RunFn } from './doctor.ts';

type Reply = { code: number; stdout: string };

// Builds a fake `run` from a map of "cmd arg1 arg2" -> reply. Unknown commands fail.
function fakeRun(replies: Record<string, Reply>): RunFn & { calls: string[] } {
  const calls: string[] = [];
  const run = async (cmd: string, args: string[]) => {
    const key = [cmd, ...args].join(' ');
    calls.push(key);
    return replies[key] ?? { code: 1, stdout: '' };
  };
  return Object.assign(run, { calls });
}

const allGood: Record<string, Reply> = {
  'node --version': { code: 0, stdout: 'v22.18.0\n' },
  'py -3.12 --version': { code: 0, stdout: 'Python 3.12.4\n' },
  'python --version': { code: 0, stdout: 'Python 3.12.4\n' },
  'espeak-ng --version': { code: 0, stdout: 'eSpeak NG text-to-speech: 1.52.0\n' },
  'claude --version': { code: 0, stdout: '2.1.0 (Claude Code)\n' },
};

const byName = async (replies: Record<string, Reply>) => {
  const checks = await checkTools(fakeRun(replies));
  return Object.fromEntries(checks.map((c) => [c.name, c]));
};

describe('checkTools', () => {
  it('doctor reports missing tool', async () => {
    const replies = { ...allGood, 'espeak-ng --version': { code: 1, stdout: '' } };
    const checks = await byName(replies);
    expect(checks['espeak-ng'].ok).toBe(false);
    expect(checks['espeak-ng'].fix).toContain('espeak-ng');
    expect(checks['node'].ok).toBe(true);
    expect(checks['claude'].ok).toBe(true);
  });

  it('doctor accepts python 3.12', async () => {
    const checks = await byName(allGood);
    expect(checks['python'].ok).toBe(true);
    expect(checks['python'].version).toBe('3.12.4');
  });

  it('doctor rejects python 3.13', async () => {
    const replies = {
      ...allGood,
      'py -3.12 --version': { code: 1, stdout: '' },
      'python --version': { code: 0, stdout: 'Python 3.13.1\n' },
    };
    const checks = await byName(replies);
    expect(checks['python'].ok).toBe(false);
    expect(checks['python'].fix).toContain('3.12');
  });

  it('tries py -3.12 before python on Windows', async () => {
    const run = fakeRun(allGood);
    await checkTools(run);
    const pyIdx = run.calls.indexOf('py -3.12 --version');
    const pythonIdx = run.calls.indexOf('python --version');
    if (process.platform === 'win32') {
      expect(pyIdx).toBeGreaterThanOrEqual(0);
      expect(pythonIdx === -1 || pyIdx < pythonIdx).toBe(true);
    } else {
      expect(pythonIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it('rejects node older than 22.18', async () => {
    const checks = await byName({ ...allGood, 'node --version': { code: 0, stdout: 'v20.11.0\n' } });
    expect(checks['node'].ok).toBe(false);
    expect(checks['node'].fix).toContain('22');
  });

  it('treats a run that throws as missing', async () => {
    const run: RunFn = async (cmd, args) => {
      if (cmd === 'claude') throw new Error('spawn claude ENOENT');
      return allGood[[cmd, ...args].join(' ')] ?? { code: 1, stdout: '' };
    };
    const checks = Object.fromEntries((await checkTools(run)).map((c) => [c.name, c]));
    expect(checks['claude'].ok).toBe(false);
    expect(checks['claude'].fix).toContain('Claude Code');
  });
});
