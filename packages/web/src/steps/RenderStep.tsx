import type { PlayerRef } from '@remotion/player';
import { useCallback, useState, type RefObject } from 'react';
import { api, ApiError, fileUrl, type ReelDetail } from '../api.ts';
import { JobBar } from '../components/JobBar.tsx';
import { useJobRunner } from '../useJobRunner.ts';

const FPS = 30;

/** Pick the cover frame, render the MP4 + cover, then watch and download them. */
export function RenderStep({
  detail,
  onChanged,
  player,
}: {
  detail: ReelDetail;
  onChanged: () => void;
  player: RefObject<PlayerRef | null>;
}) {
  const { reel, status } = detail;
  const [stamp, setStamp] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const ready = status.timing === 'ok';

  const { job, running, run } = useJobRunner(
    useCallback(() => {
      setStamp(Date.now());
      onChanged();
    }, [onChanged]),
  );

  async function setCover(frame: number | undefined) {
    setError(null);
    try {
      const { coverFrame: _old, ...rest } = reel;
      await api.saveReel(frame === undefined ? rest : { ...rest, coverFrame: frame });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  const done = status.rendered && job.status !== 'running';
  const mp4 = fileUrl(reel.id, 'out/reel.mp4', stamp);
  const cover = fileUrl(reel.id, 'out/cover.png', stamp);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Cover</h2>
        <p className="text-sm text-ink-soft">
          {reel.coverFrame !== undefined
            ? `Cover is frame ${reel.coverFrame} (${(reel.coverFrame / FPS).toFixed(1)} s).`
            : 'Cover is the first title, just after it appears.'}{' '}
          Pause the preview where you want it and use that frame.
        </p>
        <div className="flex gap-2">
          <button className="btn-quiet" onClick={() => setCover(player.current?.getCurrentFrame())}>
            Use the preview's current frame
          </button>
          {reel.coverFrame !== undefined ? (
            <button className="btn-quiet" onClick={() => setCover(undefined)}>
              Back to default
            </button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-primary" disabled={!ready || running} onClick={() => run(() => api.startRender(reel.id))}>
            {status.rendered ? 'Render again' : 'Render MP4'}
          </button>
          <p className="text-sm text-ink-soft">
            {ready
              ? '1080×1920, 30 fps. The first render also prepares the renderer, so it takes longer.'
              : status.timing === 'stale'
                ? 'The captions are out of date. Sync them again before rendering.'
                : 'Sync the captions before rendering.'}
          </p>
        </div>
        <JobBar job={job} running="Rendering the reel" done="Reel rendered" />
        {error ? <p className="text-sm font-semibold text-sindoor">{error}</p> : null}
      </section>

      {done ? (
        <section className="flex flex-wrap items-start gap-6">
          <video key={stamp} src={mp4} controls className="w-[270px] rounded-md bg-ink" />
          <div className="flex flex-col gap-3">
            <img key={stamp} src={cover} alt="Cover image" className="w-[135px] rounded-md border border-ink-faint" />
            <a className="btn-primary" href={mp4} download={`${reel.id}.mp4`}>
              Download MP4
            </a>
            <a className="btn-quiet" href={cover} download={`${reel.id}-cover.png`}>
              Download cover
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
