import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BfcacheAuthGuard from "@/components/auth/BfcacheAuthGuard";

export const metadata: Metadata = {
  title: "Gorilla Ledger™",
  description: "A focused money command center by Savvy Gorilla Technologies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <BfcacheAuthGuard />
          {children}
        </ToastProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
