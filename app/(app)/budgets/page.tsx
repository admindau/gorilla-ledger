"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetCommandCenter, type BudgetSummary } from "@/components/budgets/BudgetCommandCenter";
import { BudgetInsights } from "@/components/budgets/BudgetInsights";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataLoadAlert } from "@/components/ui/DataLoadAlert";
import { PrerequisiteGuide } from "@/components/activation/PrerequisiteGuide";

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

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

const BUDGET_TRANSACTION_PAGE_SIZE = 1000;

async function loadAllExpenseTransactions(): Promise<{
  data: Transaction[];
  error: string | null;
}> {
  const rows: Transaction[] = [];

  for (let from = 0; ; from += BUDGET_TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .select("id, wallet_id, category_id, type, amount_minor, currency_code, occurred_at")
      .eq("type", "expense")
      .order("occurred_at", { ascending: false })
      .range(from, from + BUDGET_TRANSACTION_PAGE_SIZE - 1);

    if (error) return { data: [], error: error.message };
    const page = (data ?? []) as Transaction[];
    rows.push(...page);
    if (page.length < BUDGET_TRANSACTION_PAGE_SIZE) return { data: rows, error: null };
  }
}

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

function computeDaysAgo(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  const diffDays = Math.floor((now - t) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function BudgetsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Header/security UI state
  const [, setUserEmail] = useState<string>("");
  const [, setMfaEnabled] = useState<boolean>(false);
  const [, setLastSecurityCheckDays] = useState<number | null>(null);

  // Form + filter state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      setLoadError(false);

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        console.error("Unable to verify the budget session:", userError);
        setLoadError(true);
        setLoading(false);
        return;
      }

      const [walletResult, categoryResult, budgetResult, transactionResult] = await Promise.all([
        supabaseBrowserClient.from("wallets").select("id, name, currency_code").order("created_at", { ascending: true }),
        supabaseBrowserClient.from("categories").select("id, name, type").eq("is_active", true).order("type", { ascending: true }).order("name", { ascending: true }),
        supabaseBrowserClient.from("budgets").select("*").order("year", { ascending: false }).order("month", { ascending: false }).order("created_at", { ascending: false }).limit(200),
        loadAllExpenseTransactions(),
      ]);

      const { data: walletData, error: walletError } = walletResult;
      const { data: categoryData, error: categoryError } = categoryResult;
      const { data: budgetData, error: budgetError } = budgetResult;
      const transactionData = transactionResult.data;
      const transactionError = transactionResult.error;

      if (walletError || categoryError || budgetError || transactionError) {
        console.error("Unable to certify budget data:", {
          walletError,
          categoryError,
          budgetError,
          transactionError,
        });
        setLoadError(true);
        setLoading(false);
        return;
      }
      setWallets(walletData as Wallet[]);
      setCategories(categoryData as Category[]);
      setBudgets(budgetData as Budget[]);
      setTransactions(transactionData as Transaction[]);

      if (walletData && walletData.length > 0 && !walletId) setWalletId(walletData[0].id);
      const initialExpenseCategory = (categoryData as Category[] | null)?.find((category) => category.type === "expense");
      if (initialExpenseCategory && !categoryId) setCategoryId(initialExpenseCategory.id);

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVersion]);

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

  const budgetSummaries = useMemo<BudgetSummary[]>(() => {
    const selectedMonthKey = monthKeyFromParts(year, month);

    return budgetsForPeriod.map((budget) => {
      const matchingSpend = transactions
        .filter((tx) => {
          const sameMonth = tx.occurred_at.slice(0, 7) === selectedMonthKey;
          const sameCategory = tx.category_id === budget.category_id;
          const sameWallet = budget.wallet_id ? tx.wallet_id === budget.wallet_id : true;
          return sameMonth && sameCategory && sameWallet;
        })
        .reduce((sum, tx) => sum + tx.amount_minor, 0);

      const remainingMinor = budget.amount_minor - matchingSpend;
      const usedRatio = budget.amount_minor > 0 ? matchingSpend / budget.amount_minor : 0;

      return {
        id: budget.id,
        amountMinor: budget.amount_minor,
        actualMinor: matchingSpend,
        remainingMinor,
        usedRatio,
        currencyCode: budget.wallet_id ? walletMap[budget.wallet_id]?.currency_code ?? null : null,
        wallet: budget.wallet_id ? walletMap[budget.wallet_id] ?? null : null,
        category: categoryMap[budget.category_id] ?? null,
      };
    });
  }, [budgetsForPeriod, categoryMap, month, transactions, walletMap, year]);

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
    if (categoryMap[categoryId]?.type !== "expense") {
      setErrorMsg("Budgets require an expense category.");
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
    if (!Number.isSafeInteger(amount_minor) || amount_minor <= 0) {
      setErrorMsg("Enter a budget amount greater than zero.");
      setSaving(false);
      return;
    }

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
    setShowCreateForm(false);
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

  return (
    <div className="gl-page-migrated">
      <main className="gl-page-shell max-w-5xl">
        <PageHeader
          eyebrow="Planning"
          title="Budget Command Center"
          description="Set monthly targets, monitor budget health and identify spending pressure across wallets."
          action={
            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="gl-btn gl-btn-primary gl-btn-sm"
            >
              {showCreateForm ? "Hide Form" : "+ Create Budget"}
            </button>
          }
        />

        {loadError ? <DataLoadAlert onRetry={() => setLoadVersion((value) => value + 1)} /> : null}
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}

        <section className="gl-inner-card rounded-2xl p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Year</label>
                <input
                  type="number"
                  className="gl-input w-28 py-1"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || year)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Month</label>
                <select
                  className="gl-input w-40 py-1"
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
            </div>

            <div className="text-sm text-gray-400">
              Viewing budget health for <span className="font-semibold text-white">{monthLabel}</span>
            </div>
          </div>
        </section>

        <BudgetCommandCenter
          summaries={budgetSummaries}
          monthLabel={monthLabel}
          dataState={loading ? "loading" : loadError ? "error" : "ready"}
        />

        {!loading && !loadError ? <BudgetInsights summaries={budgetSummaries} /> : null}

        <section className="gl-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Budget Setup</p>
              <h2 className="mt-1 text-lg font-semibold">Create Budget</h2>
              <p className="mt-1 text-sm text-gray-400">
                Add a monthly target for a wallet and expense category.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="gl-btn gl-btn-secondary gl-btn-sm"
            >
              {showCreateForm ? "Collapse" : "Open Form"}
            </button>
          </div>

          {showCreateForm ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              {wallets.length === 0 || !categories.some((category) => category.type === "expense") ? (
                <PrerequisiteGuide
                  title="Prepare the ledger before creating a budget"
                  items={[
                    { label: "Wallet", complete: wallets.length > 0, href: "/wallets", actionLabel: "Add wallet" },
                    { label: "Expense category", complete: categories.some((category) => category.type === "expense"), href: "/categories", actionLabel: "Add expense category" },
                  ]}
                />
              ) : (
                <form onSubmit={handleCreateBudget} className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm">Wallet</label>
                    <select
                      className="gl-input"
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
                    <label className="mb-1 block text-sm">Category</label>
                    <select
                      className="gl-input"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {categories.filter((category) => category.type === "expense").map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm">Budget Amount</label>
                    <input
                      type="text"
                      className="gl-input"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="gl-btn gl-btn-primary gl-btn-md"
                    >
                      {saving ? "Saving..." : "Save Budget"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Budget Health</p>
              <h2 className="mt-1 text-lg font-semibold">Budgets for {monthLabel}</h2>
            </div>
            <p className="text-sm text-gray-500">
              {budgetSummaries.length} active budget{budgetSummaries.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : loadError ? (
            <p className="text-sm text-gray-500">Budget records are unavailable.</p>
          ) : budgetsForPeriod.length === 0 ? (
            <EmptyState
              eyebrow="Budget Command Center"
              title="No budgets yet"
              description="Create your first budget and start tracking spending goals for this month."
              action={
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="gl-btn gl-btn-primary gl-btn-sm"
                >
                  Create Budget
                </button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {budgetsForPeriod.map((budget) => {
                const summary = budgetSummaries.find((item) => item.id === budget.id);
                const isEditing = editingId === budget.id;
                const isBusy = rowBusyId === budget.id;

                if (!summary) return null;

                return (
                  <BudgetCard
                    key={budget.id}
                    summary={{
                      ...summary,
                      year: budget.year,
                      month: budget.month,
                    }}
                    isEditing={isEditing}
                    isBusy={isBusy}
                    editAmount={editAmount}
                    onEditAmountChange={setEditAmount}
                    onBeginEdit={() => beginEdit(budget)}
                    onSaveEdit={() => handleSaveEdit(budget)}
                    onCancelEdit={cancelEdit}
                    onDelete={() => handleDeleteBudget(budget)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
