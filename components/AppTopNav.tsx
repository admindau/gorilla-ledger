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
  { href: "/exports", label: "Exports", shortLabel: "Export" },
  { href: "/settings/security", label: "Security", shortLabel: "Security" },
] as const;

const mobilePrimaryHrefs = ["/dashboard", "/transactions", "/wallets", "/budgets"] as const;

function NavIcon({ href }: { href: (typeof navItems)[number]["href"] }) {
  const paths: Record<(typeof navItems)[number]["href"], React.ReactNode> = {
    "/dashboard": <><path d="M3 10.5 10 4l7 6.5" /><path d="M5.5 9.5V17h9V9.5" /></>,
    "/transactions": <><path d="M4 6h12M4 10h8M4 14h10" /><path d="m14 12 2 2-2 2" /></>,
    "/wallets": <><path d="M3.5 6.5h13v9h-13z" /><path d="M13 9.5h3.5v3H13zM5.5 6.5V5h8v1.5" /></>,
    "/budgets": <><path d="M4 16V9m4 7V5m4 11v-4m4 4V7" /></>,
    "/categories": <><path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" /></>,
    "/recurring": <><path d="M15.5 7.5A6 6 0 0 0 5 6l-1.5 2" /><path d="M3.5 4v4h4M4.5 12.5A6 6 0 0 0 15 14l1.5-2" /><path d="M16.5 16v-4h-4" /></>,
    "/exports": <><path d="M10 3v9m0 0 3-3m-3 3L7 9" /><path d="M4 13v3h12v-3" /></>,
    "/settings/security": <><path d="M10 3 4.5 5v4.5c0 3.6 2.2 6.2 5.5 7.5 3.3-1.3 5.5-3.9 5.5-7.5V5z" /><path d="m7.5 10 1.5 1.5 3.5-3.5" /></>,
  };

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
      {paths[href]}
    </svg>
  );
}

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
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const activeLabel = useMemo(() => {
    return navItems.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.label ?? "Gorilla Ledger";
  }, [pathname]);
  const isNavigating = Boolean(navigatingTo && navigatingTo !== pathname);
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryHrefs.includes(item.href as (typeof mobilePrimaryHrefs)[number]));
  const mobileMoreItems = navItems.filter((item) => !mobilePrimaryHrefs.includes(item.href as (typeof mobilePrimaryHrefs)[number]));
  const moreIsActive = mobileMoreItems.some((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`));

  useEffect(() => {
    let cancelled = false;

    async function loadNavState() {
      try {
        const { data: userData } = await supabaseBrowserClient.auth.getUser();
        const user = userData?.user;
        const [factors, profileResult] = await Promise.all([
          supabaseBrowserClient.auth.mfa.listFactors().catch(() => null),
          user
            ? supabaseBrowserClient
                .from("profiles")
                .select("security_reviewed_at,timezone")
                .eq("id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelled) return;

        setEmail(user?.email ?? "");
        const verifiedTotp = factors?.data?.totp?.filter((factor) => factor.status === "verified") ?? [];
        setMfaEnabled(verifiedTotp.length > 0);

        const serverReview = profileResult.data?.security_reviewed_at as string | null | undefined;
        if (serverReview) {
          setLastCheckAt(Date.parse(serverReview));
        } else {
          const raw = typeof window !== "undefined" ? localStorage.getItem(LAST_SECURITY_CHECK_AT_KEY) : null;
          const parsed = raw ? Number(raw) : null;
          setLastCheckAt(parsed && Number.isFinite(parsed) ? parsed : null);
        }

        if (user && !profileResult.error) {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (timeZone && profileResult.data?.timezone !== timeZone) {
            void supabaseBrowserClient
              .from("profiles")
              .upsert(
                { id: user.id, full_name: user.email ?? null, timezone: timeZone },
                { onConflict: "id" }
              );
          }
        }
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
    <header className="gl-app-topnav" aria-busy={isNavigating}>
      {isNavigating ? <div className="gl-navigation-progress" aria-label="Loading page" role="progressbar" /> : null}
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
                onClick={() => {
                  if (!active) setNavigatingTo(item.href);
                }}
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

      <nav className="gl-mobile-nav" aria-label="Mobile navigation">
        {mobilePrimaryItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={["gl-mobile-nav-link", active ? "gl-mobile-nav-link-active" : ""].filter(Boolean).join(" ")}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (!active) setNavigatingTo(item.href);
              }}
            >
              <NavIcon href={item.href} />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}

        <details className="gl-mobile-more">
          <summary className={["gl-mobile-nav-link", moreIsActive ? "gl-mobile-nav-link-active" : ""].filter(Boolean).join(" ")}>
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><circle cx="4" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" /><circle cx="16" cy="10" r="1.4" /></svg>
            <span>More</span>
          </summary>
          <div className="gl-mobile-more-menu">
            <p>More</p>
            {mobileMoreItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "is-active" : ""}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (!active) setNavigatingTo(item.href);
                  }}
                >
                  <NavIcon href={item.href} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </details>
      </nav>
    </header>
  );
}
