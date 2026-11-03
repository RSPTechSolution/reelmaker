import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lineGap, moodExpression, moodSpeed } from './mood.ts';
import { Expression, Line, MascotConfig, type Reel } from './schema.ts';
import { spokenHash } from './timing.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = (): Reel => JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'example-reel.json'), 'utf8'));
const line = (spoken: string, mood?: Line['mood']): Line => ({ id: 'l1', caption: spoken, spoken, ...(mood ? { mood } : {}) });

describe('moodSpeed', () => {
  it('speeds up excited lines and slows calm ones', () => {
    expect(moodSpeed(1, 'excited')).toBeCloseTo(1.12);
    expect(moodSpeed(1, 'calm')).toBeCloseTo(0.88);
    expect(moodSpeed(1.1, undefined)).toBe(1.1);
  });
  it('stays in a range Kokoro handles', () => {
    expect(moodSpeed(1.3, 'excited')).toBe(1.4);
    expect(moodSpeed(0.8, 'calm')).toBeCloseTo(0.704);
  });
});

describe('lineGap', () => {
  it('pauses longer after questions, exclamations and trailing dots', () => {
    expect(lineGap(line('सीधी बात'), false)).toBeCloseTo(0.15);
    expect(lineGap(line('फिर भी वीडियो?'), false)).toBeCloseTo(0.35);
    expect(lineGap(line('बस इतना!'), false)).toBeCloseTo(0.25);
    expect(lineGap(line('और फिर…'), false)).toBeCloseTo(0.45);
    expect(lineGap(line('और फिर...'), false)).toBeCloseTo(0.45);
  });
  it('adds a beat for shocked and serious lines, none after the last line', () => {
    expect(lineGap(line('सच में?', 'shocked'), false)).toBeCloseTo(0.45);
    expect(lineGap(line('सुनो', 'serious'), false)).toBeCloseTo(0.25);
    expect(lineGap(line('फॉलो करो!'), true)).toBe(0);
  });
});

describe('moodExpression', () => {
  it('maps moods to mascot faces', () => {
    expect(moodExpression('excited')).toBe('excited');
    expect(moodExpression('curious')).toBe('thinking');
    expect(moodExpression('funny')).toBe('laughing');
    expect(moodExpression('shocked')).toBe('shocked');
    expect(moodExpression(undefined)).toBeUndefined();
  });
});

describe('schema additions', () => {
  it('lines accept an optional known mood', () => {
    expect(Line.safeParse(line('नमस्ते', 'funny')).success).toBe(true);
    expect(Line.safeParse({ ...line('नमस्ते'), mood: 'angry' }).success).toBe(false);
  });
  it('has the 8 expressions', () => {
    expect(Expression.options).toEqual(['happy', 'thinking', 'surprised', 'wink', 'excited', 'laughing', 'shocked', 'sad']);
  });
  it('mascot can be an image character with safe image paths only', () => {
    const base = { body: '#000', face: '#fff', accent: '#ff0', signature: 'antenna' as const };
    expect(MascotConfig.safeParse({ ...base, kind: 'image', images: { happy: '/character/happy-1a2b3c4d.png' } }).success).toBe(true);
    expect(
      MascotConfig.safeParse({ ...base, kind: 'image', images: { happy: 'http://127.0.0.1:4000/character/happy-1a2b3c4d.webp' } }).success,
    ).toBe(true);
    for (const bad of ['https://evil.example/x.png', '/character/../brand.json', '/files/x.png', '/character/a.svg']) {
      expect(MascotConfig.safeParse({ ...base, images: { happy: bad } }).success, bad).toBe(false);
    }
    expect(MascotConfig.parse(base)).toEqual(base); // old mascot.json files stay valid
  });
  it('spokenHash changes when a line mood changes (it changes pace and pauses)', () => {
    const r = example();
    const h = spokenHash(r);
    r.lines[0].mood = 'excited';
    expect(spokenHash(r)).not.toBe(h);
  });
});
