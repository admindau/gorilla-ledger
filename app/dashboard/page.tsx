"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

// Dashboard charts
import SpendingByCategoryChart from "@/components/dashboard/SpendingByCategoryChart";
import MonthlyIncomeExpenseChart from "@/components/dashboard/MonthlyIncomeExpenseChart";
import TopCategoriesBarChart from "@/components/dashboard/TopCategoriesBarChart";

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
  type: "income" | "expense";
};

type Budget = {
  id: string;
  wallet_id: string | null;
  category_id: string;
  year: number;
  month: number;
  amount_minor: number;
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

  useEffect(() => {
    async function init() {
      setCheckingSession(true);
      setErrorMsg("");

      // 1) Check auth session
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
          .order("occurred_at", { ascending: false })
          .limit(500),
        supabaseBrowserClient
          .from("budgets")
          .select("id, wallet_id, category_id, year, month, amount_minor")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(200),
      ]);

      if (walletRes.error) {
        console.error(walletRes.error);
        setErrorMsg(walletRes.error.message);
        setLoadingData(false);
        return;
      }
      if (categoryRes.error) {
        console.error(categoryRes.error);
        setErrorMsg(categoryRes.error.message);
        setLoadingData(false);
        return;
      }
      if (txRes.error) {
        console.error(txRes.error);
        setErrorMsg(txRes.error.message);
        setLoadingData(false);
        return;
      }
      if (budgetRes.error) {
        console.error(budgetRes.error);
        setErrorMsg(budgetRes.error.message);
        setLoadingData(false);
        return;
      }

      setWallets(walletRes.data as Wallet[]);
      setCategories(categoryRes.data as Category[]);
      setTransactions(txRes.data as Transaction[]);
      setBudgets(budgetRes.data as Budget[]);

      setLoadingData(false);
    }

    init();
  }, [router]);

  async function handleLogout() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-400">Checking your session.</p>
      </div>
    );
  }

  // ----- Derived data -----

  // Per-wallet balance
  const walletBalances = wallets.map((w) => {
    const walletTxs = transactions.filter((tx) => tx.wallet_id === w.id);
    const delta = walletTxs.reduce((sum, tx) => {
      const sign = tx.type === "income" ? 1 : -1;
      return sum + sign * tx.amount_minor;
    }, 0);

    const balanceMinor = w.starting_balance_minor + delta;

    return {
      ...w,
      balanceMinor,
    };
  });

  // Totals per currency
  const totalsByCurrency: Record<string, number> = {};
  for (const wb of walletBalances) {
    if (!totalsByCurrency[wb.currency_code]) {
      totalsByCurrency[wb.currency_code] = 0;
    }
    totalsByCurrency[wb.currency_code] += wb.balanceMinor;
  }

  const now = new Date();
  const currentMonth = now.getMonth(); // 0–11
  const currentYear = now.getFullYear();

  function isCurrentMonth(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }

  // Current month income/expense totals — per currency (pure multi-currency)
  const monthIncomeByCurrency: Record<string, number> = {};
  const monthExpenseByCurrency: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isCurrentMonth(tx.occurred_at)) continue;

    if (tx.type === "income") {
      if (!monthIncomeByCurrency[tx.currency_code]) {
        monthIncomeByCurrency[tx.currency_code] = 0;
      }
      monthIncomeByCurrency[tx.currency_code] += tx.amount_minor;
    } else if (tx.type === "expense") {
      if (!monthExpenseByCurrency[tx.currency_code]) {
        monthExpenseByCurrency[tx.currency_code] = 0;
      }
      monthExpenseByCurrency[tx.currency_code] += tx.amount_minor;
    }
  }

  const monthIncomeEntries = Object.entries(monthIncomeByCurrency);
  const monthExpenseEntries = Object.entries(monthExpenseByCurrency);

  // Budget vs Actual for current month
  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  const budgetsThisMonth = budgets.filter(
    (b) => b.year === currentYear && b.month === currentMonth + 1
  );

  const budgetSummaries = budgetsThisMonth.map((b) => {
    const wallet = b.wallet_id ? walletMap[b.wallet_id] : null;
    const category = categoryMap[b.category_id];

    const relevantTxs = transactions.filter((tx) => {
      if (!isCurrentMonth(tx.occurred_at)) return false;
      if (tx.category_id !== b.category_id) return false;
      if (b.wallet_id && tx.wallet_id !== b.wallet_id) return false;
      return true;
    });

    const actualMinor = relevantTxs.reduce((sum, tx) => {
      if (!category) return sum;
      if (category.type === "expense" && tx.type === "expense") {
        return sum + tx.amount_minor;
      }
      if (category.type === "income" && tx.type === "income") {
        return sum + tx.amount_minor;
      }
      return sum;
    }, 0);

    const remainingMinor = b.amount_minor - actualMinor;
    const usedRatio = b.amount_minor > 0 ? actualMinor / b.amount_minor : 0;

    return {
      budget: b,
      wallet,
      category,
      actualMinor,
      remainingMinor,
      usedRatio,
    };
  });

  // -------- Spending by category (current month) --------
  const expenseByCategory: Record<string, number> = {};
  for (const tx of transactions) {
    if (!isCurrentMonth(tx.occurred_at)) continue;
    if (tx.type !== "expense") continue;
    if (!tx.category_id) continue;

    if (!expenseByCategory[tx.category_id]) {
      expenseByCategory[tx.category_id] = 0;
    }
    expenseByCategory[tx.category_id] += tx.amount_minor;
  }

  const spendingByCategoryData = Object.entries(expenseByCategory).map(
    ([categoryId, totalMinor]) => ({
      name: categoryMap[categoryId]?.name ?? "Uncategorized",
      value: totalMinor / 100, // major units for charts
    })
  );

  // Top categories (take top 5 of above)
  const topCategoriesData = [...spendingByCategoryData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // -------- Monthly income vs expense (across all time, still "mixed") --------
  const incomeExpenseByMonth: Record<
    string,
    { incomeMinor: number; expenseMinor: number }
  > = {};

  for (const tx of transactions) {
    const d = new Date(tx.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    if (!incomeExpenseByMonth[key]) {
      incomeExpenseByMonth[key] = { incomeMinor: 0, expenseMinor: 0 };
    }
    if (tx.type === "income") {
      incomeExpenseByMonth[key].incomeMinor += tx.amount_minor;
    } else if (tx.type === "expense") {
      incomeExpenseByMonth[key].expenseMinor += tx.amount_minor;
    }
  }

  const incomeExpenseTrendData = Object.entries(incomeExpenseByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { incomeMinor, expenseMinor }]) => ({
      month,
      income: incomeMinor / 100,
      expense: expenseMinor / 100,
    }));

  // Relax typings for chart components to avoid prop-type friction
  const SpendingChart = SpendingByCategoryChart as any;
  const IncomeExpenseChart = MonthlyIncomeExpenseChart as any;
  const TopCategoriesChart = TopCategoriesBarChart as any;

  const monthLabel = now.toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold text-lg">Gorilla Ledger™</div>
        <div className="flex items-center gap-4 text-sm text-gray-300">
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
        <h1 className="text-2xl font-semibold mb-2">Overview</h1>
        <p className="text-gray-400 mb-4 text-sm">
          High-level snapshot of your wallets, budgets, and activity for{" "}
          {monthLabel}.
        </p>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">Wallets</div>
            <div className="text-2xl font-semibold">{wallets.length}</div>
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
                    {formatMinorToAmount(minor)} {currency}
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
                    {formatMinorToAmount(minor)} {currency}
                  </div>
                ))
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Totals per currency. No FX conversion applied.
            </div>
          </div>
        </section>

        {/* Totals per currency */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Total Balance by Currency
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : Object.keys(totalsByCurrency).length === 0 ? (
            <p className="text-gray-500 text-sm">
              No wallets found yet. Create one to start tracking.
            </p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(totalsByCurrency).map(([currency, minor]) => (
                <div
                  key={currency}
                  className="border border-gray-800 rounded px-4 py-2"
                >
                  <div className="text-xs text-gray-400 uppercase">
                    {currency}
                  </div>
                  <div className="text-lg font-semibold">
                    {formatMinorToAmount(minor)} {currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wallet list with balances */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Wallet Balances</h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : walletBalances.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You don&apos;t have any wallets yet. Create one from the Wallets
              page.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {walletBalances.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-gray-400">
                      {w.currency_code}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatMinorToAmount(w.balanceMinor)} {w.currency_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Spending by Category (donut) */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Spending by Category – {monthLabel}
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : spendingByCategoryData.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No expense transactions for this month yet.
            </p>
          ) : (
            <div className="border border-gray-800 rounded p-4 bg.black/40 bg-black/40">
              <SpendingChart data={spendingByCategoryData} />
            </div>
          )}
        </section>

        {/* Monthly income vs expense (line / area) */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Monthly Income vs Expenses
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : incomeExpenseTrendData.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No transactions yet to build a trend.
            </p>
          ) : (
            <div className="border border-gray-800 rounded p-4 bg-black/40">
              <IncomeExpenseChart data={incomeExpenseTrendData} />
            </div>
          )}
        </section>

        {/* Top categories bar chart */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Top Spending Categories – {monthLabel}
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : topCategoriesData.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No expense transactions for this month yet.
            </p>
          ) : (
            <div className="border border-gray-800 rounded p-4 bg-black/40">
              <TopCategoriesChart data={topCategoriesData} />
            </div>
          )}
        </section>

        {/* Budgets vs Actual */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Budgets vs Actual – {monthLabel}
          </h2>

          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : budgetSummaries.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You don&apos;t have any budgets set for this month yet. Add some
              from the Budgets page.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {budgetSummaries.map((item) => {
                const { budget, wallet, category, actualMinor, usedRatio } =
                  item;

                const currency = wallet?.currency_code ?? "";
                const isExpense = category && category.type === "expense";
                const labelVerb = isExpense ? "Spent" : "Received";

                const usedPercent = Math.round(usedRatio * 100);

                return (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {category ? category.name : "Unknown category"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {wallet ? wallet.name : "All wallets"}{" "}
                        {currency ? `• ${currency}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div>
                        {labelVerb} {formatMinorToAmount(actualMinor)} /{" "}
                        {formatMinorToAmount(budget.amount_minor)} {currency}
                      </div>
                      <div className="text-xs text-gray-400">
                        {usedPercent}% of budget used
                      </div>
                    </div>
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
