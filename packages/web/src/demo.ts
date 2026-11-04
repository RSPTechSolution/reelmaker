import type { ReelProps } from '@reelmaker/shared';
import demo from '../../video/fixtures/demo-props.json';

/**
 * Example reel with fake timings, used where there is no real reel yet (Library showcase, Brand).
 * Silent: no voice, music or sound effects to fetch.
 */
const base = demo as ReelProps;
export const demoProps: ReelProps = { ...base, reel: { ...base.reel, audio: { sfx: false, sfxVolume: 0 } } };
