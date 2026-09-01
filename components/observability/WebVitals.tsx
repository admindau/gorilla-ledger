"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  const pathname = usePathname();
  useReportWebVitals((metric) => {
    const payload = {
      event: "web_vital",
      route: pathname,
      name: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
      navigationType: metric.navigationType,
    };
    if (process.env.NODE_ENV === "development" || metric.rating !== "good") {
      console.info("[web-vital]", payload);
    }
  });
  return null;
}
