import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { gradients, colors } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { interFontFamily, antonFontFamily } from "../fonts";

const appItems = [
  "Đăng nhập, phân quyền",
  "Toàn bộ giao diện",
  "Kiểm và trừ credit, soạn mail outreach",
  "Admin panel",
  "Trạng thái job",
];

const n8nItems = [
  "Gọi SignalHire (search, reveal)",
  "Sinh bio + org chart bằng LLM",
  "Ghi mirror sang Google Sheets",
  "Cron dọn dẹp, cảnh báo lỗi",
];

const Column: React.FC<{
  title: string;
  items: string[];
  from: number;
  accent: string;
  x: "left" | "right";
}> = ({ title, items, from, accent, x }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const tx = interpolate(frame, [from, from + 15], [x === "left" ? -40 : 40, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${tx}px)`,
        background: "rgba(255,255,255,0.08)",
        border: `2px solid ${accent}`,
        borderRadius: 20,
        padding: "32px 40px",
        width: 560,
      }}
    >
      <div
        style={{
          fontFamily: antonFontFamily,
          fontSize: 34,
          color: accent,
          textTransform: "uppercase",
          marginBottom: 22,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item, i) => {
          const itemOpacity = interpolate(frame, [from + 15 + i * 8, from + 30 + i * 8], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: interFontFamily,
                fontSize: 22,
                color: "#fff",
                opacity: itemOpacity,
              }}
            >
              • {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BoundaryScene: React.FC = () => {
  return (
    <Scene background={gradients.red}>
      <Heading from={0} size={52}>
        Ranh giới, không được lấn
      </Heading>
      <div style={{ height: 44 }} />
      <div style={{ display: "flex", gap: 48 }}>
        <Column title="App" items={appItems} from={25} accent={colors.tealLight} x="left" />
        <Column title="n8n" items={n8nItems} from={35} accent="#FFD37A" x="right" />
      </div>
    </Scene>
  );
};
