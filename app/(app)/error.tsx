"use client";

import { useEffect, useMemo } from "react";
import ErrorCard from "@/components/ui/ErrorCard";
import { logError } from "@/lib/errors/errorLogger";

type AppErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function AppError({
  error,
  reset,
}: AppErrorProps) {
  const errorInfo = useMemo(() => {
    return logError(error, {
      route: "/(app)",
      component: "AuthenticatedErrorBoundary",
    });
  }, [error]);

  useEffect(() => {
    logError(error, {
      route: "/(app)",
      component: "AuthenticatedErrorBoundary",
    });
  }, [error]);

  return (
    <ErrorCard
      title="We couldn't load this page."
      description="Your Gorilla Ledger data is safe. An unexpected error occurred while loading this section of the application."
      errorId={errorInfo.id}
      onRetry={reset}
      primaryLabel="Try Again"
      secondaryHref="/dashboard"
      secondaryLabel="Return to Dashboard"
    />
  );
}