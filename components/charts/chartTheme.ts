export const chartTheme = {
  gridStroke: "rgba(255,255,255,0.055)",
  axisStroke: "rgba(255,255,255,0.10)",
  tickFill: "rgba(255,255,255,0.56)",
  tickFillStrong: "rgba(255,255,255,0.76)",
  cursorFill: "rgba(255,255,255,0.035)",
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
  line: { top: 18, right: 22, bottom: 18, left: 10 },
  bar: { top: 18, right: 20, bottom: 46, left: 10 },
  compactBar: { top: 18, right: 20, bottom: 60, left: 10 },
  pie: { top: 12, right: 12, bottom: 12, left: 12 },
};
