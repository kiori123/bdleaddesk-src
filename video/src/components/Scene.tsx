import React from "react";
import { AbsoluteFill } from "remotion";

export const Scene: React.FC<{
  background: string;
  children: React.ReactNode;
}> = ({ background, children }) => {
  return (
    <AbsoluteFill style={{ background }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
          opacity: 0.5,
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
