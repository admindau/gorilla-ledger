import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gl-public-shell">
      <a className="gl-skip-link" href="#main-content">Skip to main content</a>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
