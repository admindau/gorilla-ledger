import type { Metadata } from "next";

export const metadata: Metadata = { title: "Recurring transactions" };

export default function RecurringLayout({ children }: { children: React.ReactNode }) {
  return children;
}
