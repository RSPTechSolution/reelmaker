import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runAgent, type SpawnFn } from '../agent/run.ts';
import { startJob } from '../jobs.ts';
import { getReel } from '../store.ts';

const AgentBody = z
  .object({
    mode: z.enum(['script', 'scenes', 'review']),
    instruction: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.mode !== 'review' || !!b.instruction, { message: 'review needs an instruction' });

type IdParams = { Params: { id: string } };

/** POST /api/reels/:id/agent → job; the agent's text arrives as SSE `log` events. */
export function agentRoutes(deps: { spawnFn?: SpawnFn } = {}) {
  return async (app: FastifyInstance) => {
    app.post<IdParams>('/api/reels/:id/agent', async (req) => {
      const reel = await getReel(req.params.id);
      const { mode, instruction } = AgentBody.parse(req.body ?? {});
      const job = startJob(`agent-${mode}`, reel.id, async (ctx) => {
        ctx.progress(0, 'agent working');
        const result = await runAgent({
          reelId: reel.id,
          mode,
          instruction,
          onText: (t) => ctx.log(t),
          spawnFn: deps.spawnFn,
        });
        if (!result.ok) throw new Error(result.error);
        return { ok: true };
      });
      return { jobId: job.id };
    });
  };
}
