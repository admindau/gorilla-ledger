"use client";

import { useMemo } from "react";
import Link from "next/link";
import ErrorCard from "@/components/ui/ErrorCard";
import { logError } from "@/lib/errors/errorLogger";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps) {
  const errorInfo = useMemo(() => {
    return logError(error, {
      route: "global",
      component: "GlobalErrorBoundary",
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <ErrorCard
          title="Gorilla Ledger couldn't complete this request."
          description="Your financial data is safe. An unexpected application error occurred. You can try again or return to the dashboard."
          errorId={errorInfo.id}
          onRetry={reset}
          primaryLabel="Try Again"
          secondaryHref="/dashboard"
          secondaryLabel="Return to Dashboard"
        />

        {process.env.NODE_ENV === "development" && (
          <div className="mx-auto mb-8 w-full max-w-5xl px-6">
            <details className="rounded-xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-medium text-white">
                Developer Error Details
              </summary>

              <pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs text-red-300">
                {error.stack ?? error.message}
              </pre>

              {error.digest && (
                <p className="mt-3 text-xs text-white/60">
                  Digest: {error.digest}
                </p>
              )}
            </details>
          </div>
        )}

        <footer className="pb-8 text-center text-xs text-white/40">
          <Link
            href="/"
            className="hover:text-white transition-colors"
          >
            Gorilla Ledger
          </Link>
        </footer>
      </body>
    </html>
  );
}
