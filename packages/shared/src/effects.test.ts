import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AudioFile, Cue, Reel } from './schema.ts';
import { audioSettings, effectSettings } from './effects.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = () => JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'example-reel.json'), 'utf8'));

describe('effects schema', () => {
  it('cues accept an entrance style', () => {
    expect(Cue.safeParse({ id: 'c1', atWord: 0, anim: 'typewriter', block: { type: 'title', text: 'x' } }).success).toBe(true);
    expect(Cue.safeParse({ id: 'c1', atWord: 0, anim: 'spin', block: { type: 'title', text: 'x' } }).success).toBe(false);
  });

  it('reels accept audio and effect settings', () => {
    const r = {
      ...example(),
      audio: { sfx: true, sfxVolume: 0.5, music: { track: 'builtin-lofi.wav', volume: 0.3 } },
      effects: { transition: 'whip', captions: 'bounce', emotion: false },
    };
    expect(Reel.safeParse(r).success).toBe(true);
    expect(Reel.safeParse({ ...r, audio: { ...r.audio, sfxVolume: 2 } }).success).toBe(false);
    expect(Reel.safeParse({ ...r, effects: { ...r.effects, transition: 'spin' } }).success).toBe(false);
  });

  it('music tracks are only our own file names', () => {
    for (const ok of ['builtin-lofi.wav', 'upload-my-song-1a2b3c4d.mp3', 'upload-x.m4a']) expect(AudioFile.safeParse(ok).success, ok).toBe(true);
    for (const bad of ['../x.mp3', 'upload-x.exe', 'https://evil.example/a.mp3', 'BUILTIN-x.wav', 'x.mp3']) expect(AudioFile.safeParse(bad).success, bad).toBe(false);
  });

  it('missing settings fall back to the defaults', () => {
    expect(audioSettings(example())).toEqual({ sfx: true, sfxVolume: 0.6 });
    expect(effectSettings(example())).toEqual({ transition: 'slide', captions: 'pop', emotion: true });
    expect(effectSettings({ ...example(), effects: { transition: 'none', captions: 'color', emotion: false } })).toEqual({
      transition: 'none',
      captions: 'color',
      emotion: false,
    });
  });
});

describe('built-in sound version', () => {
  it('matches the Python generator, so the server knows when to regenerate', async () => {
    const { AUDIO_ASSETS_VERSION } = await import('./effects.ts');
    const py = readFileSync(path.join(here, '..', '..', '..', 'py', 'ops', 'assets.py'), 'utf8');
    expect(py).toContain(`ASSETS_VERSION = ${AUDIO_ASSETS_VERSION}`);
  });
});
