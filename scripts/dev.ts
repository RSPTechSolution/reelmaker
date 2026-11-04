// npm run dev: starts the server (127.0.0.1:4000) and the web app (Vite, :5173)
// together, prefixes their output, and stops both on Ctrl+C or when either one exits.
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Returns a function that turns output chunks into prefixed complete lines (keeps a partial tail). */
export function prefixLines(prefix: string): (chunk: string) => string {
  let tail = '';
  return (chunk) => {
    const parts = (tail + chunk).split(/\r?\n/);
    tail = parts.pop() ?? '';
    return parts.map((l) => `${prefix}${l}\n`).join('');
  };
}

/**
 * Node arguments for the server. No file watcher by default: on Windows the watcher fires when
 * antivirus or an editor merely touches a file, and the restart silently kills running jobs
 * (voice, render). `npm run dev:watch` turns it on for working on server code.
 */
export function serverArgs(watch: boolean): string[] {
  return watch ? ['--watch-path=src', '--watch-path=../shared/src', 'src/main.ts'] : ['src/main.ts'];
}

function start(name: string, cwd: string, args: string[]): ChildProcess {
  // node + script path: npm/npx are .cmd shims on Windows and would need a shell
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const out = prefixLines(`[${name}] `);
  const err = prefixLines(`[${name}] `);
  child.stdout!.on('data', (d) => process.stdout.write(out(String(d))));
  child.stderr!.on('data', (d) => process.stderr.write(err(String(d))));
  return child;
}

function main() {
  const webDir = path.join(ROOT, 'packages', 'web');
  const viteDir = path.dirname(createRequire(path.join(webDir, 'package.json')).resolve('vite/package.json'));
  const children = [
    start('server', path.join(ROOT, 'packages', 'server'), serverArgs(process.argv.includes('--watch'))),
    start('web', webDir, [path.join(viteDir, 'bin', 'vite.js')]),
  ];
  let stopping = false;
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    for (const c of children) if (c.exitCode === null) c.kill();
    process.exitCode = code;
  };
  for (const c of children) c.on('exit', (code) => stop(code ?? 1));
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  console.log('Reel Maker is starting: open http://localhost:5173 (Ctrl+C stops both)');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
