import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { interFontFamily } from "../fonts";

export const BulletList: React.FC<{
  items: string[];
  from: number;
  stagger?: number;
  color?: string;
  size?: number;
  dotColor?: string;
}> = ({ items, from, stagger = 12, color = "#fff", size = 30, dotColor = "#fff" }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {items.map((item, i) => {
        const start = from + i * stagger;
        const opacity = interpolate(frame, [start, start + 15], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });
        const x = interpolate(frame, [start, start + 15], [-24, 0], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              opacity,
              transform: `translateX(${x}px)`,
              fontFamily: interFontFamily,
              fontSize: size,
              color,
              maxWidth: 1100,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: dotColor,
                marginTop: size * 0.4,
                flexShrink: 0,
              }}
            />
            <span>{item}</span>
          </div>
        );
      })}
    </div>
  );
};
