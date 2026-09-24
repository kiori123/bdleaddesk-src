import React from "react";
import { gradients } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { BulletList } from "../components/BulletList";

export const ContextScene: React.FC = () => {
  return (
    <Scene background={gradients.red}>
      <Heading from={0} size={54}>
        The old portal was a web app built inside an automation tool
      </Heading>
      <div style={{ height: 44 }} />
      <BulletList
        from={25}
        items={[
          "100 nodes, HTML assembled by chaining strings inside a Code node",
          "Dropdowns couldn't read live data",
          "<script> tags were stripped out of forms",
          "Session state had to be stuffed into the query string",
          "Every endpoint checked its own hardcoded shared secret",
        ]}
      />
      <div style={{ height: 52 }} />
      <Heading from={130} size={36} color="#FFE8B0">
        The SignalHire pipeline still works well, so it stayed.
        The portal was rebuilt as a proper app.
      </Heading>
    </Scene>
  );
};
