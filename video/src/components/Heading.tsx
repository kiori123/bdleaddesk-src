import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { antonFontFamily } from "../fonts";

export const Heading: React.FC<{
  children: React.ReactNode;
  from?: number;
  color?: string;
  size?: number;
}> = ({ children, from = 0, color = "#fff", size = 64 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const y = interpolate(frame, [from, from + 20], [24, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: antonFontFamily,
        fontSize: size,
        color,
        textTransform: "uppercase",
        letterSpacing: 2,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};
