import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api, type ReelDetail } from '../api.ts';
import { StepTrack } from '../components/StepTrack.tsx';
import { useJob } from '../useJob.ts';

// Minimal editor shell for Task 10 (shows the agent's progress after "Create reel").
// Task 11 replaces this with the full Script · Voice · Captions · Scenes · Review · Render stepper.
export function ReelEditor() {
  const { id = '' } = useParams();
  const location = useLocation();
  const jobId = (location.state as { jobId?: string } | null)?.jobId ?? null;
  const job = useJob(jobId);
  const [detail, setDetail] = useState<ReelDetail | null>(null);

  useEffect(() => {
    api.getReel(id).then(setDetail, () => setDetail(null));
  }, [id, job.status]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <h1 className="text-2xl font-bold">{detail?.reel.title ?? id}</h1>
        {detail ? <StepTrack status={detail.status} /> : null}
      </div>
      {job.status !== 'idle' ? (
        <section className="rounded-lg bg-paper p-4" aria-live="polite">
          <h2 className="mb-2 font-semibold">
            {job.status === 'running' ? 'Writing the script…' : job.status === 'done' ? 'Script ready' : 'The agent stopped'}
          </h2>
          {job.logs.map((l, i) => (
            <p key={i} className="whitespace-pre-wrap text-[15px]">
              {l}
            </p>
          ))}
          {job.error ? <p className="font-semibold text-sindoor">{job.error}</p> : null}
        </section>
      ) : null}
      {detail?.reel.lines.length ? (
        <ol className="flex flex-col gap-2">
          {detail.reel.lines.map((l) => (
            <li key={l.id} className="rounded-md bg-paper px-4 py-2">
              <div className="font-semibold">{l.caption}</div>
              <div className="text-ink-soft">{l.spoken}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
