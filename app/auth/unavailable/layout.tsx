import type { Metadata } from "next";

export const metadata: Metadata = { title: "Service unavailable" };

export default function UnavailableLayout({ children }: { children: React.ReactNode }) {
  return children;
}
