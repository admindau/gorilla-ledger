"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryCard, type CategoryType } from "@/components/categories/CategoryCard";
import { CategoryCommandCenter } from "@/components/categories/CategoryCommandCenter";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { DataLoadAlert } from "@/components/ui/DataLoadAlert";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
};

function sortCategories(items: Category[]) {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
}

function latestCategory(categories: Category[]) {
  if (categories.length === 0) return null;
  return [...categories].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const createNameRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<CategoryType>("expense");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CategoryType>("all");

  const categoryById = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.id, c] as const));
  }, [categories]);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setErrorMsg("");
      setLoadError(false);

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        console.error("Unable to verify the category session:", userError);
        setLoadError(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabaseBrowserClient
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Unable to load categories:", error);
        setLoadError(true);
        setLoading(false);
        return;
      }

      setCategories(data as Category[]);
      setLoading(false);
    }

    loadCategories();
  }, [loadVersion]);

  useEffect(() => {
    if (!createOpen) return;

    const t = window.setTimeout(() => {
      createNameRef.current?.focus();
    }, 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCreateOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createOpen]);

  function openCreateModal() {
    setErrorMsg("");
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (!saving) setCreateOpen(false);
  }

  function resetCreateForm() {
    setName("");
    setType("expense");
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setSaving(false);
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg("Category name is required.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabaseBrowserClient
      .from("categories")
      .insert({ user_id: user.id, name: trimmed, type })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setCategories((prev) => sortCategories([...prev, data as Category]));
    resetCreateForm();
    setSaving(false);
    setCreateOpen(false);
  }

  function beginEdit(id: string) {
    const c = categoryById[id];
    if (!c) return;
    setEditingId(id);
    setEditName(c.name);
    setEditType(c.type);
    setErrorMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditType("expense");
    setErrorMsg("");
  }

  async function handleSaveEdit(id: string) {
    setRowBusyId(id);
    setErrorMsg("");

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setRowBusyId(null);
      return;
    }

    const trimmed = editName.trim();
    if (!trimmed) {
      setErrorMsg("Category name is required.");
      setRowBusyId(null);
      return;
    }

    const existingCategory = categoryById[id];
    if (!existingCategory) {
      setErrorMsg("This category is no longer available. Refresh and try again.");
      setRowBusyId(null);
      return;
    }

    if (existingCategory.type !== editType) {
      const references = await Promise.all([
        supabaseBrowserClient
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("category_id", id),
        supabaseBrowserClient
          .from("budgets")
          .select("id", { count: "exact", head: true })
          .eq("category_id", id),
        supabaseBrowserClient
          .from("recurring_rules")
          .select("id", { count: "exact", head: true })
          .eq("category_id", id),
      ]);

      if (references.some((result) => result.error)) {
        console.error("Unable to verify category references:", references);
        setErrorMsg("We could not safely verify this category's usage. Its type was not changed.");
        setRowBusyId(null);
        return;
      }

      const referenceCount = references.reduce(
        (total, result) => total + (result.count ?? 0),
        0
      );
      if (referenceCount > 0) {
        setErrorMsg(
          "A category already used by transactions, budgets, or recurring rules cannot change type. Rename it or create a new category instead."
        );
        setRowBusyId(null);
        return;
      }
    }

    const { data, error } = await supabaseBrowserClient
      .from("categories")
      .update({ name: trimmed, type: editType })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setRowBusyId(null);
      return;
    }

    setCategories((prev) => sortCategories(prev.map((c) => (c.id === id ? (data as Category) : c))));
    setEditingId(null);
    setRowBusyId(null);
  }

  async function handleDeleteCategory(id: string) {
    const c = categoryById[id];
    if (!c) return;

    const ok = window.confirm(`Disable category "${c.name}"? Categories are disabled, not hard-deleted.`);
    if (!ok) return;

    setRowBusyId(id);
    setErrorMsg("");

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setRowBusyId(null);
      return;
    }

    const { count: activeRuleCount, error: recurringError } =
      await supabaseBrowserClient
        .from("recurring_rules")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id)
        .eq("is_active", true);

    if (recurringError) {
      console.error("Unable to verify recurring category usage:", recurringError);
      setErrorMsg("We could not safely verify this category's recurring rules. It was not disabled.");
      setRowBusyId(null);
      return;
    }

    if ((activeRuleCount ?? 0) > 0) {
      setErrorMsg(
        "Pause or delete the active recurring rules using this category before disabling it."
      );
      setRowBusyId(null);
      return;
    }

    const { error } = await supabaseBrowserClient
      .from("categories")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setRowBusyId(null);
      return;
    }

    setCategories((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
    setRowBusyId(null);
  }

  const normalizedQ = q.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (normalizedQ && !c.name.toLowerCase().includes(normalizedQ)) return false;
      return true;
    });
  }, [categories, typeFilter, normalizedQ]);

  const incomeCategories = filteredCategories.filter((c) => c.type === "income");
  const expenseCategories = filteredCategories.filter((c) => c.type === "expense");
  const latest = latestCategory(categories);
  const latestName = latest?.name ?? "None yet";

  function clearCommandBar() {
    setQ("");
    setTypeFilter("all");
  }

  function renderCategoryCard(cat: Category) {
    return (
      <CategoryCard
        key={cat.id}
        category={cat}
        isEditing={editingId === cat.id}
        isBusy={rowBusyId === cat.id}
        editName={editName}
        editType={editType}
        onBeginEdit={() => beginEdit(cat.id)}
        onCancelEdit={cancelEdit}
        onSaveEdit={() => handleSaveEdit(cat.id)}
        onDelete={() => handleDeleteCategory(cat.id)}
        onEditNameChange={setEditName}
        onEditTypeChange={setEditType}
      />
    );
  }

  return (
    <div className="gl-page-migrated">
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Add Category">
          <button type="button" aria-label="Close modal" onClick={closeCreateModal} className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-lg rounded-3xl border border-gray-800 bg-black/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">New category</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Add Category</h2>
                <p className="mt-1 text-xs text-gray-400">Create a reusable income or expense label.</p>
              </div>
              <button type="button" onClick={closeCreateModal} disabled={saving} className="gl-btn gl-btn-secondary gl-btn-sm">
                Close
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-400">Name</label>
                <input
                  ref={createNameRef}
                  type="text"
                  className="gl-input"
                  placeholder="e.g. Salary, Rent, Food, Transport"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-gray-400">Type</label>
                <select className="gl-input" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (saving) return;
                    resetCreateForm();
                    setCreateOpen(false);
                  }}
                  disabled={saving}
                  className="gl-btn gl-btn-secondary gl-btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="gl-btn gl-btn-primary gl-btn-sm">
                  {saving ? "Saving..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <PageShell size="xl" className="gl-page-stack">
        <PageHeader
          title="Categories"
          description="Organize income and expenses for transactions and budgets."
          action={
            <button type="button" onClick={openCreateModal} className="gl-btn gl-btn-primary gl-btn-sm">
              Add Category
            </button>
          }
        />

        <section className="gl-category-toolbar" aria-label="Category filters">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Category list</p>
            <p className="mt-1 text-sm text-gray-300">
              Showing <span className="font-semibold text-white">{filteredCategories.length}</span> of {categories.length}
            </p>
          </div>
          <div className="gl-category-toolbar-controls">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
              className="gl-input"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | CategoryType)}
              aria-label="Filter categories by type"
              className="gl-input"
            >
              <option value="all">All categories</option>
              <option value="income">Income only</option>
              <option value="expense">Expenses only</option>
            </select>
            {(q || typeFilter !== "all") ? (
              <button type="button" onClick={clearCommandBar} className="gl-btn gl-btn-secondary gl-btn-sm">
                Clear
              </button>
            ) : null}
          </div>
        </section>

        {loadError ? <DataLoadAlert onRetry={() => setLoadVersion((value) => value + 1)} /> : null}
        {errorMsg ? <p className="rounded-2xl border border-red-900/70 bg-red-950/20 p-3 text-sm text-red-300">{errorMsg}</p> : null}

        <CategoryCommandCenter
          totalCategories={categories.length}
          incomeCategories={categories.filter((c) => c.type === "income").length}
          expenseCategories={categories.filter((c) => c.type === "expense").length}
          recentlyAddedLabel={latestName}
          dataState={loading ? "loading" : loadError ? "error" : "ready"}
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Income categories</h2>
              </div>
              <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1 text-xs text-gray-300">{incomeCategories.length}</span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading categories...</p>
            ) : loadError ? (
              <p className="text-sm text-gray-500">Category records are unavailable.</p>
            ) : incomeCategories.length === 0 ? (
              <EmptyState
                compact
                title="No income categories yet"
                description="Create an income category for transactions and reports."
                action={
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full border border-white/10 px-3 py-1">Salary</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Business Income</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Allowance</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Investments</span>
                  </div>
                }
              />
            ) : (
              <div className="space-y-3">{incomeCategories.map(renderCategoryCard)}</div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Expense categories</h2>
              </div>
              <span className="rounded-full border border-gray-800 bg-black/40 px-3 py-1 text-xs text-gray-300">{expenseCategories.length}</span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading categories...</p>
            ) : loadError ? (
              <p className="text-sm text-gray-500">Category records are unavailable.</p>
            ) : expenseCategories.length === 0 ? (
              <EmptyState
                compact
                title="No expense categories yet"
                description="Create an expense category for transactions and budgets."
                action={
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full border border-white/10 px-3 py-1">Housing</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Utilities</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Transport</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Subscriptions</span>
                  </div>
                }
              />
            ) : (
              <div className="space-y-3">{expenseCategories.map(renderCategoryCard)}</div>
            )}
          </div>
        </section>
      </PageShell>
    </div>
  );
}
