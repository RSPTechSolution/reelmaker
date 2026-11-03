import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Brand, Line, MascotConfig, Reel } from './schema.ts';
import { defaultBrand, defaultMascot } from './defaults.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, '..', 'fixtures', 'example-reel.json');
const docPath = path.join(here, '..', '..', '..', 'docs', 'reel-schema.md');
const example = () => JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('Line', () => {
  it('rejects word-count mismatch', () => {
    const r = Line.safeParse({ id: 'l1', caption: 'AI se video', spoken: 'एआई से' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toContain('caption has 3 words, spoken has 2');
    expect(r.error!.issues[0].message).toContain('line l1');
  });

  it('counts words split on any whitespace', () => {
    const r = Line.safeParse({ id: 'l1', caption: '  AI   se\tvideo ', spoken: 'एआई से वीडियो' });
    expect(r.success).toBe(true);
  });
});

describe('Reel', () => {
  it('accepts valid example', () => {
    const r = Reel.safeParse(example());
    if (!r.success) throw new Error(r.error.message);
    expect(r.data.lines.length).toBeGreaterThan(0);
  });

  it('example in docs/reel-schema.md matches the fixture', () => {
    const doc = readFileSync(docPath, 'utf8');
    const m = doc.match(/```json\r?\n([\s\S]*?)```/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toEqual(example());
  });

  it('rejects cue beyond last word', () => {
    const reel = example();
    const total = reel.lines.reduce(
      (n: number, l: { caption: string }) => n + l.caption.trim().split(/\s+/).length,
      0,
    );
    reel.cues.push({ id: 'late', atWord: total, block: { type: 'sticker', text: 'late' } });
    const r = Reel.safeParse(reel);
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.message.includes('cue late'))).toBe(true);
  });

  it('rejects unknown block type', () => {
    const reel = example();
    reel.cues[0].block = { type: 'video', src: 'x.mp4' };
    expect(Reel.safeParse(reel).success).toBe(false);
  });

  it('rejects voice speed outside 0.8–1.3', () => {
    const reel = example();
    reel.voice.speed = 1.5;
    expect(Reel.safeParse(reel).success).toBe(false);
  });
});

describe('ids are safe for file paths', () => {
  it.each(['../../x', 'a/b', 'a\\b', 'C:x', 'l 1', '.', '', 'x'.repeat(65)])(
    'rejects unsafe line id %j',
    (id) => {
      expect(Line.safeParse({ id, caption: 'a', spoken: 'अ' }).success).toBe(false);
    },
  );

  it('accepts letters, digits, _ and -', () => {
    expect(Line.safeParse({ id: 'l1_new-2', caption: 'a', spoken: 'अ' }).success).toBe(true);
  });

  it('rejects unsafe reel id and cue id', () => {
    const reel = example();
    reel.id = '..\\..\\Windows';
    expect(Reel.safeParse(reel).success).toBe(false);
    const reel2 = example();
    reel2.cues[0].id = '../c1';
    expect(Reel.safeParse(reel2).success).toBe(false);
  });

  it('rejects duplicate line ids', () => {
    const reel = example();
    reel.lines[1].id = reel.lines[0].id;
    const r = Reel.safeParse(reel);
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.message.includes(`duplicate line id ${reel.lines[0].id}`))).toBe(true);
  });

  it('rejects duplicate cue ids', () => {
    const reel = example();
    reel.cues[1].id = reel.cues[0].id;
    const r = Reel.safeParse(reel);
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.message.includes(`duplicate cue id ${reel.cues[0].id}`))).toBe(true);
  });
});

describe('defaults', () => {
  it('default brand and mascot are valid', () => {
    expect(Brand.parse(defaultBrand)).toEqual(defaultBrand);
    expect(MascotConfig.parse(defaultMascot)).toEqual(defaultMascot);
  });
});
