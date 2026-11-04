import { exampleReel } from '../testing.ts';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { Reel } from '@reelmaker/shared';
import { reelDir, reelFile, REPO_ROOT } from '../paths.ts';
import { getReel, saveReel } from '../store.ts';
import { buildClaudeArgs, permissionPath, runAgent, type SpawnFn } from './run.ts';
import { reviewPrompt, scenesPrompt, scriptPrompt } from './prompts.ts';

type FakeRun = { lines?: object[]; write?: (file: string) => Promise<void>; code?: number; error?: NodeJS.ErrnoException };

/** Fake `claude`: optionally edits reel.json, prints stream-json lines, exits. Records prompts (stdin). */
function fakeClaude(runs: FakeRun[]) {
  const calls: { cmd: string; args: string[]; cwd?: string; prompt: string }[] = [];
  const spawnFn: SpawnFn = (cmd, args, opts) => {
    const run = runs[Math.min(calls.length, runs.length - 1)];
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const child = Object.assign(new EventEmitter(), { stdin, stdout, stderr, kill: () => true });
    const call = { cmd, args, cwd: opts.cwd, prompt: '' };
    calls.push(call);
    stdin.on('data', (d) => (call.prompt += d));
    setImmediate(async () => {
      if (run.error) {
        child.emit('error', run.error);
        return;
      }
      const file = reelFile(args.find((a) => a.startsWith('Write('))!.match(/reels[\\/]([^\\/]+)[\\/]reel\.json/)![1]);
      if (run.write) await run.write(file);
      for (const l of run.lines ?? []) stdout.write(JSON.stringify(l) + '\n');
      stdout.write('not json — e.g. a hook printing to stdout\n');
      stdout.end();
      stderr.end();
      child.emit('close', run.code ?? 0);
    });
    return child as unknown as ReturnType<SpawnFn>;
  };
  return { spawnFn, calls };
}

const say = (text: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const toolUse = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: {} }] } };
const done = { type: 'result', subtype: 'success', is_error: false, result: 'done' };

/** A valid agent edit: changes the title. */
const retitle = (title: string) => async (file: string) => {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  r.title = title;
  await writeFile(file, JSON.stringify(r));
};

let n = 0;
async function savedReel(): Promise<Reel> {
  const r = { ...exampleReel(), id: `agent-${++n}` };
  await mkdir(reelDir(r.id), { recursive: true });
  return saveReel(r);
}

describe('buildClaudeArgs', () => {
  it('buildClaudeArgs restricts edits to the reel file', () => {
    const args = buildClaudeArgs('abc', 'ignored: prompt goes on stdin');
    const reelPath = permissionPath(reelFile('abc'));
    expect(args.slice(0, 4)).toEqual(['-p', '--output-format', 'stream-json', '--verbose']);
    const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'));
    expect(allowed).toEqual(['Read', `Edit(${reelPath})`, `Write(${reelPath})`, 'Edit(.claude/skills/reels/SKILL.md)']);
    expect(args.slice(args.indexOf('--disallowedTools') + 1)).toEqual(['Bash', 'PowerShell', 'WebFetch', 'WebSearch']);
    expect(args.join(' ')).not.toContain('ignored'); // never on the command line
  });

  it('uses data/reels/<id>/reel.json for the default data folder', () => {
    expect(permissionPath(path.join(REPO_ROOT, 'data', 'reels', 'abc', 'reel.json'))).toBe('data/reels/abc/reel.json');
  });

  it('uses the //absolute form for a data folder outside the repo', () => {
    const outside = path.resolve(REPO_ROOT, '..', 'elsewhere', 'reels', 'abc', 'reel.json');
    const fwd = outside.split(path.sep).join('/');
    // Windows: Claude Code matches //c/Users/... (lowercase drive, no colon); //C:/... is denied.
    const expected =
      process.platform === 'win32' ? '//' + fwd.replace(/^([A-Za-z]):/, (_, d: string) => d.toLowerCase()) : '/' + fwd;
    expect(permissionPath(outside)).toBe(expected);
  });
});

