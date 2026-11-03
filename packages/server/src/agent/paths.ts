import path from 'node:path';
import { REPO_ROOT } from '../paths.ts';

/**
 * A file path in Claude Code permission-rule form: relative to the repo root (Claude's cwd)
 * with forward slashes, or `//absolute/path` when the file is outside the repo.
 * On Windows the absolute form is `//c/Users/...` (lowercase drive, no colon) — checked against
 * Claude Code 2.1: `//C:/Users/...` and `/C:/Users/...` are denied.
 */
export function permissionPath(file: string): string {
  const rel = path.relative(REPO_ROOT, file);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.split(path.sep).join('/');
  const fwd = path.resolve(file).split(path.sep).join('/');
  if (process.platform === 'win32') return '//' + fwd.replace(/^([A-Za-z]):/, (_, d: string) => d.toLowerCase());
  return '/' + fwd; // POSIX: fwd already starts with '/'
}
