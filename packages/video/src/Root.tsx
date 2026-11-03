import React from 'react';
import { Composition } from 'remotion';
import { durationInFrames, FPS, HEIGHT, WIDTH, type ReelProps } from '@reelmaker/shared';
import demoProps from '../fixtures/demo-props.json';
import { Reel, REEL_COMPOSITION_ID } from './Reel.tsx';

export const Root: React.FC = () => (
  <Composition
    id={REEL_COMPOSITION_ID}
    component={Reel}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={90}
    defaultProps={demoProps as ReelProps}
    calculateMetadata={({ props }) => ({ durationInFrames: durationInFrames(props.words) })}
  />
);
