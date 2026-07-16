import type { ReactNode } from "react";
import { PublicFooter } from "@/components/public/PublicFooter";

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="gl-public-auth-shell">
      <main className="gl-public-auth-main">{children}</main>
      <PublicFooter compact />
    </div>
  );
}
