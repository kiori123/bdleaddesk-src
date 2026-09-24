import React from "react";
import { gradients } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";

export const TourIntroScene: React.FC = () => {
  return (
    <Scene background={gradients.teal}>
      <Heading from={5} size={72}>
        Here it is, built and running
      </Heading>
    </Scene>
  );
};
