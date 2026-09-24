import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { interFontFamily } from "../fonts";

export const Box: React.FC<{
  label: string;
  sub?: string;
  from: number;
  x: number;
  y: number;
  width?: number;
  background: string;
  borderColor?: string;
}> = ({ label, sub, from, x, y, width = 260, background, borderColor = "rgba(255,255,255,0.4)" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - from, fps, config: { damping: 12, mass: 0.5 } });
  const opacity = interpolate(frame, [from, from + 10], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `scale(${Math.max(scale, 0)})`,
        opacity,
        background,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: "18px 20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        fontFamily: interFontFamily,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{label}</div>
      {sub && <div style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
};
