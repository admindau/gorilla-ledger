import type { Metadata } from "next";
import AppTopNav from "@/components/AppTopNav";
import { UsageHeartbeat } from "@/components/observability/UsageHeartbeat";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-app-root">
      <a className="gl-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="gl-app-content">
        <UsageHeartbeat />
        <AppTopNav />
        <main id="main-content" className="gl-app-page-region" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
