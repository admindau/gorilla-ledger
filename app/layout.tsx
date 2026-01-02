import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BfcacheAuthGuard from "@/components/auth/BfcacheAuthGuard";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        <ToastProvider>
          <BfcacheAuthGuard />
          {children}
        </ToastProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
