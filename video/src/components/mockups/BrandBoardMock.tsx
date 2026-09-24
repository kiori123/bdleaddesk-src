import React from "react";
import { product, colors } from "../../theme";
import { interFontFamily, antonFontFamily } from "../../fonts";

const ROWS: { name: string; category: string; stage: string; tier: number; contacts: number; owner: string }[] = [
  { name: "Northline Foods", category: "FMCG & F&B", stage: "Contacted", tier: 1, contacts: 3, owner: "An" },
  { name: "Aurora Beauty", category: "Beauty & Skincare", stage: "Researching", tier: 1, contacts: 2, owner: "Linh" },
  { name: "Kestrel Apparel", category: "Fashion", stage: "Negotiating", tier: 2, contacts: 4, owner: "Minh" },
  { name: "Solace Mother & Baby", category: "Mother & Baby", stage: "New", tier: 2, contacts: 0, owner: "An" },
];

const stageColor: Record<string, string> = {
  Contacted: colors.tealLight,
  Researching: "#7A949A",
  Negotiating: colors.redLight,
  New: "#C3D8D5",
};

export const BrandBoardMock: React.FC = () => {
  return (
    <div style={{ width: 980, background: product.surfacePage, padding: 28, fontFamily: interFontFamily }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: antonFontFamily, fontSize: 20, color: product.ink, textTransform: "uppercase" }}>
          Brands
        </span>
        <div
          style={{
            background: `linear-gradient(135deg, ${colors.tealLight} 0%, #103A52 100%)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "9px 16px",
            borderRadius: 8,
          }}
        >
          Find people
        </div>
      </div>

      <div style={{ background: product.surface, borderRadius: 12, border: `1px solid ${product.line}`, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1.6fr 1.2fr 0.8fr 1fr 1fr",
            padding: "10px 18px",
            fontSize: 11,
            fontWeight: 700,
            color: product.inkFaint,
            textTransform: "uppercase",
            borderBottom: `1px solid ${product.line}`,
          }}
        >
          <span>Brand</span>
          <span>Category</span>
          <span>Stage</span>
          <span>Tier</span>
          <span>Contacts</span>
          <span>Owner</span>
        </div>
        {ROWS.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 1.6fr 1.2fr 0.8fr 1fr 1fr",
              padding: "13px 18px",
              fontSize: 13.5,
              color: product.ink,
              borderBottom: i < ROWS.length - 1 ? `1px solid ${product.line}` : "none",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: product.inkDim }}>{r.category}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: stageColor[r.stage] }} />
              {r.stage}
            </span>
            <span style={{ color: product.inkDim }}>T{r.tier}</span>
            <span style={{ color: product.inkDim }}>{r.contacts}</span>
            <span style={{ color: product.inkDim }}>{r.owner}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
