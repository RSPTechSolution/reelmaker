import { useRef, useState } from 'react';
import type { WordTiming } from '@reelmaker/shared';
import { api, ApiError, fileUrl, type ReelDetail } from '../api.ts';
import { JobBar } from '../components/JobBar.tsx';
import { useJobRunner } from '../useJobRunner.ts';

const WARN_BELOW = 0.7;
const norm = (w: string) => w.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '');

export function CaptionsStep({ detail, onChanged }: { detail: ReelDetail; onChanged: () => void }) {
  const { reel, status, words = [], report } = detail;
  const { job, running, run } = useJobRunner(onChanged);
  const [saveError, setSaveError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef<number | null>(null);

  const total = report ? report.matched + report.filled : 0;
  const rate = total ? report!.matched / total : 1;
  const keys = new Set(reel.keywords.map(norm));
  const canSync = status.voice !== 'none' && status.voice !== 'stale';

  function playWord(w: WordTiming) {
    const el = audio.current;
    if (!el) return;
    el.currentTime = w.start;
    void el.play();
    if (stopAt.current) window.clearTimeout(stopAt.current);
    stopAt.current = window.setTimeout(() => el.pause(), (w.end - w.start + 0.35) * 1000);
  }

  async function toggleKeyword(w: WordTiming) {
    const k = norm(w.caption);
    const keywords = keys.has(k) ? reel.keywords.filter((x) => norm(x) !== k) : [...reel.keywords, w.caption.replace(/[\p{P}\p{S}]/gu, '')];
    setSaveError(null);
    try {
      await api.saveReel({ ...reel, keywords });
      onChanged();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary" disabled={running || !canSync} onClick={() => run(() => api.startTiming(reel.id))}>
          {status.timing === 'none' ? 'Sync captions' : 'Sync captions again'}
        </button>
        <p className="text-sm text-ink-soft">
          {status.voice === 'none'
            ? 'Make the voice first.'
            : status.voice === 'stale'
              ? 'The voice is out of date. Regenerate it in the Voice step first.'
              : 'Matches each caption word to the exact moment it is spoken (about half a minute).'}
        </p>
      </div>
      <JobBar job={job} running="Listening to the voice" />

      {report && status.timing !== 'none' ? (
        <div
          className={`rounded-md px-4 py-3 ${rate < WARN_BELOW ? 'border border-sindoor/50 bg-sindoor/5' : 'bg-paper'}`}
          role={rate < WARN_BELOW ? 'alert' : undefined}
        >
          <p className={rate < WARN_BELOW ? 'font-semibold text-sindoor' : ''}>
            {Math.round(rate * 100)}% of words were heard clearly; {Math.round((1 - rate) * 100)}% were placed by estimate.
          </p>
          {rate < WARN_BELOW ? (
            <p className="mt-1 text-sm text-sindoor">
              Many words could not be matched. Check the underlined words below, or regenerate the voice more slowly.
            </p>
          ) : null}
        </div>
      ) : null}

      {words.length ? (
        <>
          <audio ref={audio} src={fileUrl(reel.id, 'vo.wav', reel.updatedAt)} preload="auto" />
          <p className="text-sm text-ink-soft">
            Click a word to hear it. ★ marks a keyword (shown in the accent colour); click ★ to change it. Dotted
            underline: time placed by estimate.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {words.map((w) => {
              const key = keys.has(norm(w.caption));
              return (
                <li key={w.i} className="flex items-stretch overflow-hidden rounded-md border border-ink-faint bg-paper">
                  <button
                    className={`px-2 py-1 text-[15px] hover:bg-chalk ${w.filled ? 'underline decoration-sindoor decoration-dotted decoration-2 underline-offset-4' : ''} ${key ? 'font-semibold text-nila' : ''}`}
                    title={`${w.start.toFixed(2)}–${w.end.toFixed(2)} s${w.filled ? ' (estimated)' : ''}`}
                    onClick={() => playWord(w)}
                  >
                    {w.caption}
                  </button>
                  <button
                    className={`border-l border-ink-faint px-1.5 text-sm ${key ? 'text-marigold-deep' : 'text-ink-faint hover:text-ink-soft'}`}
                    aria-label={`${key ? 'Unmark' : 'Mark'} "${w.caption}" as keyword`}
                    aria-pressed={key}
                    onClick={() => toggleKeyword(w)}
                  >
                    ★
                  </button>
                </li>
              );
            })}
          </ul>
          {saveError ? <p className="text-sm font-semibold text-sindoor">{saveError}</p> : null}
        </>
      ) : null}
    </div>
  );
}
