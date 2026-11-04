import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { MascotConfig, Reel, ReelProps, WordTiming } from '@reelmaker/shared';
import { wordFrame } from '@reelmaker/shared';
import { HttpError } from './errors.ts';
import { reelDir, REPO_ROOT } from './paths.ts';
import { getBrand, getMascot, getReel } from './store.ts';

/** Must equal REEL_COMPOSITION_ID in packages/video/src/Reel.tsx (a test checks). Plain Node
 * cannot import the video package's .tsx, so the id is repeated here. */
export const REEL_COMPOSITION_ID = 'Reel';
export const SERVER_ORIGIN = 'http://127.0.0.1:4000';

const ENTRY = path.join(REPO_ROOT, 'packages', 'video', 'src', 'index.ts');
const CONTACT_COLS = 3;
const THUMB_W = 360;
const THUMB_H = 640;

let serveUrl: Promise<string> | null = null;
let browserReady: Promise<unknown> | null = null;

/** Webpack bundle of the video package, built once and cached; `rebundle` forces a fresh one. */
export function getServeUrl(opts: { rebundle?: boolean } = {}): Promise<string> {
  if (!serveUrl || opts.rebundle) {
    serveUrl = import('@remotion/bundler').then(({ bundle }) => bundle({ entryPoint: ENTRY }));
    serveUrl.catch(() => (serveUrl = null)); // retry next time instead of caching the failure
  }
  return serveUrl;
}

/** Downloads Chrome Headless Shell on first use. */
function ensureBrowserOnce() {
  if (!browserReady) {
    browserReady = import('@remotion/renderer').then(({ ensureBrowser }) => ensureBrowser());
    browserReady.catch(() => (browserReady = null));
  }
  return browserReady;
}

async function readJsonIf<T>(file: string, fallback: T): Promise<T> {
  return existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')) as T) : fallback;
}

/** The renderer's Chrome loads character images from our server, so it needs absolute URLs. */
function absoluteImages(mascot: MascotConfig): MascotConfig {
  if (!mascot.images) return mascot;
  const images = Object.fromEntries(
    Object.entries(mascot.images).map(([k, v]) => [k, v.startsWith('/') ? `${SERVER_ORIGIN}${v}` : v]),
  );
  return { ...mascot, images };
}

export async function buildProps(id: string): Promise<ReelProps> {
  const reel = await getReel(id);
  const dir = reelDir(id);
  const wordsFile = path.join(dir, 'words.json');
  if (!existsSync(wordsFile)) throw new HttpError(409, 'no captions yet — run Captions step first');
  return {
    reel,
    words: await readJsonIf<WordTiming[]>(wordsFile, []),
    loudness: await readJsonIf<number[]>(path.join(dir, 'loudness.json'), []),
    brand: await getBrand(),
    mascot: absoluteImages(await getMascot()),
    audioSrc: existsSync(path.join(dir, 'vo.wav')) ? `${SERVER_ORIGIN}/files/${id}/vo.wav` : null,
  };
}

/** Cover frame: reel.coverFrame, else 10 frames after the first cue (by word); inside the video. */
export function coverFrame(reel: Reel, words: WordTiming[], totalFrames: number): number {
  const first = [...reel.cues].sort((a, b) => a.atWord - b.atWord)[0];
  const frame = reel.coverFrame ?? (first ? wordFrame(words, first.atWord, 0) + 10 : 0);
  return Math.max(0, Math.min(totalFrames - 1, frame));
}

/** n evenly spaced frames from 0, skipping the last 10 frames (end card fade-out). */
export function contactFrames(total: number, n = 9): number[] {
  const last = Math.max(0, total - 11);
  return Array.from({ length: n }, (_, k) => Math.round((k * last) / Math.max(1, n - 1)));
}

/**
 * Run `fn`, retrying once if headless Chrome was too slow to start (Remotion gives it 25 s,
 * which a busy CPU-only PC can miss). Other errors are not retried.
 */
export async function retryBrowserStart<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!/trying to connect to the browser/i.test(String((err as Error)?.message ?? err))) throw err;
    return fn();
  }
}

