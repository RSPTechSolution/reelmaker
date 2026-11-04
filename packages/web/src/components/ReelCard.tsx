import { Link } from 'react-router-dom';
import type { Brand, MascotConfig } from '@reelmaker/shared';
import { Mascot } from '@reelmaker/video';
import { fileUrl, type ReelSummary } from '../api.ts';
import { StepTrack } from './StepTrack.tsx';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One reel in the library: its cover (or the mascot until it is rendered), title and progress. */
export function ReelCard({ reel, brand, mascot }: { reel: ReelSummary; brand: Brand; mascot: MascotConfig }) {
  return (
    <Link to={`/reels/${reel.id}/script`} className="lift flex gap-4 rounded-lg bg-paper p-3">
      <div
        className="flex h-[128px] w-[72px] shrink-0 items-end justify-center overflow-hidden rounded-md"
        style={{ background: brand.bg }}
      >
        {reel.status.rendered ? (
          <img
            src={fileUrl(reel.id, 'out/cover.png', reel.updatedAt)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="pb-2" aria-hidden>
            <Mascot config={mascot} expression="happy" open={0} width={54} html />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
        <div>
          <div className="line-clamp-2 text-[17px] font-semibold leading-snug">{reel.title}</div>
          <div className="text-sm text-ink-soft">Edited {when(reel.updatedAt)}</div>
        </div>
        <StepTrack status={reel.status} />
      </div>
    </Link>
  );
}
