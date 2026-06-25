export const chartTheme = {
  gridStroke: "rgba(255,255,255,0.08)",
  axisStroke: "rgba(255,255,255,0.14)",
  tickFill: "rgba(255,255,255,0.58)",
  tickFillStrong: "rgba(255,255,255,0.74)",
  cursorFill: "rgba(255,255,255,0.045)",
  tooltipWrapper: {
    zIndex: 80,
    pointerEvents: "none" as const,
    outline: "none",
  },
  lineIncome: "#d8f8e5",
  lineExpense: "#f4b8b8",
  lineNeutral: "#d6d6d6",
  barPrimary: "#d7d7d7",
  barSecondary: "rgba(255,255,255,0.42)",
  pieColors: [
    "#f2f2f2",
    "#bdbdbd",
    "#8f8f8f",
    "#f0d98a",
    "#c7e4d0",
    "#d8c7e8",
    "#e2b8b8",
    "#a8c8e8",
  ],
};

export const chartMargins = {
  line: { top: 14, right: 18, bottom: 12, left: 8 },
  bar: { top: 14, right: 16, bottom: 42, left: 8 },
  compactBar: { top: 14, right: 16, bottom: 56, left: 8 },
  pie: { top: 12, right: 12, bottom: 12, left: 12 },
};