describe('runAgent', () => {
  it('streams assistant text', async () => {
    const reel = await savedReel();
    const { spawnFn, calls } = fakeClaude([
      { lines: [say('Script likh raha hoon'), toolUse, say('Ho gaya!'), done], write: retitle('Streamed') },
    ]);
    const texts: string[] = [];
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: (t) => texts.push(t), spawnFn });
    expect(res).toEqual({ ok: true });
    expect(texts).toEqual(['Script likh raha hoon', 'Ho gaya!']);
    expect(calls[0].cwd).toBe(REPO_ROOT);
    expect(calls[0].prompt).toContain('SKILL.md');
    expect(calls[0].prompt).toContain(permissionPath(reelFile(reel.id)));
  });

  it('accepts valid edit', async () => {
    const reel = await savedReel();
    const { spawnFn } = fakeClaude([
      {
        lines: [done],
        write: async (file) => {
          const r = JSON.parse(readFileSync(file, 'utf8'));
          r.title = 'Naya title';
          await writeFile(file, JSON.stringify(r));
        },
      },
    ]);
    expect(await runAgent({ reelId: reel.id, mode: 'review', instruction: 'title badlo', onText: () => {}, spawnFn })).toEqual({ ok: true });
    expect((await getReel(reel.id)).title).toBe('Naya title');
  });

  it('rolls back invalid agent edit', async () => {
    const reel = await savedReel();
    const before = readFileSync(reelFile(reel.id), 'utf8');
    const { spawnFn, calls } = fakeClaude([{ lines: [done], write: (file) => writeFile(file, '{ broken json') }]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toContain('Your last edit was invalid:');
    expect(calls[1].prompt).toContain('Fix reel.json.');
    expect(readFileSync(reelFile(reel.id), 'utf8')).toBe(before);
    if (!res.ok) expect(res.error).toMatch(/invalid/i);
  });

  it('retries once with the zod error and accepts the fix', async () => {
    const reel = await savedReel();
    const { spawnFn, calls } = fakeClaude([
      {
        lines: [done],
        write: async (file) => {
          const r = JSON.parse(readFileSync(file, 'utf8'));
          r.lines[0].spoken = 'एआई से'; // word-count mismatch
          await writeFile(file, JSON.stringify(r));
        },
      },
      {
        lines: [done],
        write: async (file) => {
          const r = JSON.parse(readFileSync(file, 'utf8'));
          r.title = 'fixed';
          await writeFile(file, JSON.stringify(r));
        },
      },
    ]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res).toEqual({ ok: true });
    expect(calls[1].prompt).toMatch(/caption has 8 words, spoken has 2/);
    const saved = await getReel(reel.id);
    expect(saved.title).toBe('fixed');
    expect(saved.lines[0].spoken).toBe(reel.lines[0].spoken); // retry started from the restored file
  });

  it('keeps server-owned fields even if the agent edits them', async () => {
    const reel = await savedReel();
    const { spawnFn } = fakeClaude([
      {
        lines: [done],
        write: async (file) => {
          const r = JSON.parse(readFileSync(file, 'utf8'));
          r.hashes = { voice: 'forged' };
          r.createdAt = '2000-01-01T00:00:00.000Z';
          await writeFile(file, JSON.stringify(r));
        },
      },
    ]);
    expect((await runAgent({ reelId: reel.id, mode: 'review', instruction: 'x', onText: () => {}, spawnFn })).ok).toBe(true);
    const saved = await getReel(reel.id);
    expect(saved.hashes).toEqual(reel.hashes);
    expect(saved.createdAt).toBe(reel.createdAt);
  });

  it('an unchanged reel.json is a failure, not a silent success', async () => {
    const reel = await savedReel();
    const { spawnFn, calls } = fakeClaude([{ lines: [say('Mujhe permission nahi mili'), done] }]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res).toEqual({ ok: false, error: expect.stringContaining('did not change reel.json') });
    expect(calls).toHaveLength(1);
  });

  it('reports permission denials', async () => {
    const reel = await savedReel();
    const denied = {
      ...done,
      permission_denials: [{ tool_name: 'Write', tool_input: { file_path: reelFile(reel.id) } }],
    };
    const { spawnFn } = fakeClaude([{ lines: [denied] }]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res).toEqual({ ok: false, error: expect.stringContaining('was not allowed to use Write') });
    expect(res.ok === false && res.error).toContain(reelFile(reel.id));
  });

  it('a denied side tool does not undo a valid edit', async () => {
    const reel = await savedReel();
    const denied = { ...done, permission_denials: [{ tool_name: 'PowerShell', tool_input: {} }] };
    const { spawnFn } = fakeClaude([{ lines: [denied], write: retitle('Kept') }]);
    expect(await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn })).toEqual({ ok: true });
    expect((await getReel(reel.id)).title).toBe('Kept');
  });

  it('reports claude missing', async () => {
    const reel = await savedReel();
    const err = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
    const { spawnFn } = fakeClaude([{ error: err }]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Claude Code not found');
  });

  it('reports a Claude error result (e.g. not logged in) and restores', async () => {
    const reel = await savedReel();
    const before = readFileSync(reelFile(reel.id), 'utf8');
    const { spawnFn, calls } = fakeClaude([
      {
        lines: [{ type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key · Please run /login' }],
        write: (file) => writeFile(file, '{}'),
        code: 1,
      },
    ]);
    const res = await runAgent({ reelId: reel.id, mode: 'script', onText: () => {}, spawnFn });
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Please run /login') });
    expect(calls).toHaveLength(1);
    expect(readFileSync(reelFile(reel.id), 'utf8')).toBe(before);
  });
});

describe('prompts', () => {
  const reel = exampleReel();
  it('every prompt points at SKILL.md, the schema doc and the one editable file', () => {
    for (const p of [scriptPrompt(reel), scenesPrompt(reel, []), reviewPrompt(reel, 'number bada karo')]) {
      expect(p).toContain('.claude/skills/reels/SKILL.md');
      expect(p).toContain('docs/reel-schema.md');
      expect(p).toContain(permissionPath(reelFile(reel.id)));
    }
  });
  it('script prompt sets the word budget from targetSeconds', () => {
    expect(scriptPrompt({ ...reel, targetSeconds: 30 })).toContain('about 69 words');
  });
  it('script prompt asks for a hook pattern, human Hinglish and a mood on every line', () => {
    const p = scriptPrompt(reel);
    expect(p).toMatch(/Ruko!/);
    expect(p).toMatch(/Sach batau\?/);
    expect(p).toMatch(/"mood"/);
    for (const m of ['excited', 'curious', 'serious', 'funny', 'calm', 'shocked']) expect(p).toContain(m);
    expect(p).toMatch(/!.*\?.*…/s); // emotion through punctuation
  });

  it('scenes prompt allows a face change on every emotional beat with all 8 faces', () => {
    const p = scenesPrompt(reel, []);
    expect(p).not.toMatch(/1–3 "expression"/);
    for (const f of ['happy', 'thinking', 'surprised', 'wink', 'excited', 'laughing', 'shocked', 'sad']) expect(p).toContain(f);
  });

  it('scenes prompt asks for a varied entrance style per cue', () => {
    const p = scenesPrompt(reel, []);
    expect(p).toContain('"anim"');
    for (const a of ['pop', 'slide', 'zoom', 'bounce', 'typewriter']) expect(p).toContain(a);
  });

  it('scenes prompt lists words with index and time', () => {
    const p = scenesPrompt(reel, [{ i: 9, caption: '3', spoken: 'तीन', start: 2.5, end: 2.8, filled: false }]);
    expect(p).toContain('9 3 @2.50s');
  });
  it('review prompt includes the instruction and the learned-rules rule', () => {
    const p = reviewPrompt(reel, 'number aur bada karo');
    expect(p).toContain('number aur bada karo');
    expect(p).toContain('## Learned rules');
  });
});
