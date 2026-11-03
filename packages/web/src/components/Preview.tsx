import { Player, type PlayerRef } from '@remotion/player';
import { forwardRef, useState } from 'react';
import { durationInFrames, FPS, HEIGHT, WIDTH, type ReelProps } from '@reelmaker/shared';
import { Reel } from '@reelmaker/video';

const PREVIEW_W = 360;

/** Live reel preview: the same Reel composition the renderer uses, at 1/3 size. */
export const Preview = forwardRef<PlayerRef, { props: ReelProps }>(function Preview({ props }, ref) {
  const [safeZones, setSafeZones] = useState(false);
  return (
    <div className="flex w-[360px] flex-col gap-2">
      <div className="overflow-hidden rounded-[22px] border-[6px] border-ink bg-ink">
        <Player
          ref={ref}
          component={Reel}
          inputProps={{ ...props, debugSafeZones: safeZones }}
          durationInFrames={durationInFrames(props.words)}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          fps={FPS}
          controls
          acknowledgeRemotionLicense
          style={{ width: PREVIEW_W - 12, height: ((PREVIEW_W - 12) * HEIGHT) / WIDTH }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={safeZones} onChange={(e) => setSafeZones(e.target.checked)} />
        Show safe zones (areas Instagram covers)
      </label>
    </div>
  );
});
