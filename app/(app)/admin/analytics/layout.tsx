import type { Metadata } from "next";

export const metadata: Metadata = { title: "Platform analytics" };

export default function PlatformAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
