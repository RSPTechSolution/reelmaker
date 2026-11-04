import type { PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { Brand, MascotConfig, Reel, ReelProps } from '@reelmaker/shared';
import { api, fileUrl, type ReelDetail, type ReelStatus } from '../api.ts';
import { AgentChat } from '../components/AgentChat.tsx';
import { Preview } from '../components/Preview.tsx';
import { StepTabs, type Mark } from '../components/StepTabs.tsx';
import { demoProps } from '../demo.ts';
import { CaptionsStep } from '../steps/CaptionsStep.tsx';
import { RenderStep } from '../steps/RenderStep.tsx';
import { ReviewStep } from '../steps/ReviewStep.tsx';
import { ScenesStep } from '../steps/ScenesStep.tsx';
import { ScriptStep } from '../steps/ScriptStep.tsx';
import { VoiceStep } from '../steps/VoiceStep.tsx';

type StepKey = 'script' | 'voice' | 'captions' | 'scenes' | 'review' | 'render';

const STEPS: { key: StepKey; label: string; mark: (s: ReelStatus, reel: Reel) => Mark }[] = [
  { key: 'script', label: 'Script', mark: (s) => (s.script ? 'done' : 'todo') },
  { key: 'voice', label: 'Voice', mark: (s) => (s.voice === 'ok' ? 'done' : s.voice === 'stale' ? 'stale' : 'todo') },
  { key: 'captions', label: 'Captions', mark: (s) => (s.timing === 'ok' ? 'done' : s.timing === 'stale' ? 'stale' : 'todo') },
  { key: 'scenes', label: 'Scenes', mark: (_, reel) => (reel.cues.length ? 'done' : 'todo') },
  { key: 'review', label: 'Review', mark: () => 'todo' },
  { key: 'render', label: 'Render', mark: (s) => (s.rendered ? 'done' : 'todo') },
];

function StaleBanner({ status }: { status: ReelStatus }) {
  if (status.voice === 'stale') {
    return (
      <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-4 py-2 text-sindoor">
        The script changed after the voice was made. Regenerate the voice, then sync the captions again.
      </p>
    );
  }
  if (status.timing === 'stale') {
    return (
      <p role="alert" className="rounded-md border border-sindoor/40 bg-sindoor/5 px-4 py-2 text-sindoor">
        The captions are out of date. Sync them again in the Captions step.
      </p>
    );
  }
  return null;
}

export function ReelEditor() {
  const { id = '', step = 'script' } = useParams();
  const location = useLocation();
  const initialJob = (location.state as { jobId?: string } | null)?.jobId ?? null;
  const [detail, setDetail] = useState<ReelDetail | null>(null);
  const [brand, setBrand] = useState<Brand>(demoProps.brand);
  const [mascot, setMascot] = useState<MascotConfig>(demoProps.mascot);
  const [loudness, setLoudness] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<PlayerRef>(null);

  const reload = useCallback(() => {
    api.getReel(id).then(
      (d) => {
        setDetail(d);
        setError(null);
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [id]);
  useEffect(reload, [reload]);
  useEffect(() => {
    api.getBrand().then(setBrand, () => {});
    api.getMascot().then(setMascot, () => {});
  }, []);
  // mouth movement for the preview: per-frame loudness written by the Captions step
  const timing = detail?.status.timing ?? 'none';
  const stamp = detail?.reel.updatedAt;
  useEffect(() => {
    if (timing === 'none') return setLoudness([]);
    fetch(fileUrl(id, 'loudness.json', stamp))
      .then((r) => (r.ok ? r.json() : []))
      .then(setLoudness, () => setLoudness([]));
  }, [id, timing, stamp]);

  const props = useMemo<ReelProps | null>(
    () =>
      detail
        ? {
            reel: detail.reel,
            words: detail.words ?? [],
            loudness,
            brand,
            mascot,
            audioSrc: detail.status.voice !== 'none' ? fileUrl(id, 'vo.wav', detail.reel.updatedAt) : null,
          }
        : null,
    [detail, loudness, brand, mascot, id],
  );

  if (error) return <p className="text-sindoor">Could not open this reel: {error}</p>;
  if (!detail || !props) return <p className="text-ink-soft">Loading…</p>;
  const { reel, status } = detail;

  let body;
  switch (step as StepKey) {
    case 'script':
      body = (
        <ScriptStep
          reel={reel}
          onSave={async (r) => {
            const saved = await api.saveReel(r);
            reload();
            return saved;
          }}
          agent={
            <AgentChat
              reelId={reel.id}
              mode="script"
              initialJobId={initialJob}
              placeholder={reel.lines.length ? 'e.g. hook aur punchy banao' : 'Optional: anything the script must say'}
              onDone={reload}
            />
          }
        />
      );
      break;
    case 'voice':
      body = <VoiceStep detail={detail} onChanged={reload} />;
      break;
    case 'captions':
      body = <CaptionsStep detail={detail} onChanged={reload} />;
      break;
    case 'scenes':
      body = <ScenesStep detail={detail} onChanged={reload} seek={(f) => player.current?.seekTo(f)} />;
      break;
    case 'review':
      body = <ReviewStep detail={detail} onChanged={reload} />;
      break;
    case 'render':
      body = <RenderStep detail={detail} onChanged={reload} player={player} />;
      break;
    default:
      body = <p className="text-ink-soft">This step does not exist.</p>;
  }

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex min-w-[520px] max-w-3xl flex-1 flex-col gap-5">
        <h1 className="text-2xl font-bold">{reel.title}</h1>
        <StepTabs reelId={reel.id} active={step} steps={STEPS.map((x) => ({ key: x.key, label: x.label, mark: x.mark(status, reel) }))} />
        <StaleBanner status={status} />
        <div key={step} className="step-enter">
          {body}
        </div>
      </div>
      <div className="sticky top-8">
        <Preview ref={player} props={props} />
      </div>
    </div>
  );
}
