import AppTopNav from "@/components/AppTopNav";
import SessionGuard from "@/components/SessionGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-app-root">
      <div className="gl-app-content">
        <SessionGuard>
          <AppTopNav />
          <div className="gl-app-page-region">{children}</div>
        </SessionGuard>
      </div>
    </div>
  );
}
