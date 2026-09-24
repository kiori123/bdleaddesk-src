import React from "react";
import { interFontFamily } from "../fonts";

export const BrowserChrome: React.FC<{
  url: string;
  width: number;
  children: React.ReactNode;
}> = ({ url, width, children }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        background: "#fff",
      }}
    >
      <div
        style={{
          height: 44,
          background: "#E7ECEC",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          borderBottom: "1px solid #D5DDDD",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          <div style={{ width: 11, height: 11, borderRadius: 999, background: "#EC6A5E" }} />
          <div style={{ width: 11, height: 11, borderRadius: 999, background: "#F4BF4F" }} />
          <div style={{ width: 11, height: 11, borderRadius: 999, background: "#61C554" }} />
        </div>
        <div
          style={{
            flex: 1,
            marginLeft: 10,
            background: "#fff",
            borderRadius: 7,
            padding: "6px 12px",
            fontFamily: interFontFamily,
            fontSize: 14,
            color: "#5C7278",
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ background: "#fff" }}>{children}</div>
    </div>
  );
};
