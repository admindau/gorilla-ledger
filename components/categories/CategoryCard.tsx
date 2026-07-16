export type CategoryType = "income" | "expense";

export type CategoryCardItem = {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
};

type CategoryCardProps = {
  category: CategoryCardItem;
  isEditing: boolean;
  isBusy: boolean;
  editName: string;
  editType: CategoryType;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditNameChange: (value: string) => void;
  onEditTypeChange: (value: CategoryType) => void;
};

function formatDate(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(t));
}

export function CategoryCard({
  category,
  isEditing,
  isBusy,
  editName,
  editType,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditNameChange,
  onEditTypeChange,
}: CategoryCardProps) {
  const isIncome = category.type === "income";

  if (isEditing) {
    return (
      <article className="gl-premium-card p-4">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-gray-400">Name</label>
            <input className="gl-input" value={editName} onChange={(e) => onEditNameChange(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Type</label>
            <select
              className="gl-input"
              value={editType}
              onChange={(e) => onEditTypeChange(e.target.value as CategoryType)}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={onSaveEdit} disabled={isBusy} className="gl-btn gl-btn-primary gl-btn-sm">
              {isBusy ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onCancelEdit} disabled={isBusy} className="gl-btn gl-btn-secondary gl-btn-sm">
              Cancel
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="gl-premium-card group p-4 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-gray-800 bg-white/[0.04] text-base">
              {isIncome ? "↗" : "↘"}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">{category.name}</h3>
              <p className="mt-0.5 text-xs text-gray-500">Created {formatDate(category.created_at)}</p>
            </div>
          </div>
        </div>
        <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gray-300">
          {category.type}
        </span>
      </div>

      <div className="mt-4 text-xs">
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-3">
          <p className="text-gray-500">Status</p>
          <p className="mt-1 font-medium text-gray-200">{category.is_active ? "Active" : "Inactive"}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-gray-900 pt-3">
        <button type="button" onClick={onBeginEdit} disabled={isBusy} className="gl-btn gl-btn-secondary gl-btn-sm">
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          className="rounded-full border border-red-900/80 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10"
        >
          {isBusy ? "Working..." : "Delete"}
        </button>
      </div>
    </article>
  );
}
