"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  children: React.ReactNode;
  /**
   * Optional: where to send the user if there is no session.
   * Defaults to /auth/login
   */
  loginPath?: string;
};

export default function SessionGuard({ children, loginPath = "/auth/login" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();

        // If no session, hard redirect to login (replace avoids "Back" reopening protected UI)
        if (!data.session) {
          if (!alive) return;
          if (hasRedirectedRef.current) return;

          hasRedirectedRef.current = true;
          const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
          router.replace(`${loginPath}${next}`);
          return;
        }

        // Optional: also listen for auth state changes (logout, expiry, etc.)
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) {
            if (hasRedirectedRef.current) return;
            hasRedirectedRef.current = true;

            const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
            router.replace(`${loginPath}${next}`);
          }
        });

        // Cleanup subscription when effect re-runs/unmounts
        return () => {
          sub.subscription.unsubscribe();
        };
      } catch {
        // If anything blows up, fail closed: send to login.
        if (!alive) return;
        if (hasRedirectedRef.current) return;

        hasRedirectedRef.current = true;
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`${loginPath}${next}`);
      }
    }

    const maybeCleanupPromise = check();

    return () => {
      alive = false;
      // If check() returned a cleanup function, it will run automatically only if awaited,
      // but we are not awaiting here. That's fine; subscription cleanup is handled inside.
      void maybeCleanupPromise;
    };
  }, [router, pathname, loginPath]);

  return <>{children}</>;
}
