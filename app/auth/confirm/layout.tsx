import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirm sign-in" };

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
