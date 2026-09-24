import React from "react";
import { AbsoluteFill } from "remotion";

export const Scene: React.FC<{
  background: string;
  children: React.ReactNode;
}> = ({ background, children }) => {
  return (
    <AbsoluteFill
      style={{
        background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
