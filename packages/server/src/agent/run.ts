import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { Reel, type WordTiming } from '@reelmaker/shared';
import { reelDir, reelFile, REPO_ROOT } from '../paths.ts';
import { backupReel, getReel, restoreReel, saveReel } from '../store.ts';
import { permissionPath } from './paths.ts';
import { reviewPrompt, scenesPrompt, scriptPrompt, SKILL_FILE } from './prompts.ts';

export { permissionPath } from './paths.ts';

export type AgentMode = 'script' | 'scenes' | 'review';
export type AgentResult = { ok: true } | { ok: false; error: string };
type RunResult = { ok: true; denied: string[] } | { ok: false; error: string };

type ChildLike = {
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  kill(): boolean;
  on(event: 'error', cb: (err: NodeJS.ErrnoException) => void): unknown;
  on(event: 'close', cb: (code: number | null) => void): unknown;
};
export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string }) => ChildLike;

const RUN_TIMEOUT_MS = 15 * 60_000;
const NOT_FOUND = 'Claude Code not found — install Claude Code, then run `claude` once in a terminal to log in';

/**
 * Arguments for `claude`. The prompt is NOT on the command line: it is written to stdin
 * (`claude -p` reads it there). On Windows an npm-installed claude.cmd runs through cmd.exe,
 * where a prompt with & | % would be interpreted, and command lines are capped at ~32 KB.
 */
export function buildClaudeArgs(reelId: string, _prompt?: string): string[] {
  const file = permissionPath(reelFile(reelId));
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--allowedTools',
    'Read',
    `Edit(${file})`,
    `Write(${file})`,
    `Edit(${SKILL_FILE})`,
    '--disallowedTools',
    'Bash',
    'PowerShell', // Windows' shell tool
    'WebFetch',
    'WebSearch',
  ];
}

let resolved: Promise<{ cmd: string; prefix: string[]; verbatim: boolean }> | null = null;

/** `claude` as a spawnable command; on Windows resolved once via `where claude`. */
function resolveClaude() {
  resolved ??= new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ cmd: 'claude', prefix: [], verbatim: false });
    execFile('where', ['claude'], { windowsHide: true }, (err, stdout) => {
      const hits = err ? [] : stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const exe = hits.find((h) => h.toLowerCase().endsWith('.exe'));
      const cmdShim = hits.find((h) => /\.(cmd|bat)$/i.test(h));
      if (exe || !cmdShim) return resolve({ cmd: exe ?? 'claude', prefix: [], verbatim: false });
      // .cmd needs cmd.exe; every argument is a fixed literal or a SafeId path, quoted below.
      resolve({ cmd: 'cmd.exe', prefix: [cmdShim], verbatim: true });
    });
  });
  return resolved;
}

const realSpawn: SpawnFn = (cmd, args, opts) => spawn(cmd, args, { cwd: opts.cwd, windowsHide: true });

async function spawnClaude(args: string[], cwd: string, spawnFn?: SpawnFn): Promise<ChildLike> {
  if (spawnFn) return spawnFn('claude', args, { cwd });
  const { cmd, prefix, verbatim } = await resolveClaude();
  if (!verbatim) return realSpawn(cmd, [...prefix, ...args], { cwd });
  const line = [...prefix, ...args].map((a) => `"${a}"`).join(' ');
  return spawn('cmd.exe', ['/d', '/s', '/c', `"${line}"`], { cwd, windowsHide: true, windowsVerbatimArguments: true });
}

type Denial = { tool_name?: string; tool_input?: { file_path?: string } };
type ResultLine = { type: 'result'; is_error?: boolean; result?: string; subtype?: string; permission_denials?: Denial[] };
type StreamLine =
  | { type: 'assistant'; message?: { content?: { type: string; text?: string }[] } }
  | ResultLine
  | { type: string };

