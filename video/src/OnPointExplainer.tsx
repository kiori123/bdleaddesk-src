import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { ContextScene } from "./scenes/ContextScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { BoundaryScene } from "./scenes/BoundaryScene";
import { CreditRuleScene } from "./scenes/CreditRuleScene";
import { ClosingScene } from "./scenes/ClosingScene";

export const FPS = 30;

const SCENES = [
  { Component: IntroScene, duration: 150 },
  { Component: ContextScene, duration: 270 },
  { Component: ArchitectureScene, duration: 330 },
  { Component: BoundaryScene, duration: 270 },
  { Component: CreditRuleScene, duration: 270 },
  { Component: ClosingScene, duration: 210 },
];

export const TOTAL_DURATION = SCENES.reduce((sum, s) => sum + s.duration, 0);

export const OnPointExplainer: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill>
      {SCENES.map(({ Component, duration }, i) => {
        const from = cursor;
        cursor += duration;
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
