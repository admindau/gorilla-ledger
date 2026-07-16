import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BfcacheAuthGuard from "@/components/auth/BfcacheAuthGuard";
import {
  COMPANY_NAME,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_URL,
} from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT_URL),
  applicationName: PRODUCT_NAME,
  title: {
    default: PRODUCT_NAME,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  category: "finance",
  openGraph: {
    type: "website",
    siteName: PRODUCT_NAME,
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    url: PRODUCT_URL,
  },
  twitter: {
    card: "summary",
    title: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
  },
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
