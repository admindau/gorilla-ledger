type DataLoadAlertProps = {
  title?: string;
  message?: string;
  onRetry: () => void;
};

export function DataLoadAlert({
  title = "Verified data is temporarily unavailable",
  message = "We could not verify the latest ledger data. No unverified totals are being shown.",
  onRetry,
}: DataLoadAlertProps) {
  return (
    <div className="gl-alert-error flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" role="alert" aria-live="polite">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-400/10 text-sm text-red-200" aria-hidden="true">!</span>
        <div>
          <p className="font-semibold text-red-100">{title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-red-100/70">{message}</p>
        </div>
      </div>
      <button type="button" className="gl-btn gl-btn-secondary gl-btn-sm shrink-0" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
