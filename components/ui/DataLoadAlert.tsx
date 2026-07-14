type DataLoadAlertProps = {
  message?: string;
  onRetry: () => void;
};

export function DataLoadAlert({
  message = "We could not verify the latest ledger data. No unverified totals are being shown.",
  onRetry,
}: DataLoadAlertProps) {
  return (
    <div className="gl-alert-error flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <span>{message}</span>
      <button type="button" className="gl-btn gl-btn-secondary gl-btn-sm shrink-0" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
