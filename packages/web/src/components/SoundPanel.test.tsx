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
  sfx: ['whoosh', 'pop', 'ding', 'boom', 'riser'],
  music: [
    { file: 'builtin-lofi.wav', label: 'Lo-fi chill', kind: 'builtin' as const },
    { file: 'upload-my-song-1a2b3c4d.mp3', label: 'My song', kind: 'upload' as const },
  ],
};
afterEach(cleanup);

function setup(reel = example()) {
  const onSave = vi.fn(async (r: Reel) => r);
  render(<SoundPanel reel={reel} library={library} onSave={onSave} onUpload={vi.fn()} onDelete={vi.fn()} />);
  return onSave;
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
});
