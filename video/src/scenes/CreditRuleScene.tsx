import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { gradients, colors } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { Arrow } from "../components/Arrow";
import { interFontFamily } from "../fonts";

const steps = [
  { title: "1. Check the budget", sub: "category_credit_status.remaining" },
  { title: "2. Write reserved", sub: "credit_ledger" },
  { title: "3. Call n8n to reveal", sub: "SignalHire" },
  { title: "4. committed / released", sub: "callback + idempotent job_id" },
];

const Step: React.FC<{ index: number; from: number }> = ({ index, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - from, fps, config: { damping: 12, mass: 0.5 } });
  const opacity = interpolate(frame, [from, from + 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const s = steps[index];

  return (
    <div
      style={{
        transform: `scale(${Math.max(scale, 0)})`,
        opacity,
        background: index === 3 ? colors.tealDark : "rgba(255,255,255,0.1)",
        border: `2px solid ${index === 3 ? "#FFD37A" : "rgba(255,255,255,0.4)"}`,
        borderRadius: 16,
        padding: "22px 26px",
        width: 320,
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: interFontFamily, fontSize: 24, fontWeight: 700, color: "#fff" }}>{s.title}</div>
      <div style={{ fontFamily: interFontFamily, fontSize: 16, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>
        {s.sub}
      </div>
    </div>
  );
};

export const CreditRuleScene: React.FC = () => {
  return (
    <Scene background={gradients.teal}>
      <Heading from={0} size={52}>
        Credit is real money
      </Heading>
      <div style={{ height: 56 }} />
      <div style={{ position: "relative", display: "flex", gap: 90 }}>
        {steps.map((_, i) => (
          <Step key={i} index={i} from={25 + i * 20} />
        ))}
      </div>
      <div style={{ height: 60 }} />
      <div
        style={{
          fontFamily: interFontFamily,
          fontSize: 26,
          color: "rgba(255,255,255,0.9)",
          textAlign: "center",
          maxWidth: 1200,
          opacity: interpolate(useCurrentFrame(), [130, 155], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          }),
        }}
      >
        n8n never decides whether to spend — it can't see what's left in the budget.
      </div>
    </Scene>
  );
};
