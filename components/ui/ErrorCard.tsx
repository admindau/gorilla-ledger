"use client";

import Link from "next/link";
type ErrorCardProps = {
  title?: string;
  description?: string;
  errorId?: string;
  onRetry?: () => void;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export default function ErrorCard({
  title = "Gorilla Ledger couldn't complete this request.",
  description = "Your financial data is safe. An unexpected error occurred while loading this page.",
  errorId,
  onRetry,
  primaryLabel = "Try Again",
  secondaryHref = "/dashboard",
  secondaryLabel = "Return to Dashboard",
}: ErrorCardProps) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <svg
              className="h-8 w-8 text-white/90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        </div>

        <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>

        <p className="mt-4 text-center text-sm leading-6 text-white/65">
          {description}
        </p>

        {errorId && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
              Error Reference
            </p>

            <p className="mt-1 font-mono text-sm text-white/80">
              {errorId}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.5 9a9 9 0 0114.13-3.36L23 10M1 14l5.37 4.36A9 9 0 0020.5 15" />
            </svg>
            {primaryLabel}
          </button>

          <Link
            href={secondaryHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}