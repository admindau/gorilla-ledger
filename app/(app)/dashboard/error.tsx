"use client";

import { useMemo } from "react";
import ErrorCard from "@/components/ui/ErrorCard";
import { logError } from "@/lib/errors/errorLogger";

type DashboardErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function DashboardError({
  error,
  reset,
}: DashboardErrorProps) {
  const errorInfo = useMemo(() => {
    return logError(error, {
      route: "/dashboard",
      component: "DashboardErrorBoundary",
    });
  }, [error]);

  return (
    <>
      <ErrorCard
        title="We couldn't load your dashboard."
        description="Your financial data is safe. A dashboard component encountered an unexpected error. You can retry loading the dashboard below."
        errorId={errorInfo.id}
        onRetry={reset}
        primaryLabel="Reload Dashboard"
        secondaryHref="/dashboard"
        secondaryLabel="Back to Dashboard"
      />

      {process.env.NODE_ENV === "development" && (
        <div className="mx-auto mt-6 w-full max-w-5xl px-6 pb-8">
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6">
            <h2 className="text-lg font-semibold text-red-300">
              Dashboard Exception (Development Only)
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-white/80">Message</dt>
                <dd className="mt-1 break-all font-mono text-red-200">
                  {error.message}
                </dd>
              </div>

              {error.digest && (
                <div>
                  <dt className="font-medium text-white/80">
                    Next.js Digest
                  </dt>
                  <dd className="mt-1 font-mono text-white/70">
                    {error.digest}
                  </dd>
                </div>
              )}

              <div>
                <dt className="font-medium text-white/80">
                  Error Reference
                </dt>
                <dd className="mt-1 font-mono text-white/70">
                  {errorInfo.id}
                </dd>
              </div>
            </dl>

            {error.stack && (
              <>
                <h3 className="mt-6 font-medium text-white/80">
                  Stack Trace
                </h3>

                <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-red-200">
                  {error.stack}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
