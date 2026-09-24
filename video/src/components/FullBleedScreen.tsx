import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, interpolate, Easing } from "remotion";
import { colors } from "../theme";
import { antonFontFamily, interFontFamily } from "../fonts";

export const FullBleedScreen: React.FC<{
  src: string;
  url: string;
  title: string;
  subtitle: string;
  from?: number;
  durationInFrames?: number;
  index?: number;
}> = ({ src, url, title, subtitle, from = 0, durationInFrames = 150, index = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Ken Burns: every screen zooms in and drifts down the page (revealing more
  // below the fold), alternating left/right drift so the sequence doesn't feel
  // static or repetitive.
  const t = interpolate(frame, [from, from + durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const zoom = 1 + 0.16 * t;
  const panX = (index % 2 === 0 ? -1 : 1) * 26 * t;
  const panY = -46 * t;
  const captionOpacity = interpolate(frame, [from + 15, from + 35], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const captionY = interpolate(frame, [from + 15, from + 35], [24, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#0B1418", opacity }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
            transformOrigin: "top center",
          }}
        >
          <div
            style={{
              height: 64,
              background: "#E7ECEC",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 26px",
              borderBottom: "1px solid #D5DDDD",
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 15, height: 15, borderRadius: 999, background: "#EC6A5E" }} />
              <div style={{ width: 15, height: 15, borderRadius: 999, background: "#F4BF4F" }} />
              <div style={{ width: 15, height: 15, borderRadius: 999, background: "#61C554" }} />
            </div>
            <div
              style={{
                flex: 1,
                marginLeft: 14,
                background: "#fff",
                borderRadius: 8,
                padding: "9px 18px",
                fontFamily: interFontFamily,
                fontSize: 19,
                color: "#5C7278",
                maxWidth: 640,
              }}
            >
              {url}
            </div>
          </div>
          <Img src={src} style={{ width: "100%", display: "block" }} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: "linear-gradient(0deg, rgba(10,20,24,0.88) 0%, rgba(10,20,24,0.0) 34%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "0 90px 64px",
        }}
      >
        <div
          style={{
            opacity: captionOpacity,
            transform: `translateY(${captionY}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontFamily: interFontFamily,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.tealLight,
              background: "rgba(0,147,163,0.18)",
              border: `1px solid ${colors.tealLight}`,
              borderRadius: 999,
              padding: "6px 16px",
              marginBottom: 14,
            }}
          >
            {url.replace("leaddesk.onpoint.vn", "")}
          </div>
          <div style={{ fontFamily: antonFontFamily, fontSize: 56, color: "#fff", textTransform: "uppercase" }}>
            {title}
          </div>
          <div style={{ fontFamily: interFontFamily, fontSize: 24, color: "rgba(255,255,255,0.82)", marginTop: 10, maxWidth: 1100 }}>
            {subtitle}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
