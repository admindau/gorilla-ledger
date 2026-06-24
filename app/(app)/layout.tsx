import SessionGuard from "@/components/SessionGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-app-root">
      <div className="gl-app-content">
        <SessionGuard>{children}</SessionGuard>
      </div>
    </div>
  );
}
