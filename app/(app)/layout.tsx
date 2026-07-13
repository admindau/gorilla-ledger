import AppTopNav from "@/components/AppTopNav";
import SessionGuard from "@/components/SessionGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-app-root">
      <a className="gl-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="gl-app-content">
        <SessionGuard>
          <AppTopNav />
          <main id="main-content" className="gl-app-page-region" tabIndex={-1}>
            {children}
          </main>
        </SessionGuard>
      </div>
    </div>
  );
}
