import AppTopNav from "@/components/AppTopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-app-root">
      <a className="gl-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="gl-app-content">
        <AppTopNav />
        <main id="main-content" className="gl-app-page-region" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
