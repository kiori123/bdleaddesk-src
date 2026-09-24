import React from "react";
import { gradients, colors } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { Box } from "../components/Box";
import { Arrow } from "../components/Arrow";

export const ArchitectureScene: React.FC = () => {
  return (
    <Scene background={gradients.teal}>
      <div style={{ position: "absolute", top: 56, width: "100%" }}>
        <Heading from={0} size={50}>
          A hybrid architecture, split on purpose
        </Heading>
      </div>

      <div style={{ position: "relative", width: 1560, height: 640, marginTop: 30 }}>
        {/* Row 1: everything the user touches */}
        <Box from={20} x={0} y={140} width={220} label="BD team" sub="~5-10 people" background="rgba(255,255,255,0.12)" />
        <Box from={38} x={310} y={140} width={250} label="Next.js" sub="Vercel · everything the user touches" background={colors.tealDark} />
        <Box from={58} x={650} y={140} width={250} label="Supabase" sub="Postgres + Auth + Storage" background={colors.tealDark} />

        {/* Row 2: everything that runs in the background */}
        <Box from={95} x={420} y={460} width={280} label="n8n (self-host)" sub="everything that runs in the background" background={colors.redDark} />
        <Box from={130} x={1000} y={370} width={230} label="SignalHire" sub="search, reveal" background="rgba(255,255,255,0.12)" />
        <Box from={142} x={1000} y={460} width={230} label="Google Sheets" sub="mirror copy" background="rgba(255,255,255,0.12)" />
        <Box from={154} x={1000} y={550} width={230} label="Gmail" sub="outreach" background="rgba(255,255,255,0.12)" />

        {/* top row connections */}
        <Arrow x1={230} y1={185} x2={310} y2={185} from={45} />
        <Arrow x1={570} y1={185} x2={650} y2={185} from={65} />

        {/* down: webhook, up: callback, offset so they never overlap */}
        <Arrow x1={410} y1={210} x2={520} y2={460} from={100} label="webhook" color="#FFD37A" />
        <Arrow x1={640} y1={460} x2={520} y2={212} from={185} label="callback" color="#BFEFEA" />

        {/* n8n out to its own integrations */}
        <Arrow x1={700} y1={500} x2={1000} y2={430} from={150} />
        <Arrow x1={700} y1={510} x2={1000} y2={505} from={162} />
        <Arrow x1={700} y1={520} x2={1000} y2={585} from={174} />
      </div>

      <Heading from={215} size={28} color="rgba(255,255,255,0.9)">
        The app owns everything the user touches. n8n owns everything that runs in the background.
      </Heading>
    </Scene>
  );
};
