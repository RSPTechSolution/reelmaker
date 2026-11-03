import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type ReelSummary } from '../api.ts';
import { StepTrack } from '../components/StepTrack.tsx';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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
    <form onSubmit={submit} className="rounded-lg bg-paper p-5">
      <label htmlFor="topic" className="mb-2 block text-xl font-bold">
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
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="hook" className="label">
            Opening line idea (optional)
          </label>
          <input id="hook" className="field" value={hook} onChange={(e) => setHook(e.target.value)} maxLength={300} />
        </div>
        <div className="w-32">
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
      {error ? <p className="mt-3 text-sm font-semibold text-sindoor">{error}</p> : null}
    </form>
  );
}

export function Library() {
  const [reels, setReels] = useState<ReelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.listReels().then(setReels, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <NewReel />
      <section>
        <h1 className="mb-3 text-lg font-bold">Your reels</h1>
        {error ? (
          <p className="text-sindoor">Could not load reels: {error}. Is the server running (npm run dev)?</p>
        ) : reels === null ? (
          <p className="text-ink-soft">Loading…</p>
        ) : reels.length === 0 ? (
          <p className="text-ink-soft">No reels yet. Type a topic above to make your first one.</p>
        ) : (
          <ul className="divide-y divide-ink-faint/60 border-y border-ink-faint/60">
            {reels.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/reels/${r.id}/script`}
                  className="flex items-center gap-6 px-2 py-4 hover:bg-paper"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[17px] font-semibold">{r.title}</div>
                    <div className="text-sm text-ink-soft">Edited {when(r.updatedAt)}</div>
                  </div>
                  <StepTrack status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
