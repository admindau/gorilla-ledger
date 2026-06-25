import { Card } from "@/components/ui/Card";

type CategoryInsightsProps = {
  totalCategories: number;
  incomeCategories: number;
  expenseCategories: number;
  latestCategoryName: string;
  filteredCount: number;
};

export function CategoryInsights({
  totalCategories,
  incomeCategories,
  expenseCategories,
  latestCategoryName,
  filteredCount,
}: CategoryInsightsProps) {
  const hasBalance = incomeCategories > 0 && expenseCategories > 0;

  return (
    <Card variant="premium" className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Category intelligence</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Classification health</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Categories keep transactions readable, searchable, and ready for sharper spending insights.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-300">
          <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">{filteredCount} visible</span>
          <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1">{hasBalance ? "Balanced" : "Needs coverage"}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
          <p className="text-xs text-gray-500">Coverage</p>
          <p className="mt-2 text-sm text-gray-200">
            {totalCategories > 0
              ? `${totalCategories} active categories are available for transaction tagging.`
              : "No active categories are configured yet."}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
          <p className="text-xs text-gray-500">Balance</p>
          <p className="mt-2 text-sm text-gray-200">
            {hasBalance
              ? "Income and expense classification are both represented."
              : "Add both income and expense categories for a fuller ledger view."}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
          <p className="text-xs text-gray-500">Latest signal</p>
          <p className="mt-2 text-sm text-gray-200">Latest category: {latestCategoryName}</p>
        </div>
      </div>
    </Card>
  );
}
