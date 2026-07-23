import Link from "next/link";
import { COMPANY_NAME, COMPANY_SITE_URL, PRODUCT_NAME } from "@/lib/brand";

const footerGroups = [
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function PublicFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={["gl-public-footer", compact ? "gl-public-footer-compact" : ""].filter(Boolean).join(" ")}>
      <div className="gl-public-footer-inner">
        <div>
          <Link href="/" className="gl-public-footer-brand">{PRODUCT_NAME}</Link>
          <p>
            A product of{" "}
            <a href={COMPANY_SITE_URL} target="_blank" rel="noreferrer">
              {COMPANY_NAME}
            </a>
            .
          </p>
        </div>

        <div className="gl-public-footer-links">
          {footerGroups.map((group) => (
            <div key={group.label}>
              <p>{group.label}</p>
              <div>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href}>{link.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="gl-public-footer-copy">© {new Date().getFullYear()} {COMPANY_NAME}.</p>
      </div>
    </footer>
  );
}
