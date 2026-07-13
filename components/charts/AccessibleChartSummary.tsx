"use client";

type AccessibleChartSummaryProps = {
  summary: string;
  status?: "polite" | "off";
};

export default function AccessibleChartSummary({
  summary,
  status = "off",
}: AccessibleChartSummaryProps) {
  return (
    <p className="sr-only" aria-live={status === "polite" ? "polite" : undefined}>
      {summary}
    </p>
  );
}
