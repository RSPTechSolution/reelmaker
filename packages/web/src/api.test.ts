import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api.ts';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('api throws ApiError with zod issues on 400', async () => {
    const issues = [{ path: ['lines', 0, 'spoken'], message: 'line l1: caption has 3 words, spoken has 2' }];
    mockFetch(400, { error: 'invalid data', issues });
    const err = await api.saveReel({ id: 'r1' } as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'invalid data', issues });
  });

  it('uses the server error message for other failures', async () => {
    mockFetch(409, { error: 'voice is stale' });
    await expect(api.startTiming('r1')).rejects.toMatchObject({ status: 409, message: 'voice is stale' });
  });

  it('sends JSON to the right route and returns the body', async () => {
    const fetch = mockFetch(200, { jobId: 'j1' });
    expect(await api.startAgent('r 1', 'review', 'number bada karo')).toEqual({ jobId: 'j1' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/reels/r%201/agent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ mode: 'review', instruction: 'number bada karo' });
  });

  it('uploads the voice recording as multipart', async () => {
    const fetch = mockFetch(200, { jobId: 'j2' });
    await api.uploadVoice('r1', new File(['x'], 'me.m4a'));
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBeInstanceOf(FormData);
  });
});
