import { Composition } from "remotion";
import { OnPointExplainer, TOTAL_DURATION, FPS } from "./OnPointExplainer";

export const Root: React.FC = () => {
  return (
    <Composition
      id="OnPointExplainer"
      component={OnPointExplainer}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
