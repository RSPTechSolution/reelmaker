import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Brand, MascotConfig } from '@reelmaker/shared';
import { api, ApiError, type ReelSummary } from '../api.ts';
import { HowItWorks } from '../components/HowItWorks.tsx';
import { ReelCard } from '../components/ReelCard.tsx';
import { Showcase } from '../components/Showcase.tsx';
import { demoProps } from '../demo.ts';
import { Reveal } from '../motion.tsx';

const HEADLINE = 'Topic do. Reel lo.';

function Headline() {
  return (
    <h1 aria-label={HEADLINE} className="text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
      {HEADLINE.split(' ').map((w, i) => (
        <span key={i} aria-hidden className="hero-word mr-[0.25em]" style={{ '--i': i } as React.CSSProperties}>
          {w}
        </span>
      ))}
    </h1>
  );
}

function NewReel() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [hook, setHook] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const reel = await api.createReel({ topic, hook: hook || undefined, targetSeconds: seconds });
      const { jobId } = await api.startAgent(reel.id, 'script');
      navigate(`/reels/${reel.id}/script`, { state: { jobId } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg bg-paper p-5">
      <label htmlFor="topic" className="font-semibold">
        What is the next reel about?
      </label>
      <input
        id="topic"
        className="field text-lg"
        placeholder="AI se video kaise banaye — 3 tips"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        required
        maxLength={200}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="hook" className="label">
            Opening line idea (optional)
          </label>
          <input id="hook" className="field" value={hook} onChange={(e) => setHook(e.target.value)} maxLength={300} />
        </div>
        <div className="w-28">
          <label htmlFor="seconds" className="label">
            Length (s)
          </label>
          <input
            id="seconds"
            type="number"
            min={20}
            max={60}
            className="field"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary" disabled={busy || !topic.trim()}>
          {busy ? 'Creating…' : 'Create reel and write script'}
        </button>
      </div>
      {error ? <p className="text-sm font-semibold text-sindoor">{error}</p> : null}
    </form>
  );
}

export function Library() {
  const [reels, setReels] = useState<ReelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand>(demoProps.brand);
  const [mascot, setMascot] = useState<MascotConfig>(demoProps.mascot);
  useEffect(() => {
    api.listReels().then(setReels, (e) => setError(e instanceof Error ? e.message : String(e)));
    api.getBrand().then(setBrand, () => {});
    api.getMascot().then(setMascot, () => {});
  }, []);
  const hasReels = !!reels?.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-14">
      <section className="flex flex-wrap items-center justify-between gap-10">
        <div className="flex min-w-[360px] max-w-xl flex-1 flex-col gap-6">
          <Headline />
          <p className="text-lg text-ink-soft">
            Type a topic. The agent writes a Hinglish script, the voice reads it, captions land on every word and scenes
            animate on cue: a 1080×1920 reel, made on this PC.
          </p>
          <NewReel />
        </div>
        <Showcase brand={brand} mascot={mascot} />
      </section>

      <HowItWorks collapsed={hasReels} />

      <section aria-labelledby="yours" className="flex flex-col gap-4">
        <h2 id="yours" className="text-lg font-bold">
          Your reels
        </h2>
        {error ? (
          <p className="text-sindoor">Could not load reels: {error}. Is the server running (npm run dev)?</p>
        ) : reels === null ? (
          <p className="text-ink-soft">Loading…</p>
        ) : !hasReels ? (
          <p className="text-ink-soft">No reels yet. Type a topic above to make your first one.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {reels.map((r, i) => (
              <li key={r.id}>
                <Reveal index={Math.min(i, 6)}>
                  <ReelCard reel={r} brand={brand} mascot={mascot} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
