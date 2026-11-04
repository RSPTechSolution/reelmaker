import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkTools, realRun } from './doctor.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENV = path.join(ROOT, 'py', '.venv');
const VENV_PY =
  process.platform === 'win32' ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
const DATA = process.env.REEL_DATA_DIR ?? path.join(ROOT, 'data');

function step(title: string) {
  console.log(`\n== ${title}`);
}

// Runs a process with inherited stdio; rejects on non-zero exit.
function runInherit(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

function npmInstall() {
  // npm is a .cmd shim on Windows; run its JS entry through node when `npm run` gave us its path.
  const npmCli = process.env.npm_execpath;
  if (npmCli && npmCli.endsWith('.js')) return runInherit(process.execPath, [npmCli, 'install']);
  if (process.platform === 'win32') return runInherit('cmd.exe', ['/d', '/s', '/c', 'npm', 'install']);
  return runInherit('npm', ['install']);
}

async function python312(): Promise<[string, string[]]> {
  const candidates: [string, string[]][] =
    process.platform === 'win32' ? [['py', ['-3.12']], ['python', []]] : [['python3.12', []], ['python3', []]];
  for (const [cmd, pre] of candidates) {
    try {
      const r = await realRun(cmd, [...pre, '--version']);
      if (r.code === 0 && /Python 3\.12\./.test(r.stdout)) return [cmd, pre];
    } catch {
      // try next candidate
    }
  }
  throw new Error('Python 3.12 not found. Run `npm run doctor` for install instructions.');
}

async function writeIfMissing(file: string, value: unknown) {
  if (existsSync(file)) return console.log(`kept existing ${path.relative(ROOT, file)}`);
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  console.log(`created ${path.relative(ROOT, file)}`);
}

async function main() {
  step('Checking tools');
  const checks = await checkTools(realRun);
  for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name} ${c.version ?? ''}`);
  const blocking = checks.filter((c) => !c.ok && (c.name === 'node' || c.name === 'python'));
  if (blocking.length) {
    for (const c of blocking) console.error(`- ${c.name}: ${c.fix}`);
    throw new Error('Fix the tools above, then run `npm run setup` again.');
  }

  step('npm install');
  await npmInstall();

  step('Python virtual environment (py/.venv)');
  if (existsSync(VENV_PY)) {
    console.log('venv already exists');
  } else {
    const [cmd, pre] = await python312();
    await runInherit(cmd, [...pre, '-m', 'venv', VENV]);
  }

  const requirements = path.join(ROOT, 'py', 'requirements.txt');
  step('pip install -r py/requirements.txt');
  if (existsSync(requirements)) {
    await runInherit(VENV_PY, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    await runInherit(VENV_PY, ['-m', 'pip', 'install', '-r', requirements]);
  } else {
    console.log('skipped: py/requirements.txt not present yet');
  }

  const warmup = path.join(ROOT, 'py', 'warmup.py');
  step('Downloading models (Kokoro + whisper small) — first run takes a few minutes');
  if (existsSync(warmup)) await runInherit(VENV_PY, [warmup]);
  else console.log('skipped: py/warmup.py not present yet');

  step('Built-in sound effects and beats');
  if (existsSync(VENV_PY)) await runInherit(VENV_PY, [path.join(ROOT, 'py', 'make_sounds.py'), DATA]);
  else console.log('skipped: Python environment not ready');

  step('Default brand and mascot');
  await mkdir(path.join(DATA, 'reels'), { recursive: true });
  const defaultsFile = path.join(ROOT, 'packages', 'shared', 'src', 'defaults.ts');
  if (existsSync(defaultsFile)) {
    const { defaultBrand, defaultMascot } = await import(pathToFileURL(defaultsFile).href);
    await writeIfMissing(path.join(DATA, 'brand.json'), defaultBrand);
    await writeIfMissing(path.join(DATA, 'mascot.json'), defaultMascot);
  } else {
    console.log('skipped: packages/shared/src/defaults.ts not present yet');
  }

  const espeak = checks.find((c) => c.name === 'espeak-ng');
  console.log('\nSetup finished.');
  if (espeak && !espeak.ok) console.log(`Warning — voice generation needs espeak-ng: ${espeak.fix}`);
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