/** One `claude -p` run: prompt on stdin, assistant text to onText, resolves at exit. */
async function runClaudeOnce(
  reelId: string,
  prompt: string,
  onText: (t: string) => void,
  spawnFn?: SpawnFn,
): Promise<RunResult> {
  let child: ChildLike;
  try {
    child = await spawnClaude(buildClaudeArgs(reelId), REPO_ROOT, spawnFn);
  } catch (err) {
    return { ok: false, error: (err as NodeJS.ErrnoException).code === 'ENOENT' ? NOT_FOUND : String(err) };
  }
  return new Promise<RunResult>((resolve) => {
    let result: ResultLine | null = null;
    const stderr: string[] = [];
    let settled = false;
    const finish = (r: RunResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(r);
      }
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: `Claude Code did not finish within ${RUN_TIMEOUT_MS / 60_000} minutes` });
    }, RUN_TIMEOUT_MS);

    child.on('error', (err) => finish({ ok: false, error: err.code === 'ENOENT' ? NOT_FOUND : err.message }));
    if (child.stderr) {
      createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', (l) => {
        stderr.push(l);
        if (stderr.length > 20) stderr.shift();
      });
    }
    createInterface({ input: child.stdout!, crlfDelay: Infinity }).on('line', (line) => {
      let msg: StreamLine;
      try {
        msg = JSON.parse(line);
      } catch {
        return; // hooks and other tools may print plain text
      }
      if (msg.type === 'assistant' && 'message' in msg) {
        for (const block of msg.message?.content ?? []) if (block.type === 'text' && block.text) onText(block.text);
      } else if (msg.type === 'result') {
        result = msg as ResultLine;
      }
    });
    child.on('close', (code) => {
      const r = result as ResultLine | null;
      // Denials are reported only if they mattered (reel.json unchanged) — see runAgent.
      const denied = (r?.permission_denials ?? []).map(
        (d) => `${d.tool_name ?? 'a tool'}${d.tool_input?.file_path ? ` on ${d.tool_input.file_path}` : ''}`,
      );
      if (r && !r.is_error) return finish({ ok: true, denied: [...new Set(denied)] });
      if (r?.is_error) return finish({ ok: false, error: `Claude Code: ${r.result ?? r.subtype ?? 'error'}` });
      finish({ ok: false, error: `Claude Code exited with code ${code}${stderr.length ? `: ${stderr.join('\n')}` : ''}` });
    });
    child.stdin?.end(prompt, 'utf8');
  });
}

/** Reads the agent's reel.json; server-owned fields come from the backup. */
async function readAgentEdit(id: string, backup: Reel): Promise<{ ok: true; reel: Reel } | { ok: false; message: string }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(reelFile(id), 'utf8'));
  } catch (err) {
    return { ok: false, message: `reel.json is not valid JSON (${(err as Error).message})` };
  }
  const edit = raw as Partial<Reel>;
  const merged = {
    ...edit,
    id: backup.id,
    hashes: backup.hashes,
    createdAt: backup.createdAt,
    // owner's music/effect choices survive an agent that rewrites the file without them
    ...(edit.audio === undefined && backup.audio ? { audio: backup.audio } : {}),
    ...(edit.effects === undefined && backup.effects ? { effects: backup.effects } : {}),
  };
  const parsed = Reel.safeParse(merged);
  if (parsed.success) return { ok: true, reel: parsed.data };
  return {
    ok: false,
    message: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}

export async function runAgent(opts: {
  reelId: string;
  mode: AgentMode;
  instruction?: string;
  onText: (t: string) => void;
  spawnFn?: SpawnFn;
}): Promise<AgentResult> {
  const { reelId, mode, instruction, onText, spawnFn } = opts;
  const reel = await getReel(reelId);
  const wordsFile = path.join(reelDir(reelId), 'words.json');
  const words: WordTiming[] = existsSync(wordsFile) ? JSON.parse(await readFile(wordsFile, 'utf8')) : [];
  const base =
    mode === 'script'
      ? scriptPrompt(reel, instruction)
      : mode === 'scenes'
        ? scenesPrompt(reel, words, instruction)
        : reviewPrompt(reel, instruction ?? '');

  await backupReel(reelId);
  const before = await readFile(reelFile(reelId), 'utf8');
  let prompt = base;
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = await runClaudeOnce(reelId, prompt, onText, spawnFn);
    if (!run.ok) {
      await restoreReel(reelId);
      return run;
    }
    if ((await readFile(reelFile(reelId), 'utf8')) === before) {
      if (run.denied.length) return { ok: false, error: `Claude Code was not allowed to use ${run.denied.join(', ')}` };
      return { ok: false, error: 'The agent finished but did not change reel.json — see its message above.' };
    }
    const edit = await readAgentEdit(reelId, reel);
    if (edit.ok) {
      await saveReel(edit.reel);
      return { ok: true };
    }
    await restoreReel(reelId);
    lastError = edit.message;
    prompt = `${base}\n\nYour last edit was invalid: ${edit.message}. Fix reel.json.`;
  }
  return { ok: false, error: `The agent's edit was invalid twice, so the reel was restored. Last error: ${lastError}` };
}
