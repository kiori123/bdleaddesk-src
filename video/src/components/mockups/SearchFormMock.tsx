import React from "react";
import { product, colors } from "../../theme";
import { interFontFamily, antonFontFamily } from "../../fonts";

const chip = (label: string, active = false) => (
  <span
    key={label}
    style={{
      fontFamily: interFontFamily,
      fontSize: 12,
      padding: "5px 10px",
      borderRadius: 7,
      border: `1px solid ${active ? colors.tealLight : product.line}`,
      background: active ? colors.tealLight : "#fff",
      color: active ? "#fff" : product.inkDim,
    }}
  >
    {label}
  </span>
);

export const SearchFormMock: React.FC = () => {
  return (
    <div style={{ width: 900, background: product.surfacePage, padding: 28, fontFamily: interFontFamily }}>
      <div
        style={{
          background: product.surface,
          borderRadius: 12,
          border: `1px solid ${product.line}`,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            borderBottom: `2px solid ${colors.tealDark}`,
            paddingBottom: 8,
            marginBottom: 18,
          }}
        >
          <span style={{ fontFamily: antonFontFamily, fontSize: 15, color: colors.tealDark, textTransform: "uppercase", letterSpacing: 1 }}>
            Must match
          </span>
          <span style={{ fontSize: 11, color: product.inkFaint, fontWeight: 600 }}>narrows the search</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: product.inkFaint, textTransform: "uppercase", marginBottom: 6 }}>
            Brands
          </div>
          <div
            style={{
              border: `1px solid ${product.line}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              color: product.ink,
              background: "#fff",
            }}
          >
            Northline Foods, Aurora Beauty
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: product.inkFaint, textTransform: "uppercase", marginBottom: 6 }}>
              Category
            </div>
            <div style={{ border: `1px solid ${product.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
              FMCG &amp; F&amp;B
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: product.inkFaint, textTransform: "uppercase", marginBottom: 6 }}>
              Where do they work
            </div>
            <div style={{ border: `1px solid ${product.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
              Vietnam only
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: product.inkFaint, textTransform: "uppercase", marginBottom: 8 }}>
            Decision makers
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[chip("founder", true), chip("CEO"), chip("general director"), chip("commercial director")]}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderTop: `1px solid ${product.line}`,
            paddingTop: 16,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${colors.tealLight} 0%, #103A52 100%)`,
              color: "#fff",
              fontFamily: interFontFamily,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              padding: "11px 22px",
              borderRadius: 8,
            }}
          >
            Search
          </div>
          <span style={{ fontSize: 12, color: product.inkDim }}>Free. Uses 2 of your brand scans.</span>
        </div>
      </div>
    </div>
  );
};
