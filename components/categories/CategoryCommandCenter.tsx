import { Card } from "@/components/ui/Card";
import { MetricGridState, type DataState } from "@/components/ui/MetricGridState";

type CategoryCommandCenterProps = {
  totalCategories: number;
  incomeCategories: number;
  expenseCategories: number;
  recentlyAddedLabel: string;
  dataState?: DataState;
};

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <Card variant="premium" className="min-w-0 p-3 sm:p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">{label}</p>
      <div className="mt-2 break-words text-xl font-semibold text-white sm:mt-3 sm:text-2xl">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </Card>
  );
}

export function CategoryCommandCenter({
  totalCategories,
  incomeCategories,
  expenseCategories,
  recentlyAddedLabel,
  dataState = "ready",
}: CategoryCommandCenterProps) {
  if (dataState !== "ready") return <MetricGridState state={dataState} />;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <MetricCard label="Total categories" value={totalCategories} helper="Active taxonomy" />
      <MetricCard label="Income" value={incomeCategories} helper="Income classification" />
      <MetricCard label="Expenses" value={expenseCategories} helper="Expense classification" />
      <MetricCard label="Recently added" value={recentlyAddedLabel} helper="Latest category" />
    </section>
  );
}
