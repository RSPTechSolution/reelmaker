import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef } from 'react';
import { durationInFrames, FPS, HEIGHT, WIDTH, type Brand, type MascotConfig } from '@reelmaker/shared';
import { Reel } from '@reelmaker/video';
import { demoProps } from '../demo.ts';
import { prefersReducedMotion, useInView } from '../motion.tsx';

const W = 248;
const STILL_FRAME = 200; // a card + captions moment, shown when motion is reduced

/**
 * The page's signature moment: a phone playing a sample reel in the owner's brand and mascot.
 * Muted and looping; paused when scrolled away or the tab is hidden; still with reduced motion.
 */
export function Showcase({ brand, mascot }: { brand: Brand; mascot: MascotConfig }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const visible = useInView(box, { once: false, rootMargin: '0px' });

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (prefersReducedMotion()) {
      p.pause();
      p.seekTo(STILL_FRAME);
      return;
    }
    const sync = () => (visible && document.visibilityState === 'visible' ? p.play() : p.pause());
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [visible]);

  return (
    <div ref={box} className="tilt shrink-0" tabIndex={0} aria-label="Sample reel, playing without sound">
      <div className="overflow-hidden rounded-[28px] border-[7px] border-ink bg-ink shadow-[0_30px_60px_-30px_rgb(31_36_48/0.6)]">
        <Player
          ref={player}
          component={Reel}
          inputProps={{ ...demoProps, brand, mascot }}
          durationInFrames={durationInFrames(demoProps.words)}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          fps={FPS}
          loop
          initiallyMuted
          acknowledgeRemotionLicense
          style={{ width: W, height: (W * HEIGHT) / WIDTH }}
        />
      </div>
    </div>
  );
}
