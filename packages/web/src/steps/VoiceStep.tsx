import { useEffect, useRef, useState } from 'react';
import type { Reel, VoiceSettings } from '@reelmaker/shared';
import { api, fileUrl, type ReelDetail } from '../api.ts';
import { JobBar } from '../components/JobBar.tsx';
import { useJobRunner } from '../useJobRunner.ts';

const VOICES: { id: VoiceSettings['voiceId']; label: string }[] = [
  { id: 'hf_alpha', label: 'Alpha (female, default)' },
  { id: 'hf_beta', label: 'Beta (female)' },
  { id: 'hm_omega', label: 'Omega (male)' },
  { id: 'hm_psi', label: 'Psi (male)' },
];
const MAX_SECONDS = 60;

export function VoiceStep({ detail, onChanged }: { detail: ReelDetail; onChanged: () => void }) {
  const { reel, status } = detail;
  const [voiceId, setVoiceId] = useState(reel.voice.voiceId);
  const [speed, setSpeed] = useState(reel.voice.speed);
  const [length, setLength] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const { job, running, run } = useJobRunner(onChanged);
  const hasVoice = status.voice !== 'none';
  const bust = reel.updatedAt;
  useEffect(() => {
    setVoiceId(reel.voice.voiceId);
    setSpeed(reel.voice.speed);
  }, [reel.voice.voiceId, reel.voice.speed]);

  /** Save changed voice settings first, so the job voices what is on screen. */
  async function withSettings(): Promise<Reel> {
    if (voiceId === reel.voice.voiceId && speed === reel.voice.speed) return reel;
    return api.saveReel({ ...reel, voice: { ...reel.voice, voiceId, speed } });
  }
  const generate = (only?: string[]) => run(async () => api.startVoice((await withSettings()).id, only));
  const upload = (file: File) => run(() => api.uploadVoice(reel.id, file));
  const play = (url: string) => {
    player.current?.pause();
    player.current = new Audio(url);
    void player.current.play();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="voice" className="label">
            Voice
          </label>
          <select id="voice" className="field w-56" value={voiceId} onChange={(e) => setVoiceId(e.target.value as VoiceSettings['voiceId'])}>
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-56">
          <label htmlFor="speed" className="label">
            Speed: {speed.toFixed(2)}×
          </label>
          <input
            id="speed"
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <button className="btn-primary" disabled={running || !reel.lines.length} onClick={() => generate()}>
          {hasVoice ? 'Regenerate all lines' : 'Generate voice'}
        </button>
      </div>
      <JobBar job={job} running="Making the voice" />

      {hasVoice ? (
        <div className="flex flex-col gap-2">
          <audio
            controls
            src={fileUrl(reel.id, 'vo.wav', bust)}
            onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
            className="w-full"
          />
          {length !== null ? (
            <p className={length > MAX_SECONDS ? 'font-semibold text-sindoor' : 'text-ink-soft'}>
              Voice is {length.toFixed(1)} s long.
              {length > MAX_SECONDS ? ` Reels can be at most ${MAX_SECONDS} s: shorten the script.` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {reel.voice.engine === 'kokoro' && hasVoice ? (
        <ol className="flex flex-col divide-y divide-ink-faint/60 rounded-md bg-paper">
          {reel.lines.map((l, i) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-sm text-ink-soft">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{l.caption}</span>
              <button className="btn-quiet px-2 py-1 text-sm" aria-label={`Play line ${i + 1}`} onClick={() => play(fileUrl(reel.id, `lines/${l.id}.wav`, bust))}>
                ▶ Play
              </button>
              <button
                className="btn-quiet px-2 py-1 text-sm"
                aria-label={`Regenerate line ${i + 1}`}
                disabled={running}
                onClick={() => generate([l.id])}
              >
                ↻ Redo
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="rounded-md border border-dashed border-ink-faint p-4">
        <label htmlFor="upload" className="font-semibold">
          Or use your own recording
        </label>
        <p className="mb-2 text-sm text-ink-soft">
          WAV, MP3 or M4A up to 50 MB. Read the spoken lines in order; captions are matched to it in the next step.
          {reel.voice.engine === 'upload' ? ' Your recording is in use now.' : ''}
        </p>
        <input
          id="upload"
          type="file"
          accept=".wav,.mp3,.m4a,audio/*"
          disabled={running}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
