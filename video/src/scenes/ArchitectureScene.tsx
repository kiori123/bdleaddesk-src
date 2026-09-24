import React from "react";
import { gradients, colors } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { Box } from "../components/Box";
import { Arrow } from "../components/Arrow";

export const ArchitectureScene: React.FC = () => {
  return (
    <Scene background={gradients.teal}>
      <div style={{ position: "absolute", top: 60, width: "100%" }}>
        <Heading from={0} size={52}>
          Kiến trúc lai
        </Heading>
      </div>

      <div style={{ position: "relative", width: 1500, height: 620 }}>
        <Box from={20} x={0} y={280} label="Người dùng" sub="~5–10 người BD" background="rgba(255,255,255,0.12)" />
        <Box
          from={35}
          x={280}
          y={280}
          label="Next.js"
          sub="Vercel · App làm mọi thứ người dùng chạm vào"
          background={colors.tealDark}
        />
        <Box
          from={55}
          x={620}
          y={280}
          label="Supabase"
          sub="Postgres + Auth + Storage"
          background={colors.tealDark}
        />
        <Box
          from={80}
          x={960}
          y={80}
          label="n8n (self-host)"
          sub="Mọi thứ chạy nền"
          background={colors.redDark}
        />
        <Box from={105} x={1260} y={0} label="SignalHire" sub="search, reveal" background="rgba(255,255,255,0.12)" width={220} />
        <Box from={115} x={1260} y={130} label="Google Sheets" sub="mirror" background="rgba(255,255,255,0.12)" width={220} />
        <Box from={125} x={1260} y={260} label="Gmail" sub="outreach" background="rgba(255,255,255,0.12)" width={220} />

        <Arrow x1={230} y1={320} x2={280} y2={320} from={45} label="" />
        <Arrow x1={540} y1={320} x2={620} y2={320} from={65} label="" />
        <Arrow x1={880} y1={300} x2={960} y2={160} from={90} label="webhook" />
        <Arrow x1={1180} y1={130} x2={1260} y2={100} from={140} />
        <Arrow x1={1180} y1={150} x2={1260} y2={195} from={150} />
        <Arrow x1={1180} y1={170} x2={1260} y2={300} from={160} />
        <Arrow x1={960} y1={220} x2={880} y2={340} from={175} label="callback" color="#FFD37A" />
      </div>

      <Heading from={200} size={30} color="rgba(255,255,255,0.9)">
        App lo mọi thứ người dùng chạm vào · n8n lo mọi thứ chạy nền
      </Heading>
    </Scene>
  );
};
