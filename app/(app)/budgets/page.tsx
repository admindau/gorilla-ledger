"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type Budget = {
  id: string;
  wallet_id: string | null;
  category_id: string;
  year: number;
  month: number;
  amount_minor: number;
  created_at: string;
};

function parseAmountToMinor(amount: string): number {
  const cleaned = amount.replace(",", "").trim();
  const [whole, fractional = ""] = cleaned.split(".");
  const fracPadded = (fractional + "00").slice(0, 2);
  const wholeNum = Number(whole) || 0;
  const fracNum = Number(fracPadded) || 0;
  return wholeNum * 100 + fracNum;
}

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

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

export default function BudgetsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Header/security UI state
  const [userEmail, setUserEmail] = useState<string>("");
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [lastSecurityCheckDays, setLastSecurityCheckDays] = useState<number | null>(null);

  // Form + filter state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");

  // Edit state (per-row)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("0");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHeaderSecurity() {
      try {
        const {
          data: { user },
        } = await supabaseBrowserClient.auth.getUser();

        setUserEmail(user?.email ?? "");

        const { data: factorsData } = await supabaseBrowserClient.auth.mfa.listFactors();
        const totpCount = factorsData?.totp?.length ?? 0;
        const enabled = totpCount > 0;
        setMfaEnabled(enabled);

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
        // ignore
      }
    }

    loadHeaderSecurity();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view budgets.");
        setLoading(false);
        return;
      }

      const { data: walletData, error: walletError } = await supabaseBrowserClient
        .from("wallets")
        .select("id, name, currency_code")
        .order("created_at", { ascending: true });

      if (walletError) {
        console.error(walletError);
        setErrorMsg(walletError.message);
        setLoading(false);
        return;
      }
      setWallets(walletData as Wallet[]);

      const { data: categoryData, error: categoryError } = await supabaseBrowserClient
        .from("categories")
        .select("id, name, type")
        .eq("is_active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (categoryError) {
        console.error(categoryError);
        setErrorMsg(categoryError.message);
        setLoading(false);
        return;
      }
      setCategories(categoryData as Category[]);

      const { data: budgetData, error: budgetError } = await supabaseBrowserClient
        .from("budgets")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (budgetError) {
        console.error(budgetError);
        setErrorMsg(budgetError.message);
        setLoading(false);
        return;
      }

      setBudgets(budgetData as Budget[]);

      if (walletData && walletData.length > 0 && !walletId) setWalletId(walletData[0].id);
      if (categoryData && categoryData.length > 0 && !categoryId) setCategoryId(categoryData[0].id);

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    try {
      await supabaseBrowserClient.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  const walletMap = useMemo(() => Object.fromEntries(wallets.map((w) => [w.id, w] as const)), [
    wallets,
  ]);
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  const budgetsForPeriod = useMemo(() => budgets.filter((b) => b.year === year && b.month === month), [
    budgets,
    year,
    month,
  ]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    if (!walletId) {
      setErrorMsg("Please select a wallet.");
      setSaving(false);
      return;
    }
    if (!categoryId) {
      setErrorMsg("Please select a category.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setSaving(false);
      return;
    }

    const amount_minor = parseAmountToMinor(amount);

    const { data, error } = await supabaseBrowserClient
      .from("budgets")
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        category_id: categoryId,
        year,
        month,
        amount_minor,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setBudgets((prev) => [data as Budget, ...prev]);
    setAmount("0");
    setSaving(false);
  }

  function beginEdit(budget: Budget) {
    setEditingId(budget.id);
    setEditAmount(formatMinorToAmount(budget.amount_minor));
    setErrorMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("0");
    setErrorMsg("");
  }

  async function handleSaveEdit(budget: Budget) {
    setRowBusyId(budget.id);
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

    const amount_minor = parseAmountToMinor(editAmount);

    const { data, error } = await supabaseBrowserClient
      .from("budgets")
      .update({ amount_minor })
      .eq("id", budget.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setRowBusyId(null);
      return;
    }

    setBudgets((prev) => prev.map((b) => (b.id === budget.id ? (data as Budget) : b)));
    setEditingId(null);
    setRowBusyId(null);
  }

  async function handleDeleteBudget(budget: Budget) {
    const cat = categoryMap[budget.category_id];
    const ok = window.confirm(`Delete budget${cat ? ` for "${cat.name}"` : ""}?`);
    if (!ok) return;

    setRowBusyId(budget.id);
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
      .from("budgets")
      .delete()
      .eq("id", budget.id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setRowBusyId(null);
      return;
    }

    setBudgets((prev) => prev.filter((b) => b.id !== budget.id));
    if (editingId === budget.id) cancelEdit();
    setRowBusyId(null);
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
      {/* Hardened header (tight app-shell) */}
      <header className="w-full border-b border-gray-900 bg-black/80 backdrop-blur">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="font-semibold tracking-tight truncate">Gorilla Ledger™</div>

              <nav className="hidden md:flex items-center gap-2">
                <NavLink href="/wallets" label="Wallets" />
                <NavLink href="/categories" label="Categories" />
                <NavLink href="/transactions" label="Transactions" />
                <NavLink href="/budgets" label="Budgets" active />
                <NavLink href="/recurring" label="Recurring" />
                <NavLink href="/settings/security" label="Security" />
                <NavLink href="/dashboard" label="Dashboard" />
              </nav>
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

          {/* Mobile nav */}
          <nav className="md:hidden mt-2 flex flex-wrap gap-2">
            <NavLink href="/wallets" label="Wallets" />
            <NavLink href="/categories" label="Categories" />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/budgets" label="Budgets" active />
            <NavLink href="/recurring" label="Recurring" />
            <NavLink href="/settings/security" label="Security" />
            <NavLink href="/dashboard" label="Dashboard" />
          </nav>

          {/* Security posture */}
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

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Planning</div>
          <h1 className="text-2xl font-semibold leading-tight">Budgets</h1>
          <p className="text-sm text-gray-400 mt-1">
            Define monthly budgets per wallet and category.
          </p>
        </div>

        {errorMsg && <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>}

        <section className="mb-4 flex flex-wrap gap-4 items-center text-sm">
          <div>
            <label className="block text-xs mb-1">Year</label>
            <input
              type="number"
              className="w-24 p-1 rounded bg-gray-900 border border-gray-700"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Month</label>
            <select
              className="w-32 p-1 rounded bg-gray-900 border border-gray-700"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
          </div>
          <div className="text-gray-400 mt-4 md:mt-6">
            Viewing budgets for <span className="font-semibold">{monthLabel}</span>
          </div>
        </section>

        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add Budget</h2>

          {wallets.length === 0 || categories.length === 0 ? (
            <p className="text-sm text-yellow-300">
              You need at least one wallet and one category to set a budget.
            </p>
          ) : (
            <form onSubmit={handleCreateBudget} className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm mb-1">Wallet</label>
                <select
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Category</label>
                <select
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Budget Amount</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-white text-black font-semibold"
                >
                  {saving ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Budgets for {monthLabel}</h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : budgetsForPeriod.length === 0 ? (
            <p className="text-gray-500 text-sm">You have no budgets set for this period yet.</p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {budgetsForPeriod.map((b) => {
                const wallet = b.wallet_id ? walletMap[b.wallet_id] : null;
                const category = categoryMap[b.category_id];
                const currency = wallet?.currency_code ?? "";
                const isEditing = editingId === b.id;
                const isBusy = rowBusyId === b.id;

                return (
                  <div key={b.id} className="px-4 py-3">
                    {!isEditing ? (
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {category ? category.name : "Unknown category"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {wallet ? wallet.name : "All wallets"} • {currency || "—"} • {year}-
                            {String(month).padStart(2, "0")}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="font-semibold">
                            {formatMinorToAmount(b.amount_minor)} {currency}
                          </div>
                          <button
                            type="button"
                            onClick={() => beginEdit(b)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded border border-gray-700 text-sm text-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded border border-red-900 text-sm text-red-300"
                          >
                            {isBusy ? "Working..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3 items-end">
                        <div className="md:col-span-2">
                          <div className="text-xs text-gray-400 mb-1">
                            {category ? category.name : "Unknown category"} •{" "}
                            {wallet ? wallet.name : "All wallets"} • {currency || "—"}
                          </div>
                          <label className="block text-xs mb-1 text-gray-400">Amount</label>
                          <input
                            type="text"
                            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                          />
                        </div>

                        <div className="flex gap-2 md:justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(b)}
                            disabled={isBusy}
                            className="px-3 py-2 rounded bg-white text-black font-semibold"
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isBusy}
                            className="px-3 py-2 rounded border border-gray-700 text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
