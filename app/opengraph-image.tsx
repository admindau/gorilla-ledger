import { ImageResponse } from "next/og";

export const alt = "Gorilla Ledger — Know where your money stands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "white", background: "radial-gradient(circle at 80% 10%, #26332d 0, #090909 42%, #000 100%)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28 }}><div style={{ width: 56, height: 56, border: "1px solid #777", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>GL</div>Gorilla Ledger™</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}><div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1, letterSpacing: -4, fontWeight: 650 }}><span>Know where your</span><span>money stands.</span></div><div style={{ fontSize: 26, color: "#c7c7c7" }}>Clear balances, cash flow, budgets, and recurring activity—currency by currency.</div></div>
      <div style={{ fontSize: 20, color: "#a3a3a3" }}>A product of Savvy Rilla Technologies</div>
    </div>,
    size,
  );
}
