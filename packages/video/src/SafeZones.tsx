import React from 'react';
import { HEIGHT, SAFE, WIDTH } from '@reelmaker/shared';
import { BLOCK_SLOT, CAPTION_BAND, MASCOT_BOX, type Box } from './layout.ts';

const SHADE = 'rgba(255, 40, 40, 0.28)';

const Outline: React.FC<{ box: Box; color: string }> = ({ box, color }) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      outline: `3px dashed ${color}`,
      outlineOffset: -3,
    }}
  />
);

/** Debug overlay: margins Instagram covers (red) and the layout slots (dashed). */
export const SafeZones: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: WIDTH, height: SAFE.top, background: SHADE }} />
    <div style={{ position: 'absolute', left: 0, bottom: 0, width: WIDTH, height: SAFE.bottom, background: SHADE }} />
    <div style={{ position: 'absolute', left: 0, top: SAFE.top, width: SAFE.left, height: HEIGHT - SAFE.top - SAFE.bottom, background: SHADE }} />
    <div style={{ position: 'absolute', right: 0, top: SAFE.top, width: SAFE.right, height: HEIGHT - SAFE.top - SAFE.bottom, background: SHADE }} />
    <Outline box={BLOCK_SLOT} color="#2B6CF6" />
    <Outline box={CAPTION_BAND} color="#12B886" />
    <Outline box={MASCOT_BOX} color="#FF8A3D" />
  </div>
);
