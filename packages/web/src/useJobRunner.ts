import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type JobRef } from './api.ts';
import { useJob } from './useJob.ts';

/** Start a job, follow it, and call onFinish once when it ends (done or error). */
export function useJobRunner(onFinish: () => void) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const job = useJob(jobId);
  const finished = useRef<string | null>(null);

  useEffect(() => {
    if ((job.status === 'done' || job.status === 'error') && finished.current !== jobId) {
      finished.current = jobId;
      onFinish();
    }
  }, [job.status, jobId, onFinish]);

  const run = useCallback(async (start: () => Promise<JobRef>) => {
    setStartError(null);
    try {
      setJobId((await start()).jobId);
    } catch (e) {
      setStartError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  const shown = startError ? { ...job, status: 'error' as const, error: startError } : job;
  return { job: shown, running: job.status === 'running', run };
}
