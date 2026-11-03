import { describe, expect, it } from 'vitest';
import { prefixLines } from './dev.ts';

describe('prefixLines', () => {
  it('prefixes complete lines and keeps the partial tail for later', () => {
    const p = prefixLines('[web] ');
    expect(p('hello\nwor')).toBe('[web] hello\n');
    expect(p('ld\r\n')).toBe('[web] world\n');
    expect(p('')).toBe('');
  });
});
