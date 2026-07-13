"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

const navItems = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { href: "/wallets", label: "Wallets", shortLabel: "Wallets" },
  { href: "/categories", label: "Categories", shortLabel: "Categories" },
  { href: "/transactions", label: "Transactions", shortLabel: "Tx" },
  { href: "/budgets", label: "Budgets", shortLabel: "Budgets" },
  { href: "/recurring", label: "Recurring", shortLabel: "Recurring" },
  { href: "/settings/security", label: "Security", shortLabel: "Security" },
] as const;

function daysAgoFromMs(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatLastSecurityCheck(value: number | null) {
  if (!value || value <= 0) return "Not recorded";
  const days = daysAgoFromMs(value);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AppTopNav() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);

  const activeLabel = useMemo(() => {
    return navItems.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.label ?? "Gorilla Ledger";
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadNavState() {
      try {
        const [{ data: userData }, factors] = await Promise.all([
          supabaseBrowserClient.auth.getUser(),
          supabaseBrowserClient.auth.mfa.listFactors().catch(() => null),
        ]);

        if (cancelled) return;

        setEmail(userData?.user?.email ?? "");
        const verifiedTotp = factors?.data?.totp?.filter((factor) => factor.status === "verified") ?? [];
        setMfaEnabled(verifiedTotp.length > 0);

        const raw = typeof window !== "undefined" ? localStorage.getItem(LAST_SECURITY_CHECK_AT_KEY) : null;
        const parsed = raw ? Number(raw) : null;
        setLastCheckAt(parsed && Number.isFinite(parsed) ? parsed : null);
      } catch {
        if (!cancelled) setMfaEnabled(null);
      }
    }

    loadNavState();
    const onFocus = () => loadNavState();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabaseBrowserClient.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <header className="gl-app-topnav">
      <div className="gl-app-topnav-inner">
        <div className="min-w-0">
          <Link href="/dashboard" className="gl-app-brand" aria-label="Go to dashboard">
            Gorilla Ledger™
          </Link>
          <div className="gl-app-current-section" aria-live="polite">{activeLabel}</div>
        </div>

        <nav className="gl-app-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={["gl-app-nav-link", active ? "gl-app-nav-link-active" : ""].filter(Boolean).join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="gl-app-nav-meta">
          <div className="hidden lg:flex min-w-0 flex-col items-end leading-tight">
            {email ? <span className="max-w-[220px] truncate text-xs text-gray-300">{email}</span> : null}
            <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500" aria-live="polite">
              MFA {mfaEnabled ? "enabled" : mfaEnabled === false ? "off" : "checking"} · {formatLastSecurityCheck(lastCheckAt)}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            disabled={signingOut}
            aria-busy={signingOut}
          >
            {signingOut ? "Logging out…" : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}
