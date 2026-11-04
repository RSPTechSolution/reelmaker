import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type AgentMode } from '../api.ts';
import { useJob } from '../useJob.ts';

/** Ask the agent (Claude Code) to change the reel; its replies stream in. */
export function AgentChat({
  reelId,
  mode,
  placeholder,
  initialJobId = null,
  requireInstruction = false,
  onDone,
}: {
  reelId: string;
  mode: AgentMode;
  placeholder: string;
  initialJobId?: string | null;
  requireInstruction?: boolean;
  onDone: () => void;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const job = useJob(jobId);
  const running = job.status === 'running';
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if ((job.status === 'done' || job.status === 'error') && notified.current !== jobId) {
      notified.current = jobId;
      onDone();
    }
  }, [job.status, jobId, onDone]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { jobId: id } = await api.startAgent(reelId, mode, text.trim() || undefined);
      setJobId(id);
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-paper p-4" aria-label="Agent">
      {job.status !== 'idle' ? (
        <div aria-live="polite" className="flex flex-col gap-1.5 text-[15px]">
          {job.logs.map((l, i) => (
            <p key={i} className="msg-in whitespace-pre-wrap">
              {l}
            </p>
          ))}
          {running ? (
            <p className="flex items-center gap-2 text-ink-soft">
              <span className="flex gap-1" aria-hidden>
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-soft" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-soft" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-soft" />
              </span>
              Agent is working…
            </p>
          ) : null}
          {job.status === 'error' ? <p className="font-semibold text-sindoor">{job.error}</p> : null}
        </div>
      ) : null}
      <form onSubmit={send} className="flex gap-2">
        <input
          className="field"
          aria-label="Message to the agent"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          maxLength={2000}
        />
        <button className="btn-quiet shrink-0" disabled={running || (requireInstruction && !text.trim())}>
          Ask agent
        </button>
      </form>
      {error ? <p className="text-sm font-semibold text-sindoor">{error}</p> : null}
    </section>
  );
}
