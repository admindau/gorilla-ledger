import SessionGuard from "@/components/SessionGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <SessionGuard>{children}</SessionGuard>
    </div>
  );
}
