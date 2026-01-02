"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type CategoryType = "income" | "expense";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
};

function formatDaysAgo(days: number) {
  if (days <= 0) return "0 day(s) ago";
  if (days === 1) return "1 day ago";
  return `${days} day(s) ago`;
}

function computeDaysAgo(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  const diffDays = Math.floor((now - t) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // create form state
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [saving, setSaving] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<CategoryType>("expense");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  // header/security UI state
  const [userEmail, setUserEmail] = useState<string>("");
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [lastSecurityCheckDays, setLastSecurityCheckDays] = useState<number | null>(null);

  const categoryById = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.id, c] as const));
  }, [categories]);

  useEffect(() => {
    async function loadHeaderSecurity() {
      try {
        const {
          data: { user },
        } = await supabaseBrowserClient.auth.getUser();

        setUserEmail(user?.email ?? "");

        // MFA enabled status = enrolled TOTP factor(s)
        const { data: factorsData } = await supabaseBrowserClient.auth.mfa.listFactors();
        const totpCount = factorsData?.totp?.length ?? 0;
        const enabled = totpCount > 0;
        setMfaEnabled(enabled);

        // "Last security check" heuristic:
        // If user is currently AAL2, we stamp/refresh a local marker.
        const { data: aal } = await supabaseBrowserClient.auth.mfa.getAuthenticatorAssuranceLevel();
        const isAAL2 = aal?.currentLevel === "aal2";

        const key = "gl_last_security_check_at";
        if (enabled && isAAL2) {
          const nowIso = new Date().toISOString();
          localStorage.setItem(key, nowIso);
        }

        const existing = localStorage.getItem(key);
        if (existing) {
          const d = computeDaysAgo(existing);
          setLastSecurityCheckDays(d);
        } else {
          setLastSecurityCheckDays(null);
        }
      } catch {
        // Non-fatal; header will still render
      }
    }

    loadHeaderSecurity();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view categories.");
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
        console.error(error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setCategories(data as Category[]);
      setLoading(false);
    }

    loadCategories();
  }, []);

  async function handleLogout() {
    try {
      await supabaseBrowserClient.auth.signOut();
    } finally {
      window.location.href = "/";
    }
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

    const { data, error } = await supabaseBrowserClient
      .from("categories")
      .insert({
        user_id: user.id,
        name,
        type,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setCategories((prev) => [...prev, data as Category]);
    setName("");
    setType("expense");
    setSaving(false);
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

    const { data, error } = await supabaseBrowserClient
      .from("categories")
      .update({ name: editName, type: editType })
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

    setCategories((prev) => prev.map((c) => (c.id === id ? (data as Category) : c)));
    setEditingId(null);
    setRowBusyId(null);
  }

  async function handleDeleteCategory(id: string) {
    const c = categoryById[id];
    if (!c) return;

    const ok = window.confirm(
      `Disable category "${c.name}"? (Recommended: categories are disabled, not hard-deleted.)`
    );
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

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  function renderCategoryRow(cat: Category) {
    const isEditing = editingId === cat.id;
    const isBusy = rowBusyId === cat.id;

    return (
      <li key={cat.id} className="px-4 py-2.5 text-sm">
        {!isEditing ? (
          <div className="flex items-center justify-between gap-3">
            <div className="truncate">{cat.name}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => beginEdit(cat.id)}
                disabled={isBusy}
                className="px-3 py-1.5 rounded border border-gray-700 text-xs text-gray-200 hover:bg-white/5"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCategory(cat.id)}
                disabled={isBusy}
                className="px-3 py-1.5 rounded border border-red-900 text-xs text-red-300 hover:bg-red-500/10"
              >
                {isBusy ? "Working..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs mb-1 text-gray-400">Name</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-400">Type</label>
              <select
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={editType}
                onChange={(e) => setEditType(e.target.value as CategoryType)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="md:col-span-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => handleSaveEdit(cat.id)}
                disabled={isBusy}
                className="px-3 py-2 rounded bg-white text-black font-semibold"
              >
                {isBusy ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isBusy}
                className="px-3 py-2 rounded border border-gray-700 text-gray-200 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  const NavLink = ({
    href,
    label,
    active,
  }: {
    href: string;
    label: string;
    active?: boolean;
  }) => {
    return (
      <a
        href={href}
        className={[
          "px-2.5 py-1.5 rounded-md border text-xs transition",
          active
            ? "border-white/30 bg-white/10 text-white"
            : "border-gray-800 bg-black/40 text-gray-300 hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        {label}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Tightened header (less link-bar, more app-shell) */}
      <header className="w-full border-b border-gray-900 bg-black/80 backdrop-blur">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="font-semibold tracking-tight truncate">Gorilla Ledger™</div>
              <div className="hidden md:flex items-center gap-2">
                <NavLink href="/wallets" label="Wallets" />
                <NavLink href="/categories" label="Categories" active />
                <NavLink href="/transactions" label="Transactions" />
                <NavLink href="/budgets" label="Budgets" />
                <NavLink href="/recurring" label="Recurring" />
                <NavLink href="/settings/security" label="Security" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userEmail ? (
                <div className="hidden sm:flex items-center gap-2 max-w-[260px]">
                  <span className="text-[11px] text-gray-400">Signed in</span>
                  <span className="text-xs text-gray-200 truncate">{userEmail}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-200 hover:bg-white/5"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile nav (kept compact) */}
          <div className="md:hidden mt-2 flex flex-wrap gap-2">
            <NavLink href="/wallets" label="Wallets" />
            <NavLink href="/categories" label="Categories" active />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/budgets" label="Budgets" />
            <NavLink href="/recurring" label="Recurring" />
            <NavLink href="/settings/security" label="Security" />
          </div>

          {/* Security posture line (tight) */}
          <div className="mt-2 text-[11px] text-gray-300 flex flex-wrap gap-x-2 gap-y-1">
            <span className="text-gray-400">MFA:</span>
            <span className={mfaEnabled ? "text-emerald-400" : "text-gray-300"}>
              {mfaEnabled ? "Enabled" : "Not enabled"}
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">Last security check:</span>
            {lastSecurityCheckDays === null ? (
              <span className="text-gray-500">—</span>
            ) : (
              <span className="text-gray-200">{formatDaysAgo(lastSecurityCheckDays)}</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        {/* Tightened page header */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Configuration</div>
          <h1 className="text-2xl font-semibold leading-tight">Categories</h1>
          <p className="text-sm text-gray-400 mt-1">
            Organize your income and expenses by category.
          </p>
        </div>

        {errorMsg && <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>}

        <section className="mb-8 border border-gray-800 rounded p-4 bg-black/40">
          <h2 className="text-sm font-semibold mb-3">Add a Category</h2>

          <form onSubmit={handleCreateCategory} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs mb-1 text-gray-400">Name</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                placeholder="e.g. Salary, Rent, Food, Transport"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-gray-400">Type</label>
              <select
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={type}
                onChange={(e) => setType(e.target.value as CategoryType)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-white text-black font-semibold"
              >
                {saving ? "Saving..." : "Create Category"}
              </button>
            </div>
          </form>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-semibold">Income</h2>
              <span className="text-[11px] text-gray-500">{incomeCategories.length}</span>
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">Loading categories...</p>
            ) : incomeCategories.length === 0 ? (
              <p className="text-gray-500 text-sm">You don&apos;t have any income categories yet.</p>
            ) : (
              <ul className="border border-gray-800 rounded divide-y divide-gray-800 bg-black/40">
                {incomeCategories.map(renderCategoryRow)}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-semibold">Expenses</h2>
              <span className="text-[11px] text-gray-500">{expenseCategories.length}</span>
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">Loading categories...</p>
            ) : expenseCategories.length === 0 ? (
              <p className="text-gray-500 text-sm">You don&apos;t have any expense categories yet.</p>
            ) : (
              <ul className="border border-gray-800 rounded divide-y divide-gray-800 bg-black/40">
                {expenseCategories.map(renderCategoryRow)}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
