"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

// Dashboard charts
import SpendingByCategoryChart from "@/components/dashboard/SpendingByCategoryChart";
import MonthlyIncomeExpenseChart from "@/components/dashboard/MonthlyIncomeExpenseChart";
import TopCategoriesBarChart from "@/components/dashboard/TopCategoriesBarChart";
import HistoricalIncomeExpenseChart from "@/components/dashboard/HistoricalIncomeExpenseChart";
import FullHistoryIncomeExpenseChart from "@/components/dashboard/FullHistoryIncomeExpenseChart";
import CumulativeNetBalanceChart from "@/components/dashboard/CumulativeNetBalanceChart";
import SmartInsightsPanel from "@/components/dashboard/SmartInsightsPanel";
import BudgetInsightsPanel from "@/components/dashboard/BudgetInsightsPanel";
import AiInsightsSidebar from "@/components/dashboard/AiInsightsSidebar";
import YearlyIncomeExpenseBarChart from "@/components/dashboard/YearlyIncomeExpenseBarChart";

import Skeleton from "@/components/ui/Skeleton";

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

type DailyIncomeExpense = {
  day: string;
  income: number;
  expense: number;
  currency_code: string | null;
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Treat any category whose name starts with "transfer"
 * as an internal transfer that should NOT affect
 * income / expense analytics.
 */
function isInternalTransferCategory(category?: Category | null): boolean {
  if (!category) return false;
  const n = category.name.toLowerCase().trim();
  return n.startsWith("transfer");
}

// UI/UX hardening: last security check key
const LAST_SECURITY_CHECK_AT_KEY = "gl_last_security_check_at_v1";

function daysAgoFromMs(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Helpers for true monthly (densified) series */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function isoDay(year: number, month0: number, day: number) {
  // month0 is 0-based
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}
function daysInMonth(year: number, month0: number) {
  // month0 is 0-based; day 0 of next month gives last day of current month
  return new Date(year, month0 + 1, 0).getDate();
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
  const [dailyIncomeExpense, setDailyIncomeExpense] = useState<
    DailyIncomeExpense[]
  >([]);
  const [errorMsg, setErrorMsg] = useState("");

  // UI/UX hardening: MFA status + backup + last security check
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [hasBackupFactor, setHasBackupFactor] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);

  // --- Month selector state (0–11) ---
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-based

  // Filters for charts (per wallet, per category, per year)
  const [walletFilter, setWalletFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  function goToPreviousMonth() {
    setSelectedMonth((prev) => {
      if (prev === 0) {
        setSelectedYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }

  function goToNextMonth() {
    setSelectedMonth((prev) => {
      if (prev === 11) {
        setSelectedYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }

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

      // UI/UX hardening: read last security check
      try {
        const raw = localStorage.getItem(LAST_SECURITY_CHECK_AT_KEY);
        const val = raw ? Number(raw) : 0;
        setLastCheckAt(val > 0 ? val : null);
      } catch {
        setLastCheckAt(null);
      }

      // UI/UX hardening: load MFA status + backup factor state
      try {
        const { data: factorsData } =
          await supabaseBrowserClient.auth.mfa.listFactors();
        const verified =
          factorsData?.totp?.filter((f) => f.status === "verified") ?? [];
        setMfaEnabled(verified.length > 0);
        setHasBackupFactor(verified.length >= 2);
      } catch {
        // If MFA API errors for any reason, keep UI conservative.
        setMfaEnabled(false);
        setHasBackupFactor(false);
      }

      setCheckingSession(false);

      // 2) Load wallets, categories, transactions, budgets + daily income/expense
      setLoadingData(true);

      const [walletRes, categoryRes, txRes, budgetRes, dailyRes] =
        await Promise.all([
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
          supabaseBrowserClient
            .from("daily_income_expense")
            .select("day, income, expense, currency_code")
            .order("day", { ascending: true }),
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

      if (dailyRes.error) {
        // Not fatal – we can fall back to monthly derivation
        console.error("Error loading daily_income_expense view:", dailyRes.error);
      } else {
        setDailyIncomeExpense(dailyRes.data as DailyIncomeExpense[]);
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
    const ok = window.confirm(
      mfaEnabled && !hasBackupFactor
        ? "You are about to log out of Gorilla Ledger™.\n\nReminder: You have not configured a backup authenticator. If you lose access to your authenticator app, account recovery may not be possible.\n\nContinue?"
        : "You are about to log out of Gorilla Ledger™. Continue?"
    );

    if (!ok) return;

    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="w-full max-w-md px-6">
          <div className="border border-gray-800 bg-black/40 rounded-2xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold">Gorilla Ledger™</div>
              <Skeleton className="h-6 w-24" rounded="full" />
            </div>
            <Skeleton className="h-4 w-2/3 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-6" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="mt-4 text-xs text-gray-400">
              Checking your session…
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----- Derived data -----

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  // Per-wallet balance (transfers DO affect balances, so we include them)
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

  function isSelectedMonth(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  }

  // Current (selected) month income/expense totals — per currency (pure multi-currency)
  const monthIncomeByCurrency: Record<string, number> = {};
  const monthExpenseByCurrency: Record<string, number> = {};

  for (const tx of transactions) {
    if (!isSelectedMonth(tx.occurred_at)) continue;

    const category = tx.category_id ? categoryMap[tx.category_id] : null;
    if (isInternalTransferCategory(category)) continue;

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

  // Budget vs Actual for selected month
  const budgetsThisMonth = budgets.filter(
    (b) => b.year === selectedYear && b.month === selectedMonth + 1
  );

  const budgetSummaries = budgetsThisMonth.map((b) => {
    const wallet = b.wallet_id ? walletMap[b.wallet_id] : null;
    const category = categoryMap[b.category_id];

    const relevantTxs = transactions.filter((tx) => {
      if (!isSelectedMonth(tx.occurred_at)) return false;
      if (tx.category_id !== b.category_id) return false;
      if (b.wallet_id && tx.wallet_id !== b.wallet_id) return false;

      const txCategory = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransferCategory(txCategory)) return false;

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

  // Budget health stats
  const RISK_THRESHOLD = 0.8;

  const totalBudgets = budgetSummaries.length;
  const budgetsOver = budgetSummaries.filter((b) => b.usedRatio > 1).length;
  const budgetsAtRisk = budgetSummaries.filter(
    (b) => b.usedRatio > RISK_THRESHOLD && b.usedRatio <= 1
  ).length;
  const budgetsOnTrack =
    totalBudgets - budgetsAtRisk - budgetsOver >= 0
      ? totalBudgets - budgetsAtRisk - budgetsOver
      : 0;

  // -------- Income vs expense trend for charts (with filters) --------

  type IncomeExpenseDailyPoint = {
    day: string;
    income: number;
    expense: number;
    currencyCode?: string;
  };

  // Years available in transactions (for year filter)
  const chartYearOptions = Array.from(
    new Set(
      transactions.map((tx) => {
        const d = new Date(tx.occurred_at);
        return Number.isNaN(d.getTime()) ? null : String(d.getFullYear());
      })
    )
  )
    .filter((y): y is string => !!y)
    .sort();

  // Transactions used for trend charts (filters + no internal transfers)
  const filteredTrendTransactions = transactions.filter((tx) => {
    if (walletFilter !== "all" && tx.wallet_id !== walletFilter) return false;

    const category = tx.category_id ? categoryMap[tx.category_id] : null;
    if (isInternalTransferCategory(category)) return false;

    if (categoryFilter !== "all" && tx.category_id !== categoryFilter)
      return false;

    if (yearFilter !== "all") {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) return false;
      const y = String(d.getFullYear());
      if (y !== yearFilter) return false;
    }

    return true;
  });

  // Build daily series from filtered transactions (per currency)
  const incomeExpenseTrendData: IncomeExpenseDailyPoint[] = (() => {
    const map = new Map<
      string,
      { day: string; income: number; expense: number; currencyCode: string }
    >();

    for (const tx of filteredTrendTransactions) {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) continue;
      const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const key = `${day}|${tx.currency_code}`;

      const existing =
        map.get(key) ?? {
          day,
          income: 0,
          expense: 0,
          currencyCode: tx.currency_code,
        };

      if (tx.type === "income") {
        existing.income += tx.amount_minor / 100;
      } else if (tx.type === "expense") {
        existing.expense += tx.amount_minor / 100;
      }

      map.set(key, existing);
    }

    const points = Array.from(map.values());
    points.sort((a, b) => a.day.localeCompare(b.day));
    return points;
  })();

  // Last 12 months slice for the historical chart
  const incomeExpenseTrendLast12: IncomeExpenseDailyPoint[] = (() => {
    if (incomeExpenseTrendData.length === 0) return [];
    const today2 = new Date();
    const cutoff = new Date(
      today2.getFullYear() - 1,
      today2.getMonth(),
      today2.getDate()
    );

    return incomeExpenseTrendData.filter((row) => {
      const d = new Date(row.day);
      return d >= cutoff;
    });
  })();

  // -------- TRUE monthly daily series (Option A) --------
  const monthlyIncomeExpenseData: IncomeExpenseDailyPoint[] = (() => {
    // 1) Filter to selected month + wallet/category filters + exclude internal transfers
    const monthTxs = transactions.filter((tx) => {
      if (!isSelectedMonth(tx.occurred_at)) return false;

      if (walletFilter !== "all" && tx.wallet_id !== walletFilter) return false;

      const category = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransferCategory(category)) return false;

      if (categoryFilter !== "all" && tx.category_id !== categoryFilter)
        return false;

      return true;
    });

    // 2) Currencies in this month slice
    const currencies = Array.from(
      new Set(monthTxs.map((tx) => tx.currency_code).filter(Boolean))
    ).sort();

    if (currencies.length === 0) return [];

    // 3) Pre-seed all days of month for each currency (densification)
    const dim = daysInMonth(selectedYear, selectedMonth);
    const map = new Map<
      string,
      { day: string; income: number; expense: number; currencyCode: string }
    >();

    for (const ccy of currencies) {
      for (let day = 1; day <= dim; day++) {
        const d = isoDay(selectedYear, selectedMonth, day);
        const key = `${d}|${ccy}`;
        map.set(key, { day: d, income: 0, expense: 0, currencyCode: ccy });
      }
    }

    // 4) Accumulate
    for (const tx of monthTxs) {
      const d = new Date(tx.occurred_at);
      if (Number.isNaN(d.getTime())) continue;

      const day = d.toISOString().slice(0, 10);
      const key = `${day}|${tx.currency_code}`;
      const row = map.get(key);
      if (!row) continue;

      const amount = tx.amount_minor / 100;
      if (tx.type === "income") row.income += amount;
      else if (tx.type === "expense") row.expense += amount;
    }

    // 5) Sort and return
    const points = Array.from(map.values());
    points.sort((a, b) => {
      const d = a.day.localeCompare(b.day);
      if (d !== 0) return d;
      return (a.currencyCode || "").localeCompare(b.currencyCode || "");
    });
    return points;
  })();

  // Calendar-year selection for the new bar chart:
  // - if Year filter is "all", default to current calendar year
  // - else use the selected year
  const targetCalendarYear = (() => {
    if (yearFilter === "all") return new Date().getFullYear();
    const parsed = Number(yearFilter);
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  })();

  const selectedDate = new Date(selectedYear, selectedMonth, 1);
  const monthLabel = selectedDate.toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  const lastSecurityLabel = lastCheckAt
    ? `${daysAgoFromMs(lastCheckAt)} day(s) ago`
    : "Not recorded";

  // ---------- Visual system ----------
  const CARD =
    "border border-gray-800 bg-black/40 rounded-2xl p-5 " +
    "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const CARD_TIGHT =
    "border border-gray-800 bg-black/40 rounded-2xl p-4 " +
    "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const KPI_CARD =
    "border border-gray-800 bg-black/40 rounded-2xl p-4 " +
    "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const SECTION_DIVIDER = "h-px bg-gray-800/80";
  const SECTION_KICKER = "text-[11px] uppercase tracking-wide text-gray-500";

  // KPI typography helpers
  const KPI_VALUE = "font-semibold tracking-tight tabular-nums leading-none";
  const KPI_VALUE_LG = `text-3xl sm:text-[34px] ${KPI_VALUE}`;
  const KPI_VALUE_MD = `text-xl sm:text-2xl ${KPI_VALUE}`;

  // Skeleton heights (stable layout, low CLS)
  const SK_HERO = "h-[320px] sm:h-[360px]";
  const SK_CHART = "h-[300px] sm:h-[320px]";
  const SK_CHART_TALL = "h-[320px] sm:h-[360px]";

  // Header UI helpers (tight, premium)
  const NAV_SHELL =
    "inline-flex items-center gap-1 rounded-full border border-gray-800 bg-black/40 " +
    "px-1 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const NAV_LINK =
    "px-3 py-1.5 rounded-full text-xs text-gray-300 hover:text-white " +
    "hover:bg-white/10 transition whitespace-nowrap";
  const HEADER_BADGE =
    "inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black/40 " +
    "px-3 py-1 text-[11px] text-gray-300 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";
  const HEADER_DOT = <span className="text-gray-600">•</span>;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Tight top header */}
      <header className="w-full border-b border-gray-800 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="font-semibold tracking-tight text-base">
                Gorilla Ledger™
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className={NAV_SHELL} aria-label="Primary navigation">
                  <a href="/wallets" className={NAV_LINK}>
                    Wallets
                  </a>
                  <a href="/categories" className={NAV_LINK}>
                    Categories
                  </a>
                  <a href="/transactions" className={NAV_LINK}>
                    Transactions
                  </a>
                  <a href="/budgets" className={NAV_LINK}>
                    Budgets
                  </a>
                  <a href="/recurring" className={NAV_LINK}>
                    Recurring
                  </a>
                  <a href="/settings/security" className={NAV_LINK}>
                    Security
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              {email && (
                <span className="hidden md:inline text-xs text-gray-400 max-w-[240px] truncate">
                  {email}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-full border border-gray-700 bg-black/40 text-xs text-gray-200 hover:bg-white hover:text-black transition"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile nav (compact, avoids “link bar” feel) */}
          <div className="sm:hidden mt-3">
            <div className={NAV_SHELL}>
              <a href="/wallets" className={NAV_LINK}>
                Wallets
              </a>
              <a href="/categories" className={NAV_LINK}>
                Categories
              </a>
              <a href="/transactions" className={NAV_LINK}>
                Tx
              </a>
              <a href="/budgets" className={NAV_LINK}>
                Budgets
              </a>
              <a href="/recurring" className={NAV_LINK}>
                Recurring
              </a>
              <a href="/settings/security" className={NAV_LINK}>
                Security
              </a>
            </div>
          </div>

          {/* Security posture row as compact badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={HEADER_BADGE}>
              <span className="text-gray-400">MFA</span>
              {HEADER_DOT}
              <span className={mfaEnabled ? "text-emerald-400" : "text-gray-200"}>
                {mfaEnabled ? "Enabled" : "Disabled"}
              </span>
            </span>

            <span className={HEADER_BADGE}>
              <span className="text-gray-400">Last security check</span>
              {HEADER_DOT}
              <span className="text-gray-200">{lastSecurityLabel}</span>
            </span>

            {mfaEnabled && !hasBackupFactor && (
              <span className={`${HEADER_BADGE} border-amber-500/40`}>
                <span className="text-amber-300">
                  Backup authenticator not configured
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="text-gray-400 text-sm">
              High-level snapshot of your wallets, budgets, and activity.
            </p>
          </div>

          {/* Month selector */}
          <div className="inline-flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="px-2 py-1 border border-gray-700 rounded hover:bg-gray-900"
            >
              ◀
            </button>
            <div className="px-3 py-1 border border-gray-800 rounded-full bg-black/40 text-xs uppercase tracking-wide text-gray-300">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="px-2 py-1 border border-gray-700 rounded hover:bg-gray-900"
            >
              ▶
            </button>
          </div>
        </div>

        {errorMsg && <p className="mb-6 text-red-400 text-sm">{errorMsg}</p>}

        {/* Executive */}
        <div className="mt-2 mb-4">
          <div className={SECTION_KICKER}>Executive</div>
          <div className={`${SECTION_DIVIDER} mt-2`} />
        </div>

        {/* KPI strip */}
        <section className="grid gap-5 md:grid-cols-3 mb-8">
          <div className={KPI_CARD}>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">
              Wallets
            </div>

            {loadingData ? (
              <>
                <Skeleton className="h-10 w-16 mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </>
            ) : (
              <>
                <div className={KPI_VALUE_LG}>{wallets.length}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Total number of wallets you&apos;re tracking.
                </div>
              </>
            )}
          </div>

          <div className={KPI_CARD}>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">
              Income – {monthLabel}
            </div>

            {loadingData ? (
              <>
                <Skeleton className="h-8 w-44 mb-2" />
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-3 w-5/6" />
              </>
            ) : (
              <>
                <div className={`space-y-1 ${KPI_VALUE_MD}`}>
                  {monthIncomeEntries.length === 0 ? (
                    <div className="tabular-nums">0.00</div>
                  ) : (
                    monthIncomeEntries.map(([currency, minor]) => (
                      <div key={currency} className="tabular-nums">
                        {formatMinorToAmount(minor)}{" "}
                        <span className="text-sm text-gray-300">{currency}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Totals per currency. Internal transfers excluded. No FX
                  conversion applied.
                </div>
              </>
            )}
          </div>

          <div className={KPI_CARD}>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">
              Expenses – {monthLabel}
            </div>

            {loadingData ? (
              <>
                <Skeleton className="h-8 w-44 mb-2" />
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-3 w-5/6" />
              </>
            ) : (
              <>
                <div className={`space-y-1 ${KPI_VALUE_MD}`}>
                  {monthExpenseEntries.length === 0 ? (
                    <div className="tabular-nums">0.00</div>
                  ) : (
                    monthExpenseEntries.map(([currency, minor]) => (
                      <div key={currency} className="tabular-nums">
                        {formatMinorToAmount(minor)}{" "}
                        <span className="text-sm text-gray-300">{currency}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Totals per currency. Internal transfers excluded. No FX
                  conversion applied.
                </div>
              </>
            )}
          </div>
        </section>

        {/* Executive trend (Hero chart) */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Calendar-Year Income vs Expenses
            </h2>
            <div className="text-[11px] text-gray-400">
              Executive monthly trend for {targetCalendarYear}.
            </div>
          </div>

          {loadingData ? (
            <div className={CARD}>
              <Skeleton className={SK_HERO} rounded="2xl" />
            </div>
          ) : (
            <div className={CARD}>
              <YearlyIncomeExpenseBarChart
                transactions={transactions}
                categories={categories}
                targetYear={targetCalendarYear}
                walletFilter={walletFilter}
                yearSource={yearFilter === "all" ? "current" : "filter"}
              />
            </div>
          )}
        </section>

        {/* Total Balance by currency */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Total Balance by Currency
            </h2>
            <div className="text-[11px] text-gray-400">
              Wallet balances (starting balance + transactions). Transfers
              included.
            </div>
          </div>

          {loadingData ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-gray-800 bg-black/40 rounded-2xl px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                >
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-32" />
                </div>
              ))}
            </div>
          ) : Object.keys(totalsByCurrency).length === 0 ? (
            <p className="text-gray-500 text-sm">
              No balances yet – add a wallet and some transactions.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(totalsByCurrency).map(([currency, minor]) => (
                <div
                  key={currency}
                  className="border border-gray-800 bg-black/40 rounded-2xl px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                >
                  <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                    {currency}
                  </div>
                  <div className={`mt-2 ${KPI_VALUE_MD} tabular-nums`}>
                    {formatMinorToAmount(minor)}{" "}
                    <span className="text-sm text-gray-300">{currency}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Intelligence */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Intelligence
              </h2>
              <p className="text-[11px] text-gray-400">
                Actionable insights based on your recent activity.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={CARD}>
              {loadingData ? (
                <>
                  <Skeleton className="h-5 w-40 mb-3" />
                  <Skeleton className="h-4 w-5/6 mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </>
              ) : (
                <SmartInsightsPanel
                  transactions={transactions}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                />
              )}
            </div>

            <div className={CARD}>
              {loadingData ? (
                <>
                  <Skeleton className="h-5 w-40 mb-3" />
                  <Skeleton className="h-4 w-5/6 mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </>
              ) : (
                <AiInsightsSidebar
                  transactions={transactions}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                />
              )}
            </div>
          </div>
        </section>

        {/* Chart filters */}
        <section className="mb-10 sticky top-0 z-30 -mx-4 px-4 pt-4 pb-4 bg-black/80 backdrop-blur border-b border-gray-800">
          <div
            className={`${CARD_TIGHT} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}
          >
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Chart Filters
              </h2>
              <p className="text-[11px] text-gray-400">
                Apply filters to the charts below, including spending and
                income/expense trends.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Wallet:</span>
                <select
                  value={walletFilter}
                  onChange={(e) => setWalletFilter(e.target.value)}
                  className="bg-black border border-gray-700 rounded px-2 py-1 text-xs"
                >
                  <option value="all">All wallets</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-black border border-gray-700 rounded px-2 py-1 text-xs"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Year:</span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-black border border-gray-700 rounded px-2 py-1 text-xs"
                >
                  <option value="all">All years</option>
                  {chartYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Composition */}
        <section className="mb-10">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className={CARD}>
              <h2 className="text-lg font-semibold tracking-tight mb-3">
                Spending by Category – {monthLabel}
              </h2>
              {loadingData ? (
                <Skeleton className={SK_CHART} rounded="2xl" />
              ) : (
                <SpendingByCategoryChart
                  transactions={transactions}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                />
              )}
            </div>

            <div className={CARD}>
              <h2 className="text-lg font-semibold tracking-tight mb-3">
                Top Spending Categories – This Year
              </h2>
              {loadingData ? (
                <Skeleton className={SK_CHART} rounded="2xl" />
              ) : (
                <TopCategoriesBarChart
                  transactions={transactions}
                  categories={categories}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                  yearFilter={yearFilter}
                />
              )}
            </div>
          </div>
        </section>

        {/* Budget control */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Budget Control – {monthLabel}
              </h2>
              <p className="text-[11px] text-gray-400">
                Your budget health and budget-vs-actual performance for the
                selected month.
              </p>
            </div>
          </div>

          {!loadingData && totalBudgets > 0 && (
            <BudgetInsightsPanel
              summaries={budgetSummaries as any}
              riskThreshold={RISK_THRESHOLD}
              monthLabel={monthLabel}
            />
          )}

          <div className={CARD}>
            {loadingData ? (
              <>
                <Skeleton className="h-4 w-56 mb-3" />
                <Skeleton className="h-4 w-2/3 mb-6" />
                <Skeleton className="h-10 w-full rounded-2xl mb-3" />
                <Skeleton className="h-10 w-full rounded-2xl mb-3" />
                <Skeleton className="h-10 w-full rounded-2xl" />
              </>
            ) : totalBudgets === 0 ? (
              <p className="text-gray-500 text-sm">
                You don&apos;t have any budgets set for this month yet. Add some
                from the Budgets page.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-300">
                  <span className="px-2 py-1 rounded-full border border-gray-700 bg-black/40">
                    {totalBudgets}{" "}
                    {totalBudgets === 1 ? "budget" : "budgets"} this month
                  </span>
                  <span className="px-2 py-1 rounded-full border border-gray-700 bg-black/40">
                    {budgetsOnTrack}{" "}
                    {budgetsOnTrack === 1 ? "on track" : "on track budgets"}
                  </span>
                  <span className="px-2 py-1 rounded-full border border-gray-700 bg-black/40">
                    {budgetsAtRisk}{" "}
                    {budgetsAtRisk === 1 ? "at risk" : "at risk budgets"}
                  </span>
                  <span className="px-2 py-1 rounded-full border border-gray-700 bg-black/40">
                    {budgetsOver}{" "}
                    {budgetsOver === 1 ? "over budget" : "over-budget items"}
                  </span>
                </div>

                <div
                  className={`border border-gray-800 bg-black/30 rounded-2xl divide-y divide-gray-800 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.03)]`}
                >
                  {budgetSummaries.map((item) => {
                    const { budget, wallet, category, actualMinor, usedRatio } =
                      item;

                    const currency = wallet?.currency_code ?? "";
                    const isExpense = category && category.type === "expense";
                    const labelVerb = isExpense ? "Spent" : "Received";

                    const usedPercent = Math.round(usedRatio * 100);
                    const clampedPercent = Math.max(
                      0,
                      Math.min(usedPercent, 130)
                    );

                    const barFillPercent = Math.max(
                      0,
                      Math.min(clampedPercent, 100)
                    );

                    const barBorderClass =
                      usedPercent > 100 ? "border-white/60" : "border-gray-700";

                    let statusLabel = "ON TRACK";
                    let statusBorder = "border-gray-700";
                    let statusText = "text-gray-300";

                    if (usedRatio > 1) {
                      statusLabel = "OVER BUDGET";
                      statusBorder = "border-white/70";
                      statusText = "text-white";
                    } else if (usedRatio > RISK_THRESHOLD && usedRatio <= 1) {
                      statusLabel = "AT RISK";
                      statusBorder = "border-gray-500";
                      statusText = "text-gray-200";
                    }

                    return (
                      <div
                        key={budget.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">
                              {category ? category.name : "Unknown category"}
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full border ${statusBorder} ${statusText} tracking-wide uppercase`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {wallet ? wallet.name : "All wallets"}{" "}
                            {currency ? `• ${currency}` : ""}
                          </div>
                        </div>

                        <div className="w-full md:w-1/2">
                          <div className="flex items-baseline justify-between mb-1">
                            <div className="text-sm tabular-nums">
                              {labelVerb} {formatMinorToAmount(actualMinor)} /{" "}
                              {formatMinorToAmount(budget.amount_minor)}{" "}
                              {currency}
                            </div>
                            <div className="text-xs text-gray-400 ml-3 whitespace-nowrap tabular-nums">
                              {usedPercent}% of budget used
                            </div>
                          </div>

                          <div
                            className={`w-full h-2 rounded-full bg-black border ${barBorderClass} overflow-hidden`}
                          >
                            <div
                              className="h-full bg-white"
                              style={{ width: `${barFillPercent}%` }}
                            />
                          </div>

                          {usedPercent > 100 && (
                            <div className="mt-1 text-[11px] text-gray-400">
                              You&apos;ve exceeded this budget.
                            </div>
                          )}
                          {usedPercent <= 100 &&
                            usedRatio > RISK_THRESHOLD && (
                              <div className="mt-1 text-[11px] text-gray-400">
                                You&apos;re approaching this budget&apos;s
                                limit.
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Advanced analytics */}
        <section className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Advanced Analytics
              </h2>
              <p className="text-[11px] text-gray-400">
                Trend charts to understand seasonality, long-term patterns, and
                all-time net flow.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 mb-5">
            <div className={CARD}>
              {loadingData ? (
                <Skeleton className={SK_CHART_TALL} rounded="2xl" />
              ) : monthlyIncomeExpenseData.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No transactions yet to build a trend.
                </p>
              ) : (
                <MonthlyIncomeExpenseChart data={monthlyIncomeExpenseData} />
              )}
            </div>

            <div className={CARD}>
              {loadingData ? (
                <Skeleton className={SK_CHART_TALL} rounded="2xl" />
              ) : incomeExpenseTrendLast12.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Not enough history yet to show this trend.
                </p>
              ) : (
                <HistoricalIncomeExpenseChart data={incomeExpenseTrendLast12} />
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={CARD}>
              {loadingData ? (
                <Skeleton className={SK_CHART_TALL} rounded="2xl" />
              ) : incomeExpenseTrendData.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No transactions yet to build an all-time trend.
                </p>
              ) : (
                <FullHistoryIncomeExpenseChart data={incomeExpenseTrendData} />
              )}
            </div>

            <div className={CARD}>
              {loadingData ? (
                <Skeleton className={SK_CHART_TALL} rounded="2xl" />
              ) : incomeExpenseTrendData.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No transactions yet to build a cumulative net flow view.
                </p>
              ) : (
                <CumulativeNetBalanceChart data={incomeExpenseTrendData} />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
