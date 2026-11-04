import { describe, expect, it } from 'vitest';
import { countFrom } from './blocks/BigNumber.tsx';

describe('countFrom', () => {
  it('small numbers (steps, "3 tips") appear at their value instead of counting up from 0', () => {
    expect(countFrom(1)).toBe(1);
    expect(countFrom(3)).toBe(3);
    expect(countFrom(10)).toBe(10);
  });
  it('bigger numbers count up from 0', () => {
    expect(countFrom(11)).toBe(0);
    expect(countFrom(90)).toBe(0);
    expect(countFrom(-50)).toBe(0);
  });
});
