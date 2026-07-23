import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify sign-in" };

export default function MfaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
