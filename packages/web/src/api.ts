import type { Brand, MascotConfig, Reel, WordTiming } from '@reelmaker/shared';

export type ReelStatus = {
  script: boolean;
  voice: 'none' | 'ok' | 'stale';
  timing: 'none' | 'ok' | 'stale';
  rendered: boolean;
};
export type ReelSummary = { id: string; title: string; updatedAt: string; status: ReelStatus };
export type TimingReport = { matched: number; filled: number; filledRanges: [number, number, number, number][] };
export type ReelDetail = { reel: Reel; status: ReelStatus; words?: WordTiming[]; report?: TimingReport };
export type Issue = { path: (string | number)[]; message: string };
export type JobRef = { jobId: string };
export type AgentMode = 'script' | 'scenes' | 'review';

export class ApiError extends Error {
  status: number;
  issues?: Issue[];
  constructor(status: number, message: string, issues?: Issue[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const res = await fetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText, data?.issues);
  return data as T;
}

const reel = (id: string) => `/api/reels/${encodeURIComponent(id)}`;

export const api = {
  listReels: () => request<ReelSummary[]>('GET', '/api/reels'),
  createReel: (input: { topic: string; hook?: string; targetSeconds?: number }) =>
    request<Reel>('POST', '/api/reels', input),
  getReel: (id: string) => request<ReelDetail>('GET', reel(id)),
  saveReel: (r: Reel) => request<Reel>('PUT', reel(r.id), r),

  getBrand: () => request<Brand>('GET', '/api/brand'),
  saveBrand: (b: Brand) => request<Brand>('PUT', '/api/brand', b),
  getMascot: () => request<MascotConfig>('GET', '/api/mascot'),
  saveMascot: (m: MascotConfig) => request<MascotConfig>('PUT', '/api/mascot', m),

  startVoice: (id: string, only?: string[]) => request<JobRef>('POST', `${reel(id)}/voice`, only ? { only } : {}),
  uploadVoice: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<JobRef>('POST', `${reel(id)}/voice/upload`, form);
  },
  startTiming: (id: string) => request<JobRef>('POST', `${reel(id)}/timing`, {}),
  startContactSheet: (id: string, debugSafeZones: boolean) =>
    request<JobRef>('POST', `${reel(id)}/contact-sheet`, { debugSafeZones }),
  startRender: (id: string) => request<JobRef>('POST', `${reel(id)}/render`, {}),
  startAgent: (id: string, mode: AgentMode, instruction?: string) =>
    request<JobRef>('POST', `${reel(id)}/agent`, instruction ? { mode, instruction } : { mode }),
};

/** URL of a generated file; `bust` defeats the browser cache after regeneration. */
export const fileUrl = (id: string, name: string, bust?: string | number) =>
  `/files/${encodeURIComponent(id)}/${name}${bust !== undefined ? `?t=${bust}` : ''}`;
