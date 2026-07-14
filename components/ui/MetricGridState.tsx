import Skeleton from "@/components/ui/Skeleton";

export type DataState = "loading" | "ready" | "error";

type MetricGridStateProps = {
  state: Exclude<DataState, "ready">;
  count?: number;
};

export function MetricGridState({ state, count = 4 }: MetricGridStateProps) {
  if (state === "error") {
    return (
      <section className="gl-premium-card p-5" role="status">
        <p className="text-[11px] uppercase tracking-[0.22em] text-red-300/80">
          Data unavailable
        </p>
        <p className="mt-2 text-sm text-white/70">
          No totals are shown because this financial data could not be verified.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-4" aria-label="Loading financial summary">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="gl-premium-card p-4" aria-hidden="true">
          <Skeleton className="h-3 w-24" rounded="full" />
          <Skeleton className="mt-4 h-8 w-32" rounded="lg" />
          <Skeleton className="mt-3 h-3 w-20" rounded="full" />
        </div>
      ))}
    </section>
  );
}
