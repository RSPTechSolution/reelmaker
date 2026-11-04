import { useEffect, useRef, useState } from 'react';
import { audioSettings, effectSettings, type AudioSettings, type EffectSettings, type Reel } from '@reelmaker/shared';

export type MusicTrack = { file: string; label: string; kind: 'builtin' | 'upload' };
export type AudioLibrary = { sfx: string[]; music: MusicTrack[] };

const DEFAULT_MUSIC_VOLUME = 0.25;
const TRANSITIONS: { value: EffectSettings['transition']; label: string }[] = [
  { value: 'slide', label: 'Slide' },
  { value: 'whip', label: 'Whip pan' },
  { value: 'zoom', label: 'Zoom through' },
  { value: 'none', label: 'Cut (none)' },
];
const CAPTIONS: { value: EffectSettings['captions']; label: string }[] = [
  { value: 'pop', label: 'Pop the spoken word' },
  { value: 'bounce', label: 'Bounce the spoken word' },
  { value: 'color', label: 'Colour only' },
];

/** Volume slider that saves when released, not on every movement. */
function Volume({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex w-44 flex-col gap-1 text-xs text-ink-soft">
      {label}: {Math.round(v * 100)}%
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        aria-label={label}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => onCommit(v)}
        onKeyUp={() => onCommit(v)}
      />
    </label>
  );
}

/** Background music, sound effects and animation effects for one reel. Every change saves the reel. */
export function SoundPanel({
  reel,
  library,
  libraryError = null,
  onRetry = () => {},
  onSave,
  onUpload,
  onDelete,
}: {
  reel: Reel;
  /** null while the music list is loading */
  library: AudioLibrary | null;
  libraryError?: string | null;
  onRetry?: () => void;
  onSave: (reel: Reel) => Promise<unknown> | void;
  onUpload: (file: File) => void;
  onDelete: (file: string) => void;
}) {
  // Latest settings, updated on every change before the parent reloads the reel, so quick
  // successive changes build on each other instead of overwriting the previous one.
  const latest = useRef(reel);
  const [, rerender] = useState(0);
  useEffect(() => {
    latest.current = reel;
    rerender((n) => n + 1);
  }, [reel]);
  const current = latest.current;
  const audio = audioSettings(current);
  const fx = effectSettings(current);
  const save = (next: Reel) => {
    latest.current = next;
    rerender((n) => n + 1);
    return onSave(next);
  };
  const listen = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => listen.current?.pause(), []);

  const saveAudio = (next: AudioSettings) => save({ ...latest.current, audio: next });
  const saveFx = (patch: Partial<EffectSettings>) =>
    save({ ...latest.current, effects: { ...effectSettings(latest.current), ...patch } });
  const setTrack = (file: string) => {
    const { music: _old, ...rest } = audioSettings(latest.current);
    saveAudio(file ? { ...rest, music: { track: file, volume: audio.music?.volume ?? DEFAULT_MUSIC_VOLUME } } : rest);
  };
  const preview = (file: string) => {
    listen.current?.pause();
    if (playing === file) return setPlaying(null);
    listen.current = new Audio(`/audio/music/${file}`);
    listen.current.volume = 0.6;
    listen.current.onended = () => setPlaying(null);
    void listen.current.play();
    setPlaying(file);
  };
  const track = audio.music?.track ?? '';
  const selected = library?.music.find((m) => m.file === track);

  return (
    <section aria-labelledby="sound" className="flex flex-col gap-4 rounded-lg bg-paper p-4">
      <h2 id="sound" className="font-semibold">
        Music &amp; effects
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-60 flex-col gap-1 text-xs text-ink-soft">
          Background music
          <select
            className="field py-1.5 text-sm"
            aria-label="Background music"
            value={library ? track : ''}
            disabled={!library}
            onChange={(e) => setTrack(e.target.value)}
          >
            {library ? (
              <>
                <option value="">None</option>
                {library.music.map((m) => (
                  <option key={m.file} value={m.file}>
                    {m.kind === 'builtin' ? `${m.label} (built in)` : m.label}
                  </option>
                ))}
              </>
            ) : (
              <option value="">Loading tracks…</option>
            )}
          </select>
        </label>
        {track ? (
          <button className="btn-quiet px-3 py-1.5 text-sm" onClick={() => preview(track)}>
            {playing === track ? '■ Stop' : '▶ Listen'}
          </button>
        ) : null}
        {audio.music ? (
          <Volume label="Music volume" value={audio.music.volume} onCommit={(v) => saveAudio({ ...audio, music: { ...audio.music!, volume: v } })} />
        ) : null}
        <label className="btn-quiet cursor-pointer px-3 py-1.5 text-sm">
          Upload a track
          <input
            type="file"
            accept=".mp3,.wav,.m4a,audio/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
        {selected?.kind === 'upload' ? (
          <button className="text-sm text-ink-soft underline" onClick={() => onDelete(selected.file)}>
            Delete this track
          </button>
        ) : null}
      </div>
      {libraryError ? (
        <p role="alert" className="flex items-center gap-3 text-sm font-semibold text-sindoor">
          Could not load the music list: {libraryError}
          <button className="btn-quiet px-2 py-1 text-xs" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : null}
      <p className="text-xs text-ink-soft">
        The music dips while the voice speaks. Upload only music you have the rights to: Instagram may mute reels with
        unlicensed tracks.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" aria-label="Sound effects" checked={audio.sfx} onChange={(e) => saveAudio({ ...audio, sfx: e.target.checked })} />
          Sound effects (whoosh, pop, ding, boom)
        </label>
        {audio.sfx ? <Volume label="Effects volume" value={audio.sfxVolume} onCommit={(v) => saveAudio({ ...audio, sfxVolume: v })} /> : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-44 flex-col gap-1 text-xs text-ink-soft">
          Scene transition
          <select
            className="field py-1.5 text-sm"
            aria-label="Scene transition"
            value={fx.transition}
            onChange={(e) => saveFx({ transition: e.target.value as EffectSettings['transition'] })}
          >
            {TRANSITIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-56 flex-col gap-1 text-xs text-ink-soft">
          Caption style
          <select
            className="field py-1.5 text-sm"
            aria-label="Caption style"
            value={fx.captions}
            onChange={(e) => saveFx({ captions: e.target.value as EffectSettings['captions'] })}
          >
            {CAPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" aria-label="Emotion effects" checked={fx.emotion} onChange={(e) => saveFx({ emotion: e.target.checked })} />
          Emotion effects (shake, confetti, zoom on keywords)
        </label>
      </div>
    </section>
  );
}
