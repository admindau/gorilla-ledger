import type { Metadata } from "next";
import AppTopNav from "@/components/AppTopNav";
import { UsageHeartbeat } from "@/components/observability/UsageHeartbeat";
import { isPlatformAdmin } from "@/lib/admin/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="gl-app-root">
      <a className="gl-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="gl-app-content">
        <UsageHeartbeat />
        <AppTopNav showPlatformAnalytics={isPlatformAdmin(user?.email)} />
        <main id="main-content" className="gl-app-page-region" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
