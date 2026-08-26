"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeConfirmationDestination } from "@/lib/auth/navigation";
import { isEmailOtpType } from "@/lib/auth/confirmation";

function parseHashParams(hash: string) {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    tokenHash: params.get("token_hash"),
    type: params.get("type"),
  };
}

export default function ConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(
    () => sanitizeConfirmationDestination(searchParams.get("next")),
    [searchParams]
  );
  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  const [status, setStatus] = useState<"working" | "ready" | "error">("working");
  const [message, setMessage] = useState("Checking your secure link…");
  const [tokenHash, setTokenHash] = useState("");
  const [verificationType, setVerificationType] = useState("");

  const finishConfirmation = useCallback(async () => {
    if (!tokenHash || !isEmailOtpType(verificationType)) return;

    setStatus("working");
    setMessage("Securing your session…");

    try {
      const response = await fetch("/auth/confirm/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type: verificationType }),
      });

      if (!response.ok) {
        setStatus("error");
        setMessage(
          "This link is invalid, expired, or has already been used. Request a fresh link below."
        );
        return;
      }

      window.history.replaceState(
        null,
        "",
        `/auth/confirm?next=${encodeURIComponent(next)}`
      );
      router.replace(next);
    } catch {
      setStatus("error");
      setMessage("We could not confirm the link. Check your connection and try again.");
    }
  }, [next, router, tokenHash, verificationType]);

  useEffect(() => {
    async function prepareConfirmation() {
      if (code) {
        window.location.assign(
          `/auth/confirm/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
        );
        return;
      }

      const hash = parseHashParams(window.location.hash || "");

      if (hash.tokenHash && isEmailOtpType(hash.type)) {
        setTokenHash(hash.tokenHash);
        setVerificationType(hash.type);
        setStatus("ready");
        setMessage("Your secure link is ready. Continue to sign in to Gorilla Ledger.");
        return;
      }

      // Older links may contain a complete implicit session. Keep them working
      // while all newly issued links use the scanner-resistant token flow.
      if (hash.accessToken && hash.refreshToken) {
        setMessage("Securing your session…");
        const { error: browserError } = await supabaseBrowserClient.auth.setSession({
          access_token: hash.accessToken,
          refresh_token: hash.refreshToken,
        });

        if (browserError) {
          setStatus("error");
          setMessage("Could not establish your session. Request a fresh link below.");
          return;
        }

        const response = await fetch("/auth/confirm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: hash.accessToken,
            refresh_token: hash.refreshToken,
          }),
        });

        if (!response.ok) {
          setStatus("error");
          setMessage("Session setup failed. Request a fresh link below.");
          return;
        }

        window.history.replaceState(
          null,
          "",
          `/auth/confirm?next=${encodeURIComponent(next)}`
        );
        router.replace(next);
        return;
      }

      setStatus("error");
      setMessage("This link is invalid or has expired. Request a fresh link below.");
    }

    void prepareConfirmation();
  }, [code, next, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="gl-auth-card gl-card w-full max-w-md">
        <p className="gl-auth-eyebrow">Secure account access</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {status === "ready"
            ? "Finish signing in"
            : status === "error"
              ? "Link unavailable"
              : "Confirming…"}
        </h1>
        <p
          className="mt-3 text-sm leading-6 text-white/70"
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>

        {status === "ready" ? (
          <button
            type="button"
            onClick={finishConfirmation}
            className="gl-btn gl-btn-primary gl-btn-md mt-6 w-full"
          >
            Continue securely
          </button>
        ) : null}

        {status === "error" ? (
          <div className="mt-6">
            <a
              href={verificationType === "signup" ? "/auth/register" : "/auth/login"}
              className="gl-btn gl-btn-secondary gl-btn-md w-full"
            >
              Request a fresh link
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
