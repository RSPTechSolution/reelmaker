import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type RunFn = (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>;

export type ToolCheck = {
  name: 'node' | 'python' | 'espeak-ng' | 'claude';
  ok: boolean;
  version?: string;
  fix?: string;
};

const MIN_NODE = [22, 18] as const;

const FIX = {
  node: `Install Node.js ${MIN_NODE.join('.')} or newer from https://nodejs.org (LTS installer).`,
  python:
    'Install Python 3.12 from https://www.python.org/downloads/ (tick "Add python.exe to PATH"). Kokoro does not support 3.13+.',
  'espeak-ng':
    'Install espeak-ng: download the .msi from https://github.com/espeak-ng/espeak-ng/releases and run it.',
  claude: 'Install Claude Code (https://docs.claude.com/claude-code), then run `claude` once and log in.',
} as const;

// Windows default install location of the espeak-ng MSI; it does not always add itself to PATH.
const ESPEAK_WIN_PATH = 'C:\\Program Files\\eSpeak NG\\espeak-ng.exe';

async function tryRun(run: RunFn, cmd: string, args: string[]) {
  try {
    return await run(cmd, args);
  } catch {
    return { code: -1, stdout: '' };
  }
}

function parseVersion(text: string): number[] | undefined {
  const m = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : undefined;
}

async function checkNode(run: RunFn): Promise<ToolCheck> {
  const r = await tryRun(run, 'node', ['--version']);
  const v = r.code === 0 ? parseVersion(r.stdout) : undefined;
  if (!v) return { name: 'node', ok: false, fix: FIX.node };
  const ok = v[0] > MIN_NODE[0] || (v[0] === MIN_NODE[0] && v[1] >= MIN_NODE[1]);
  return { name: 'node', ok, version: v.join('.'), fix: ok ? undefined : FIX.node };
}

async function checkPython(run: RunFn): Promise<ToolCheck> {
  const candidates: [string, string[]][] =
    process.platform === 'win32'
      ? [['py', ['-3.12', '--version']], ['python', ['--version']]]
      : [['python3.12', ['--version']], ['python3', ['--version']], ['python', ['--version']]];
  let seen: string | undefined;
  for (const [cmd, args] of candidates) {
    const r = await tryRun(run, cmd, args);
    const v = r.code === 0 ? parseVersion(r.stdout) : undefined;
    if (!v) continue;
    if (v[0] === 3 && v[1] === 12) return { name: 'python', ok: true, version: v.join('.') };
    seen ??= v.join('.');
  }
  return {
    name: 'python',
    ok: false,
    version: seen,
    fix: seen ? `Found Python ${seen}, but 3.12 is required. ${FIX.python}` : FIX.python,
  };
}

async function checkEspeak(run: RunFn): Promise<ToolCheck> {
  const cmds = process.platform === 'win32' ? ['espeak-ng', ESPEAK_WIN_PATH] : ['espeak-ng'];
  for (const cmd of cmds) {
    const r = await tryRun(run, cmd, ['--version']);
    if (r.code === 0) return { name: 'espeak-ng', ok: true, version: parseVersion(r.stdout)?.join('.') };
  }
  return { name: 'espeak-ng', ok: false, fix: FIX['espeak-ng'] };
}

async function checkClaude(run: RunFn): Promise<ToolCheck> {
  const r = await tryRun(run, 'claude', ['--version']);
  if (r.code !== 0) return { name: 'claude', ok: false, fix: FIX.claude };
  return { name: 'claude', ok: true, version: parseVersion(r.stdout)?.join('.') };
}

export async function checkTools(run: RunFn): Promise<ToolCheck[]> {
  return [await checkNode(run), await checkPython(run), await checkEspeak(run), await checkClaude(run)];
}

function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stdout += d)); // some tools print --version to stderr
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout }));
  });
}

// Real runner. On Windows, npm-installed CLIs are .cmd shims that spawn() cannot start
// without a shell, so on ENOENT retry once through cmd.exe (args here are fixed literals).
export const realRun: RunFn = async (cmd, args) => {
  try {
    return await spawnCapture(cmd, args);
  } catch (err) {
    if (process.platform !== 'win32' || (err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return spawnCapture('cmd.exe', ['/d', '/s', '/c', cmd, ...args]);
  }
};

function printTable(checks: ToolCheck[]) {
  const rows = checks.map((c) => [c.ok ? 'OK  ' : 'FAIL', c.name, c.version ?? '-']);
  const w = [4, Math.max(...rows.map((r) => r[1].length)), Math.max(...rows.map((r) => r[2].length))];
  for (const r of rows) console.log(r.map((cell, i) => cell.padEnd(w[i])).join('  '));
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.log('\nTo fix:');
    for (const c of failed) console.log(`- ${c.name}: ${c.fix}`);
  }
}

async function main() {
  const checks = await checkTools(realRun);
  printTable(checks);
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
