"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

function parseHashParams(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  };
}

export default function ConfirmClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") ?? "/auth/update-password", [sp]);
  const code = useMemo(() => sp.get("code"), [sp]);

  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Confirming your session...");

  useEffect(() => {
    // PKCE code flow (if ever used)
    if (code) {
      window.location.assign(
        `/auth/confirm/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
      );
      return;
    }

    // Hash token flow (your current recovery link case)
    const { access_token, refresh_token } = parseHashParams(window.location.hash || "");

    if (!access_token || !refresh_token) {
      setStatus("error");
      setMessage("Invalid or expired link. Please request a new password reset.");
      return;
    }

    (async () => {
      try {
        setMessage("Securing your session...");

        // 1) Set session in the browser immediately (so update-password can read it)
        const { error: browserErr } = await supabaseBrowserClient.auth.setSession({
          access_token,
          refresh_token,
        });

        if (browserErr) {
          setStatus("error");
          setMessage("Could not establish session. Please request a new reset link.");
          return;
        }

        // 2) Also set cookies on the server (so SSR/protected routes work)
        const res = await fetch("/auth/confirm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token, refresh_token }),
        });

        if (!res.ok) {
          setStatus("error");
          setMessage("Session cookie setup failed. Please request a new reset link.");
          return;
        }

        // Remove fragment tokens from URL
        window.history.replaceState(null, "", `/auth/confirm?next=${encodeURIComponent(next)}`);

        router.replace(next);
      } catch {
        setStatus("error");
        setMessage("Network error while confirming. Please try again.");
      }
    })();
  }, [code, next, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6">
        <h1 className="text-xl font-semibold">Confirming…</h1>
        <p className="mt-2 text-sm text-white/70">{message}</p>

        {status === "error" ? (
          <div className="mt-5">
            <a
              href="/auth/reset-password"
              className="inline-block rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white hover:text-black transition"
            >
              Request a new reset link
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
