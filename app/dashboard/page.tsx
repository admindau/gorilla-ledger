"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import SpendingByCategoryChart from "@/components/dashboard/SpendingByCategoryChart";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
  starting_balance_minor: number;
};

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
  type: TransactionType;
};

type Budget = {
  id: string;
  wallet_id: string | null;
  category_id: string | null;
  amount_minor: number;
  currency_code: string;
  month: string; // "YYYY-MM"
};

type CurrencyTotal = {
  currency_code: string;
  total_minor: number;
};

type BudgetSummary = {
  budget: Budget;
  wallet: Wallet | null;
  category: Category | null;
  actualMinor: number;
  remainingMinor: number;
  usedRatio: number;
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function DashboardPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [email, setEmail] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Month label for static overview text
  const now = new Date();
  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    async function load() {
      try {
        // 1) Check session
        const {
          data: { session },
        } = await supabaseBrowserClient.auth.getSession();

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        setEmail(session.user.email ?? null);
        setCheckingSession(false);

        // 2) Load wallets, categories, transactions, budgets
        setLoadingData(true);

        const [walletRes, categoryRes, txRes, budgetRes] = await Promise.all([
          supabaseBrowserClient
            .from("wallets")
            .select("id, name, currency_code, starting_balance_minor")
            .order("created_at", { ascending: true }),
          supabaseBrowserClient
            .from("categories")
            .select("id, name, type")
            .eq("is_active", true)
            .order("type", { ascending: true })
            .order("name", { ascending: true }),
          supabaseBrowserClient
            .from("transactions")
            .select(
              "id, wallet_id, category_id, type, amount_minor, currency_code, occurred_at"
            )
            .order("occurred_at", { ascending: false }),
          supabaseBrowserClient
            .from("budgets")
            .select(
              "id, wallet_id, category_id, amount_minor, currency_code, month"
            )
            .eq("month", monthKey),
        ]);

        if (walletRes.error || categoryRes.error || txRes.error || budgetRes.error) {
          console.error("Error loading dashboard data", {
            walletError: walletRes.error,
            categoryError: categoryRes.error,
            txError: txRes.error,
            budgetError: budgetRes.error,
          });
          setErrorMsg("Failed to load dashboard data.");
          return;
        }

        setWallets((walletRes.data ?? []) as Wallet[]);
        setCategories((categoryRes.data ?? []) as Category[]);
        setTransactions((txRes.data ?? []) as Transaction[]);
        setBudgets((budgetRes.data ?? []) as Budget[]);
        setErrorMsg("");
      } catch (err) {
        console.error(err);
        setErrorMsg("An unexpected error occurred while loading the dashboard.");
      } finally {
        setLoadingData(false);
      }
    }

    load();
  }, [router, monthKey]);

  async function handleLogout() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Checking session…</p>
      </div>
    );
  }

  // --- Derived stats ---

  // 1) Total balance by wallet (balance = starting_balance + sum of tx in that wallet)
  const walletBalances = wallets.map((wallet) => {
    const walletTx = transactions.filter((tx) => tx.wallet_id === wallet.id);
    const txSumMinor = walletTx.reduce((sum, tx) => {
      return tx.type === "income"
        ? sum + tx.amount_minor
        : sum - tx.amount_minor;
    }, 0);
    const balanceMinor = wallet.starting_balance_minor + txSumMinor;

    return {
      wallet,
      balanceMinor,
    };
  });

  // 2) Monthly income/expenses by currency – for current calendar month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyByCurrency: Record<
    string,
    {
      income_minor: number;
      expense_minor: number;
    }
  > = {};

  for (const tx of transactions) {
    const occurred = new Date(tx.occurred_at);
    if (occurred < monthStart || occurred >= monthEnd) continue;

    const code = tx.currency_code ?? "MIXED";

    if (!monthlyByCurrency[code]) {
      monthlyByCurrency[code] = { income_minor: 0, expense_minor: 0 };
    }

    if (tx.type === "income") {
      monthlyByCurrency[code].income_minor += tx.amount_minor;
    } else {
      monthlyByCurrency[code].expense_minor += tx.amount_minor;
    }
  }

  const monthIncomeEntries: [string, number][] = Object.entries(monthlyByCurrency).map(
    ([currency, v]) => [currency, v.income_minor]
  );
  const monthExpenseEntries: [string, number][] = Object.entries(
    monthlyByCurrency
  ).map(([currency, v]) => [currency, v.expense_minor]);

  // 3) Total balance by currency (sum of wallet balances per currency)
  const totalByCurrencyMap = new Map<string, number>();
  for (const { wallet, balanceMinor } of walletBalances) {
    const code = wallet.currency_code;
    totalByCurrencyMap.set(code, (totalByCurrencyMap.get(code) ?? 0) + balanceMinor);
  }
  const totalByCurrency: CurrencyTotal[] = Array.from(totalByCurrencyMap.entries()).map(
    ([currency_code, total_minor]) => ({
      currency_code,
      total_minor,
    })
  );

  // 4) Budgets vs actual
  const budgetSummaries: BudgetSummary[] = budgets.map((b) => {
    const wallet = b.wallet_id
      ? wallets.find((w) => w.id === b.wallet_id) ?? null
      : null;
    const category = b.category_id
      ? categories.find((c) => c.id === b.category_id) ?? null
      : null;

    const filteredTx = transactions.filter((tx) => {
      const occurred = new Date(tx.occurred_at);
      if (occurred < monthStart || occurred >= monthEnd) return false;

      const walletMatches = b.wallet_id ? tx.wallet_id === b.wallet_id : true;
      const categoryMatches = b.category_id ? tx.category_id === b.category_id : true;
      if (!walletMatches || !categoryMatches) return false;

      if (!category) return false;
      if (category.type === "expense" && tx.type !== "expense") return false;
      if (category.type === "income" && tx.type !== "income") return false;

      return true;
    });

    const actualMinor = filteredTx.reduce((sum, tx) => sum + tx.amount_minor, 0);

    const remainingMinor =
      (category && category.type === "expense")
        ? b.amount_minor - actualMinor
        : b.amount_minor - actualMinor;

    const usedRatio =
      b.amount_minor > 0 ? actualMinor / b.amount_minor : 0;

    return {
      budget: b,
      wallet,
      category,
      actualMinor,
      remainingMinor,
      usedRatio,
    };
  });

  // Budget health stats
  const RISK_THRESHOLD = 0.8;

  const totalBudgets = budgetSummaries.length;
  const budgetsOnTrack = budgetSummaries.filter((b) => b.usedRatio < RISK_THRESHOLD)
    .length;
  const budgetsAtRisk = budgetSummaries.filter((b) =>
    b.usedRatio >= RISK_THRESHOLD && b.usedRatio < 1
  ).length;
  const budgetsOver = budgetSummaries.filter((b) => b.usedRatio >= 1).length;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold text-lg">Gorilla Ledger™</div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 justify-end">
          <a href="/wallets" className="underline">
            Wallets
          </a>
          <a href="/categories" className="underline">
            Categories
          </a>
          <a href="/transactions" className="underline">
            Transactions
          </a>
          <a href="/budgets" className="underline">
            Budgets
          </a>
          {/* NEW: Recurring nav link */}
          <a href="/recurring" className="underline">
            Recurring
          </a>
          {email && <span className="hidden sm:inline">{email}</span>}
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded border border-gray-600 hover:bg-white hover:text-black transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Overview</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-700 text-[10px] uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span>Rasta mode</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              High-level snapshot of your wallets, budgets, and activity for{" "}
              {monthLabel}. We&apos;ll evolve this into charts and deeper analytics as we go.
            </p>
            <div className="mt-2 h-px w-32 bg-gradient-to-r from-[#ef4444] via-[#facc15] to-[#22c55e]" />
          </div>
        </div>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              Wallets
            </div>
            <div className="text-2xl font-semibold">
              {wallets.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total number of wallets you&apos;re tracking.
            </div>
          </div>

          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              This Month – Income
            </div>
            <div className="text-lg font-semibold space-y-1">
              {monthIncomeEntries.length === 0 ? (
                <div>0.00</div>
              ) : (
                monthIncomeEntries.map(([currency, minor]) => (
                  <div key={currency}>
                    {formatMinorToAmount(minor)}{" "}
                    <span className="text-xs text-gray-400">{currency}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Totals per currency. No FX conversion applied.
            </div>
          </div>

          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              This Month – Expenses
            </div>
            <div className="text-lg font-semibold space-y-1">
              {monthExpenseEntries.length === 0 ? (
                <div>0.00</div>
              ) : (
                monthExpenseEntries.map(([currency, minor]) => (
                  <div key={currency}>
                    {formatMinorToAmount(minor)}{" "}
                    <span className="text-xs text-gray-400">{currency}</span>
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Totals per currency. No FX conversion applied.
            </div>
          </div>
        </section>

        {/* Total Balance by currency */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Total Balance by Currency
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Wallet starting balances plus all income and expenses applied.
          </p>

          {totalByCurrency.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You don&apos;t have any wallets yet. Create one from the
              Wallets page.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {totalByCurrency.map((row) => (
                <div
                  key={row.currency_code}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="text-xs text-gray-400">
                    {row.currency_code}
                  </div>
                  <div className="font-semibold">
                    {formatMinorToAmount(row.total_minor)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Charts row */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="border border-gray-800 rounded p-4">
            <h2 className="text-sm font-semibold mb-1">
              This Month&apos;s Spending by Category
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Quick view of which categories are driving your expenses this
              month.
            </p>
            <div className="h-64">
              <SpendingByCategoryChart />
            </div>
          </div>

          <div className="border border-gray-800 rounded p-4">
            <h2 className="text-sm font-semibold mb-1">
              Recent Activity
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Latest transactions across all wallets. We&apos;ll build richer
              analytics later.
            </p>
            {transactions.length === 0 ? (
              <p className="text-xs text-gray-500">
                No transactions recorded yet.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto text-xs divide-y divide-gray-800">
                {transactions.slice(0, 10).map((tx) => {
                  const wallet = wallets.find((w) => w.id === tx.wallet_id);
                  const category = tx.category_id
                    ? categories.find((c) => c.id === tx.category_id)
                    : null;
                  const sign = tx.type === "income" ? "+" : "-";

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <div className="font-medium">
                          {category ? category.name : "Uncategorized"}
                        </div>
                        <div className="text-gray-500">
                          {wallet ? wallet.name : "No wallet"} •{" "}
                          {new Date(tx.occurred_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={
                            tx.type === "income"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {sign}
                          {formatMinorToAmount(tx.amount_minor)}{" "}
                          {tx.currency_code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Budgets vs Actual */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Budgets vs Actual – {monthLabel}
          </h2>

          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : totalBudgets === 0 ? (
            <p className="text-gray-500 text-sm">
              You don&apos;t have any budgets set for this month yet. Add
              some from the Budgets page.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {budgetSummaries.map((item) => {
                const { budget, wallet, category, actualMinor, usedRatio } =
                  item;

                const currency = wallet?.currency_code ?? "";
                const isExpense =
                  category && category.type === "expense";
                const labelVerb = isExpense ? "Spent" : "Received";

                const usedPercent = Math.round(usedRatio * 100);
                const remainingMinor = budget.amount_minor - actualMinor;

                let statusLabel = "On track";
                let statusBorder = "border-emerald-500/60";
                let statusText = "text-emerald-300";

                if (usedRatio >= 1) {
                  statusLabel = "Over budget";
                  statusBorder = "border-red-500/70";
                  statusText = "text-red-300";
                } else if (usedRatio >= RISK_THRESHOLD) {
                  statusLabel = "At risk";
                  statusBorder = "border-amber-500/70";
                  statusText = "text-amber-300";
                }

                const barFillPercent = Math.min(100, usedPercent);
                const barBorderClass =
                  usedRatio >= 1
                    ? "border-red-500/70"
                    : usedRatio >= RISK_THRESHOLD
                    ? "border-amber-500/70"
                    : "border-gray-700";

                return (
                  <div
                    key={budget.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="font-medium">
                            {category ? category.name : "All categories"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {wallet ? wallet.name : "All wallets"}{" "}
                            {currency ? `• ${currency}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full border ${statusBorder} ${statusText} tracking-wide uppercase`}
                          >
                            {statusLabel}
                          </span>
                          <div className="text-xs text-gray-400">
                            {labelVerb}{" "}
                            {formatMinorToAmount(actualMinor)} /{" "}
                            {formatMinorToAmount(budget.amount_minor)}{" "}
                            {currency}
                          </div>
                          <div className="text-xs text-gray-400">
                            {usedPercent}% of budget used
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div
                        className={`w-full h-2 rounded-full bg-black border ${barBorderClass} overflow-hidden`}
                      >
                        <div
                          className="h-full bg-white"
                          style={{ width: `${barFillPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 border-t border-gray-900 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-gray-500">
            <div>
              Powered by <span className="font-semibold text-gray-300">Gorilla Ledger™</span>{" "}
              <span className="text-gray-400">· Personal tracking only – no FX conversion applied.</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span className="w-2 h-2 rounded-full bg-[#facc15]" />
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="uppercase tracking-wide text-[10px] text-gray-400">
                Rasta mode always on
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
