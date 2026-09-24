import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { Scene } from "../components/Scene";
import { colors, gradients } from "../theme";
import { antonFontFamily, interFontFamily } from "../fonts";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const titleOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const titleY = interpolate(frame, [20, 45], [30, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const subOpacity = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <Scene background={gradients.teal}>
      <Img
        src={staticFile("onpoint-logo.png")}
        style={{
          width: 160,
          transform: `scale(${logoScale})`,
          marginBottom: 36,
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.35))",
        }}
      />
      <div
        style={{
          fontFamily: antonFontFamily,
          fontSize: 108,
          color: "#fff",
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Lead Desk
      </div>
      <div
        style={{
          fontFamily: interFontFamily,
          fontSize: 32,
          color: "rgba(255,255,255,0.85)",
          marginTop: 20,
          opacity: subOpacity,
        }}
      >
        Công cụ nội bộ Business Development · OnPoint
      </div>
    </Scene>
  );
};
