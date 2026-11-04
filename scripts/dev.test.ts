import { describe, expect, it } from 'vitest';
import { prefixLines, serverArgs } from './dev.ts';

describe('prefixLines', () => {
  it('prefixes complete lines and keeps the partial tail for later', () => {
    const p = prefixLines('[web] ');
    expect(p('hello\nwor')).toBe('[web] hello\n');
    expect(p('ld\r\n')).toBe('[web] world\n');
    expect(p('')).toBe('');
  });
});

describe('serverArgs', () => {
  it('runs the server without a file watcher by default (a watcher restart would kill running jobs)', () => {
    expect(serverArgs(false)).toEqual(['src/main.ts']);
  });
  it('watches only our own sources with --watch', () => {
    expect(serverArgs(true)).toEqual(['--watch-path=src', '--watch-path=../shared/src', 'src/main.ts']);
  });
});
