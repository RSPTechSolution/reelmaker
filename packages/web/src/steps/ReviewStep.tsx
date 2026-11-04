import { useCallback, useState } from 'react';
import { api, fileUrl, type ReelDetail } from '../api.ts';
import { AgentChat } from '../components/AgentChat.tsx';
import { JobBar } from '../components/JobBar.tsx';
import { useJobRunner } from '../useJobRunner.ts';

/** Contact sheet (9 frames) to check the whole reel at a glance; ask the agent for fixes. */
export function ReviewStep({ detail, onChanged }: { detail: ReelDetail; onChanged: () => void }) {
  const { reel, status } = detail;
  const [safeZones, setSafeZones] = useState(true);
  const [stamp, setStamp] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const ready = status.timing === 'ok';

  const { job, running, run } = useJobRunner(
    useCallback(() => {
      setStamp(Date.now());
      setMissing(false);
    }, []),
  );
  const makeSheet = useCallback(() => run(() => api.startContactSheet(reel.id, safeZones)), [run, reel.id, safeZones]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary" disabled={!ready || running} onClick={makeSheet}>
          Make contact sheet
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={safeZones} onChange={(e) => setSafeZones(e.target.checked)} />
          Show safe zones
        </label>
        {!ready ? (
          <p className="text-sm text-ink-soft">Sync the captions first: the review needs the timed reel.</p>
        ) : null}
      </div>
      <JobBar job={job} running="Rendering 9 frames" />

      {!missing ? (
        <img
          key={stamp ?? 'existing'}
          src={fileUrl(reel.id, 'out/contact.png', stamp ?? reel.updatedAt)}
          alt="Nine frames from across the reel, left to right and top to bottom"
          className="w-full max-w-[540px] rounded-md border border-ink-faint"
          onError={() => setMissing(true)}
        />
      ) : stamp === null ? (
        <p className="text-ink-soft">No contact sheet yet. Make one to see nine moments of the reel side by side.</p>
      ) : null}

      <AgentChat
        reelId={reel.id}
        mode="review"
        requireInstruction
        placeholder="e.g. number aur bada karo, card ka text chhota karo"
        onDone={() => {
          onChanged();
          // show the agent's change straight away
          if (ready) void makeSheet();
        }}
      />
    </div>
  );
}
