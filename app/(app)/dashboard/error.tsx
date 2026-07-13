"use client";

import { useEffect, useMemo } from "react";
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

  useEffect(() => {
    logError(error, {
      route: "/dashboard",
      component: "DashboardErrorBoundary",
    });
  }, [error]);

  return (
    <ErrorCard
      title="We couldn't load your dashboard."
      description="Your financial data is safe. A dashboard component encountered an unexpected error. You can retry loading the dashboard below."
      errorId={errorInfo.id}
      onRetry={reset}
      primaryLabel="Reload Dashboard"
      secondaryHref="/dashboard"
      secondaryLabel="Back to Dashboard"
    />
  );
}