async function composition(props: ReelProps) {
  await ensureBrowserOnce();
  const url = await getServeUrl();
  const { selectComposition } = await import('@remotion/renderer');
  const comp = await retryBrowserStart(() =>
    selectComposition({ serveUrl: url, id: REEL_COMPOSITION_ID, inputProps: props }),
  );
  return { url, comp };
}

/** Renders props to an H.264 MP4 at `out` (written via a temp file). Returns the frame count. */
export async function renderMp4(props: ReelProps, out: string, onProgress: (p: number) => void): Promise<number> {
  const { url, comp } = await composition(props);
  const { renderMedia } = await import('@remotion/renderer');
  await mkdir(path.dirname(out), { recursive: true });
  const tmp = `${out}.tmp.mp4`;
  try {
    await retryBrowserStart(() =>
      renderMedia({
        composition: comp,
        serveUrl: url,
        codec: 'h264',
        outputLocation: tmp,
        inputProps: props,
        onProgress: ({ progress }) => onProgress(Math.min(0.999, progress)),
      }),
    );
    await rename(tmp, out);
  } finally {
    await rm(tmp, { force: true });
  }
  onProgress(1);
  return comp.durationInFrames;
}

export async function renderReel(id: string, onProgress: (p: number, msg?: string) => void): Promise<string> {
  const props = await buildProps(id);
  const out = path.join(reelDir(id), 'out', 'reel.mp4');
  onProgress(0, 'preparing renderer');
  await renderMp4(props, out, (p) => onProgress(p, `rendering ${Math.round(p * 100)}%`));
  return out;
}

export async function renderCover(id: string): Promise<string> {
  const props = await buildProps(id);
  const { url, comp } = await composition(props);
  const { renderStill } = await import('@remotion/renderer');
  const out = path.join(reelDir(id), 'out', 'cover.png');
  await mkdir(path.dirname(out), { recursive: true });
  await retryBrowserStart(() =>
    renderStill({
      composition: comp,
      serveUrl: url,
      inputProps: props,
      frame: coverFrame(props.reel, props.words, comp.durationInFrames),
      output: out,
      imageFormat: 'png',
      overwrite: true,
    }),
  );
  return out;
}

/** 9 stills at 360×640 in a 3×3 grid → out/contact.png (1080×1920). */
export async function renderContactSheet(
  id: string,
  debugSafeZones: boolean,
  onProgress: (p: number, msg?: string) => void = () => {},
): Promise<string> {
  const props: ReelProps = { ...(await buildProps(id)), audioSrc: null, debugSafeZones };
  const { url, comp } = await composition(props);
  const { openBrowser, renderStill } = await import('@remotion/renderer');
  const sharp = (await import('sharp')).default;
  const frames = contactFrames(comp.durationInFrames);
  const browser = await retryBrowserStart(() => openBrowser('chrome'));
  try {
    const tiles: { input: Buffer; left: number; top: number }[] = [];
    for (const [k, frame] of frames.entries()) {
      onProgress(k / frames.length, `frame ${k + 1}/${frames.length}`);
      const { buffer } = await renderStill({
        composition: comp,
        serveUrl: url,
        inputProps: props,
        frame,
        scale: THUMB_W / comp.width,
        imageFormat: 'png',
        puppeteerInstance: browser,
      });
      tiles.push({ input: buffer!, left: (k % CONTACT_COLS) * THUMB_W, top: Math.floor(k / CONTACT_COLS) * THUMB_H });
    }
    const out = path.join(reelDir(id), 'out', 'contact.png');
    await mkdir(path.dirname(out), { recursive: true });
    await sharp({
      create: { width: THUMB_W * CONTACT_COLS, height: THUMB_H * 3, channels: 3, background: '#000000' },
    })
      .composite(tiles)
      .png()
      .toFile(`${out}.tmp.png`);
    await rename(`${out}.tmp.png`, out);
    onProgress(1, 'contact sheet ready');
    return out;
  } finally {
    await browser.close({ silent: true });
  }
}
