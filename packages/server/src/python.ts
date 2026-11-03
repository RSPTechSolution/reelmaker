import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { REPO_ROOT } from './paths.ts';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (p: number, msg: string) => void;
};

type WorkerMessage =
  | { ready: true }
  | { id: string; progress: number; message?: string }
  | { id: string; ok: true; result: unknown }
  | { id: string | null; ok: false; error: string };

const STDERR_LINES = 20;
const READY_TIMEOUT_MS = 120_000;

export function venvPython(): string {
  return process.platform === 'win32'
    ? path.join(REPO_ROOT, 'py', '.venv', 'Scripts', 'python.exe')
    : path.join(REPO_ROOT, 'py', '.venv', 'bin', 'python');
}

/** Long-running py/worker.py speaking JSON lines. Started lazily; restarts once after a crash. */
export class PyWorker {
  private python: string;
  private script: string;
  private env: Record<string, string>;
  private proc: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private pending = new Map<string, Pending>();
  private stderrTail: string[] = [];
  private nextId = 1;
  private restartedSinceSuccess = false;
  private stopping = false;

  constructor(opts: { python?: string; script?: string; env?: Record<string, string> } = {}) {
    this.python = opts.python ?? venvPython();
    this.script = opts.script ?? path.join(REPO_ROOT, 'py', 'worker.py');
    this.env = opts.env ?? {};
  }

  start(): Promise<void> {
    if (this.starting) return this.starting;
    this.stopping = false;
    this.stderrTail = [];
    this.starting = new Promise<void>((resolve, reject) => {
      const proc = spawn(this.python, ['-u', this.script], {
        cwd: REPO_ROOT,
        env: { ...process.env, ...this.env, PYTHONIOENCODING: 'utf-8' },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.proc = proc;
      const timer = setTimeout(() => {
        reject(new Error(`audio worker did not start within ${READY_TIMEOUT_MS / 1000}s\n${this.tail()}`));
        proc.kill();
      }, READY_TIMEOUT_MS);

      proc.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        this.starting = null;
        this.proc = null;
        reject(
          err.code === 'ENOENT'
            ? new Error(`Python environment not found at ${this.python} — run \`npm run setup\``)
            : err,
        );
      });

      createInterface({ input: proc.stderr!, crlfDelay: Infinity }).on('line', (line) => {
        this.stderrTail.push(line);
        if (this.stderrTail.length > STDERR_LINES) this.stderrTail.shift();
      });

      createInterface({ input: proc.stdout!, crlfDelay: Infinity }).on('line', (line) => {
        let msg: WorkerMessage;
        try {
          msg = JSON.parse(line);
        } catch {
          return; // not protocol output
        }
        if ('ready' in msg) {
          clearTimeout(timer);
          resolve();
          return;
        }
        this.handle(msg);
      });

      proc.on('close', (code) => { // 'close' (not 'exit') so the stderr tail is complete
        clearTimeout(timer);
        if (this.proc !== proc) return;
        this.proc = null;
        this.starting = null;
        const err = new Error(`audio worker stopped (exit code ${code})\n${this.tail()}`);
        reject(err); // no-op if it already became ready
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
        if (!this.stopping && !this.restartedSinceSuccess) {
          this.restartedSinceSuccess = true;
          this.start().catch(() => {}); // a later call will report the failure
        }
      });
    });
    return this.starting;
  }

  async call<T>(op: string, args: object, onProgress?: (p: number, msg: string) => void): Promise<T> {
    await this.start();
    const id = String(this.nextId++);
    const result = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    });
    this.proc!.stdin!.write(JSON.stringify({ id, op, args }) + '\n', 'utf8');
    return result;
  }

  stop(): void {
    this.stopping = true;
    this.proc?.kill();
    this.proc = null;
    this.starting = null;
  }

  private handle(msg: Exclude<WorkerMessage, { ready: true }>) {
    const p = msg.id === null ? undefined : this.pending.get(msg.id);
    if (!p) return;
    if ('progress' in msg) {
      p.onProgress?.(msg.progress, msg.message ?? '');
      return;
    }
    this.pending.delete(msg.id!);
    if (msg.ok) {
      this.restartedSinceSuccess = false;
      p.resolve(msg.result);
    } else {
      p.reject(new Error(msg.error));
    }
  }

  private tail(): string {
    return this.stderrTail.join('\n');
  }
}

let shared: PyWorker | null = null;

/** The one worker the server uses; created on first use. */
export function getWorker(): PyWorker {
  return (shared ??= new PyWorker());
}
