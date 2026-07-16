"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/wallets",
  "/transactions",
  "/budgets",
  "/categories",
  "/recurring",
  "/settings",
];

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export default function BfcacheAuthGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!pathname || !isProtected(pathname)) return;

      const { data } = await supabaseBrowserClient.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        const next = encodeURIComponent(pathname);
        window.location.replace(`/auth/login?next=${next}`);
      }
    }

    // The server proxy validates every normal protected-route request. Recheck
    // only when a document is restored from the back-forward cache, where the
    // browser can revive a page without contacting the server.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };

    // tab restored / focus regained
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pathname]);

  return null;
}
