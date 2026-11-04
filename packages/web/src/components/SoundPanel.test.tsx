// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Reel } from '@reelmaker/shared';
import { SoundPanel } from './SoundPanel.tsx';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = (): Reel =>
  JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'shared', 'fixtures', 'example-reel.json'), 'utf8'));
const library = {
  sfx: ['swipe', 'tick', 'bubble', 'ding', 'boom', 'riser'],
  music: [
    { file: 'builtin-lofi.wav', label: 'Lo-fi chill', kind: 'builtin' as const },
    { file: 'upload-my-song-1a2b3c4d.mp3', label: 'My song', kind: 'upload' as const },
  ],
};
afterEach(cleanup);

function setup(reel = example(), lib: typeof library | null = library, libraryError: string | null = null) {
  const onSave = vi.fn(async (r: Reel) => r);
  const onRetry = vi.fn();
  render(
    <SoundPanel
      reel={reel}
      library={lib}
      libraryError={libraryError}
      onRetry={onRetry}
      onSave={onSave}
      onUpload={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return Object.assign(onSave, { onRetry });
}

describe('SoundPanel', () => {
  it('shows the defaults when the reel has no settings', () => {
    setup();
    expect((screen.getByLabelText('Background music') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Sound effects') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Scene transition') as HTMLSelectElement).value).toBe('slide');
    expect((screen.getByLabelText('Caption style') as HTMLSelectElement).value).toBe('pop');
  });

  it('picking a track saves it with a default volume, and None removes it', () => {
    const onSave = setup();
    fireEvent.change(screen.getByLabelText('Background music'), { target: { value: 'builtin-lofi.wav' } });
    expect(onSave.mock.calls[0][0].audio).toEqual({ sfx: true, sfxVolume: 0.6, music: { track: 'builtin-lofi.wav', volume: 0.25 } });
    cleanup();
    const again = setup({ ...example(), audio: { sfx: true, sfxVolume: 0.6, music: { track: 'builtin-lofi.wav', volume: 0.3 } } });
    fireEvent.change(screen.getByLabelText('Background music'), { target: { value: '' } });
    expect(again.mock.calls[0][0].audio).toEqual({ sfx: true, sfxVolume: 0.6 });
  });

  it('saves effect choices', () => {
    const onSave = setup();
    fireEvent.change(screen.getByLabelText('Scene transition'), { target: { value: 'whip' } });
    expect(onSave.mock.calls[0][0].effects).toEqual({ transition: 'whip', captions: 'pop', emotion: true });
    fireEvent.click(screen.getByLabelText('Emotion effects'));
    expect(onSave.mock.calls[1][0].effects!.emotion).toBe(false);
    fireEvent.click(screen.getByLabelText('Sound effects'));
    expect(onSave.mock.calls[2][0].audio!.sfx).toBe(false);
  });

  it('says the tracks are loading instead of silently offering only None', () => {
    setup(example(), null);
    const select = screen.getByLabelText('Background music') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect([...select.options].map((o) => o.text)).toEqual(['Loading tracks…']);
  });

  it('shows a load failure inside the panel with a retry', () => {
    const onSave = setup(example(), null, 'audio worker stopped');
    expect(screen.getByRole('alert').textContent).toContain('Could not load the music list: audio worker stopped');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onSave.onRetry).toHaveBeenCalled();
  });

  it('quick successive changes keep each other (no stale overwrite before the reel reloads)', () => {
    const onSave = setup();
    fireEvent.change(screen.getByLabelText('Background music'), { target: { value: 'builtin-lofi.wav' } });
    fireEvent.change(screen.getByLabelText('Scene transition'), { target: { value: 'zoom' } });
    const second = onSave.mock.calls[1][0];
    expect(second.audio!.music).toEqual({ track: 'builtin-lofi.wav', volume: 0.25 });
    expect(second.effects!.transition).toBe('zoom');
  });
});
