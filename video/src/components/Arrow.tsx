import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  from: number;
  color?: string;
  label?: string;
}> = ({ x1, y1, x2, y2, from, color = "rgba(255,255,255,0.85)", label }) => {
  const frame = useCurrentFrame();
  const length = Math.hypot(x2 - x1, y2 - y1);
  const progress = interpolate(frame, [from, from + 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
      width={1}
      height={1}
    >
      <defs>
        <marker id={`arrowhead-${x1}-${y1}-${x2}-${y2}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x1 + (x2 - x1) * progress}
        y2={y1 + (y2 - y1) * progress}
        stroke={color}
        strokeWidth={3}
        markerEnd={progress > 0.9 ? `url(#arrowhead-${x1}-${y1}-${x2}-${y2})` : undefined}
        strokeDasharray={length}
      />
      {label && progress > 0.5 && (
        <foreignObject x={midX - 80} y={midY - 16} width={160} height={32}>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              color,
              textAlign: "center",
              opacity: interpolate(frame, [from + 15, from + 30], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
            }}
          >
            {label}
          </div>
        </foreignObject>
      )}
    </svg>
  );
};
