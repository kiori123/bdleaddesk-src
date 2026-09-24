import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { gradients } from "../theme";
import { Scene } from "../components/Scene";
import { antonFontFamily, interFontFamily } from "../fonts";

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const opacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <Scene background={gradients.red}>
      <Img
        src={staticFile("onpoint-logo.png")}
        style={{
          width: 130,
          transform: `scale(${logoScale})`,
          marginBottom: 30,
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.35))",
        }}
      />
      <div
        style={{
          fontFamily: antonFontFamily,
          fontSize: 88,
          color: "#fff",
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity,
        }}
      >
        Lead Desk
      </div>
      <div
        style={{
          fontFamily: interFontFamily,
          fontSize: 28,
          color: "rgba(255,255,255,0.85)",
          marginTop: 18,
          opacity,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        Tìm và xác minh decision-maker · Theo dõi tiến độ deal · Lưu tài liệu theo brand
      </div>
    </Scene>
  );
};
