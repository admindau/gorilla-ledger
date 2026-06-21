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
import ExecutiveKpiCards from "@/components/dashboard/ExecutiveKpiCards";
import SpendingTrendChart from "@/components/dashboard/SpendingTrendChart";
import QuickStatsRow from "@/components/dashboard/QuickStatsRow";
import RecentTransactionsWidget from "@/components/dashboard/RecentTransactionsWidget";
import LargestExpenseWidget from "@/components/dashboard/LargestExpenseWidget";
import BudgetHealthWidget from "@/components/dashboard/BudgetHealthWidget";
import FinancialHealthScore from "@/components/dashboard/FinancialHealthScore";
import SmartAlertsPanel from "@/components/dashboard/SmartAlertsPanel";
import ExecutiveInsightsPanel from "@/components/dashboard/ExecutiveInsightsPanel";
import ForecastMonthEndBalance from "@/components/dashboard/ForecastMonthEndBalance";
import ExecutiveHeroCard from "@/components/dashboard/ExecutiveHeroCard";

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

type RecurringRule = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  next_run_at: string;
  is_active: boolean;
};

type SmartAlert = {
  id: string;
  tone: "good" | "watch" | "danger" | "neutral";
  title: string;
  detail: string;
};

type ExecutiveInsight = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

type ForecastEntry = {
  currencyCode: string;
  currentBalanceMinor: number;
  projectedBalanceMinor: number;
  scheduledIncomeMinor: number;
  scheduledExpenseMinor: number;
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
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
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

      const [walletRes, categoryRes, txRes, budgetRes, recurringRes, dailyRes] =
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
            .from("recurring_rules")
            .select("id, wallet_id, category_id, type, amount_minor, currency_code, next_run_at, is_active")
            .eq("is_active", true)
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
      if (recurringRes.error) {
        // Not fatal for the dashboard; forecast widgets will fall back gracefully.
        console.error("Error loading recurring rules:", recurringRes.error);
        setRecurringRules([]);
      } else {
        setRecurringRules(recurringRes.data as RecurringRule[]);
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
  const monthNetEntries = Array.from(
    new Set([
      ...Object.keys(monthIncomeByCurrency),
      ...Object.keys(monthExpenseByCurrency),
    ])
  )
    .sort()
    .map((currency) => [
      currency,
      (monthIncomeByCurrency[currency] ?? 0) -
        (monthExpenseByCurrency[currency] ?? 0),
    ] as const);

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


  // Dashboard Intelligence A.2: activity snapshot widgets
  const selectedMonthActivityTransactions = transactions.filter((tx) => {
    if (!isSelectedMonth(tx.occurred_at)) return false;

    const category = tx.category_id ? categoryMap[tx.category_id] : null;
    if (isInternalTransferCategory(category)) return false;

    return true;
  });

  const recentTransactions = selectedMonthActivityTransactions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )
    .slice(0, 5)
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountMinor: tx.amount_minor,
      currencyCode: tx.currency_code,
      occurredAt: tx.occurred_at,
      categoryName: tx.category_id
        ? categoryMap[tx.category_id]?.name ?? "Uncategorized"
        : "Uncategorized",
      walletName: walletMap[tx.wallet_id]?.name ?? "Unknown wallet",
    }));

  const largestExpense = selectedMonthActivityTransactions
    .filter((tx) => tx.type === "expense")
    .slice()
    .sort((a, b) => b.amount_minor - a.amount_minor)[0];

  const largestExpenseItem = largestExpense
    ? {
        id: largestExpense.id,
        amountMinor: largestExpense.amount_minor,
        currencyCode: largestExpense.currency_code,
        occurredAt: largestExpense.occurred_at,
        categoryName: largestExpense.category_id
          ? categoryMap[largestExpense.category_id]?.name ?? "Uncategorized"
          : "Uncategorized",
        walletName: walletMap[largestExpense.wallet_id]?.name ?? "Unknown wallet",
      }
    : null;

  const activeCategoryCount = categories.filter((c) => c.type === "expense").length;

  // Dashboard Intelligence A.3: score, alerts, executive insights, and forecast
  const incomeTotalMinor = monthIncomeEntries.reduce((sum, [, minor]) => sum + minor, 0);
  const expenseTotalMinor = monthExpenseEntries.reduce((sum, [, minor]) => sum + minor, 0);
  const netTotalMinor = monthNetEntries.reduce((sum, [, minor]) => sum + minor, 0);
  const totalBalanceMinor = Object.values(totalsByCurrency).reduce(
    (sum, minor) => sum + minor,
    0
  );

  const budgetComplianceRatio =
    totalBudgets === 0 ? 1 : budgetsOnTrack / Math.max(totalBudgets, 1);

  const activityScore = selectedMonthActivityTransactions.length > 0 ? 15 : 5;
  const cashFlowScore =
    incomeTotalMinor === 0 && expenseTotalMinor === 0
      ? 10
      : netTotalMinor >= 0
      ? 35
      : incomeTotalMinor > 0
      ? Math.max(5, Math.round(35 * (incomeTotalMinor / Math.max(expenseTotalMinor, 1))))
      : 5;
  const budgetScore =
    totalBudgets === 0
      ? 18
      : Math.round(30 * budgetComplianceRatio) - budgetsOver * 4;
  const balanceScore = totalBalanceMinor >= 0 ? 20 : 8;

  const financialHealthScore = Math.max(
    0,
    Math.min(100, cashFlowScore + Math.max(0, budgetScore) + activityScore + balanceScore)
  );

  const financialHealthLabel =
    financialHealthScore >= 85
      ? "Excellent"
      : financialHealthScore >= 70
      ? "Good"
      : financialHealthScore >= 50
      ? "Watch"
      : "Needs attention";

  const selectedMonthStart = new Date(selectedYear, selectedMonth, 1);
  const selectedMonthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
  const now = new Date();
  const forecastWindowStart =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth()
      ? now
      : selectedMonthStart;

  const scheduledRecurringThisMonth = recurringRules.filter((rule) => {
    const nextRun = new Date(rule.next_run_at);
    if (Number.isNaN(nextRun.getTime())) return false;
    return nextRun >= forecastWindowStart && nextRun <= selectedMonthEnd;
  });

  const recurringIncomeByCurrency: Record<string, number> = {};
  const recurringExpenseByCurrency: Record<string, number> = {};

  for (const rule of scheduledRecurringThisMonth) {
    if (rule.type === "income") {
      recurringIncomeByCurrency[rule.currency_code] =
        (recurringIncomeByCurrency[rule.currency_code] ?? 0) + rule.amount_minor;
    } else {
      recurringExpenseByCurrency[rule.currency_code] =
        (recurringExpenseByCurrency[rule.currency_code] ?? 0) + rule.amount_minor;
    }
  }

  const forecastCurrencies = Array.from(
    new Set([
      ...Object.keys(totalsByCurrency),
      ...Object.keys(recurringIncomeByCurrency),
      ...Object.keys(recurringExpenseByCurrency),
    ])
  ).sort();

  const forecastEntries: ForecastEntry[] = forecastCurrencies.map((currencyCode) => {
    const currentBalanceMinor = totalsByCurrency[currencyCode] ?? 0;
    const scheduledIncomeMinor = recurringIncomeByCurrency[currencyCode] ?? 0;
    const scheduledExpenseMinor = recurringExpenseByCurrency[currencyCode] ?? 0;

    return {
      currencyCode,
      currentBalanceMinor,
      scheduledIncomeMinor,
      scheduledExpenseMinor,
      projectedBalanceMinor:
        currentBalanceMinor + scheduledIncomeMinor - scheduledExpenseMinor,
    };
  });

  const selectedDate = new Date(selectedYear, selectedMonth, 1);
  const monthLabel = selectedDate.toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  const smartAlerts: SmartAlert[] = [];

  if (netTotalMinor < 0) {
    smartAlerts.push({
      id: "negative-cash-flow",
      tone: "danger",
      title: "Negative cash flow",
      detail: `Expenses exceed income for ${monthLabel}. Review discretionary spending or add income entries.`,
    });
  } else if (incomeTotalMinor > 0 || expenseTotalMinor > 0) {
    smartAlerts.push({
      id: "positive-cash-flow",
      tone: "good",
      title: "Cash flow is stable",
      detail: `Income is covering expenses for ${monthLabel}.`,
    });
  }

  if (budgetsOver > 0) {
    smartAlerts.push({
      id: "budget-over",
      tone: "danger",
      title: "Budget exceeded",
      detail: `${budgetsOver} ${budgetsOver === 1 ? "budget is" : "budgets are"} over the limit this month.`,
    });
  } else if (budgetsAtRisk > 0) {
    smartAlerts.push({
      id: "budget-risk",
      tone: "watch",
      title: "Budget pressure",
      detail: `${budgetsAtRisk} ${budgetsAtRisk === 1 ? "budget is" : "budgets are"} approaching the limit.`,
    });
  } else if (totalBudgets > 0) {
    smartAlerts.push({
      id: "budgets-healthy",
      tone: "good",
      title: "Budgets are under control",
      detail: "No active budgets are currently over the risk threshold.",
    });
  }

  if (scheduledRecurringThisMonth.length > 0) {
    smartAlerts.push({
      id: "recurring-scheduled",
      tone: "neutral",
      title: "Recurring activity ahead",
      detail: `${scheduledRecurringThisMonth.length} active recurring ${scheduledRecurringThisMonth.length === 1 ? "rule is" : "rules are"} scheduled before month-end.`,
    });
  }

  if (smartAlerts.length === 0) {
    smartAlerts.push({
      id: "no-alerts",
      tone: "neutral",
      title: "No urgent alerts",
      detail: "Add more transactions, budgets, and recurring rules to unlock deeper monitoring.",
    });
  }

  const largestExpenseInsight = largestExpenseItem
    ? `${largestExpenseItem.categoryName} — ${formatMinorToAmount(largestExpenseItem.amountMinor)} ${largestExpenseItem.currencyCode}`
    : "No expense recorded";

  const executiveInsights: ExecutiveInsight[] = [
    {
      id: "cash-flow",
      label: "Cash flow",
      value:
        monthNetEntries.length > 0
          ? monthNetEntries
              .map(([currency, minor]) => `${formatMinorToAmount(minor)} ${currency}`)
              .join(" · ")
          : "0.00",
      helper:
        netTotalMinor >= 0
          ? "Income is covering expenses in the selected month."
          : "Expenses are higher than income in the selected month.",
    },
    {
      id: "largest-expense",
      label: "Largest expense",
      value: largestExpenseInsight,
      helper: "Highest single expense recorded in the selected month.",
    },
    {
      id: "budget-position",
      label: "Budget position",
      value:
        totalBudgets === 0
          ? "No budgets"
          : `${budgetsOnTrack} healthy · ${budgetsAtRisk} at risk · ${budgetsOver} over`,
      helper:
        totalBudgets === 0
          ? "Create budgets to unlock compliance scoring."
          : "Budget status based on selected-month actuals.",
    },
  ];

  // Dashboard Intelligence A.4: executive polish and prioritization
  const alertSeverityRank: Record<SmartAlert["tone"], number> = {
    neutral: 0,
    good: 1,
    watch: 2,
    danger: 3,
  };

  const highestAlertRank = smartAlerts.reduce(
    (rank, alert) => Math.max(rank, alertSeverityRank[alert.tone] ?? 0),
    0
  );

  const criticalAlertsCount = smartAlerts.filter(
    (alert) => alert.tone === "danger"
  ).length;
  const watchAlertsCount = smartAlerts.filter(
    (alert) => alert.tone === "watch"
  ).length;

  const executiveRiskLevel =
    criticalAlertsCount > 0 || financialHealthScore < 45
      ? "Critical"
      : highestAlertRank >= 2 || financialHealthScore < 65
      ? "Warning"
      : financialHealthScore < 80 || watchAlertsCount > 0
      ? "Watch"
      : "Healthy";

  const forecastConfidence =
    scheduledRecurringThisMonth.length >= 3 && selectedMonthActivityTransactions.length >= 5
      ? "High"
      : scheduledRecurringThisMonth.length > 0 || selectedMonthActivityTransactions.length >= 3
      ? "Medium"
      : "Low";

  const executiveBalanceSummary =
    Object.entries(totalsByCurrency).length > 0
      ? Object.entries(totalsByCurrency)
          .slice(0, 2)
          .map(([currency, minor]) => `${formatMinorToAmount(minor)} ${currency}`)
          .join(" · ")
      : "No wallet balance yet";

  const executiveNetFlowSummary =
    monthNetEntries.length > 0
      ? monthNetEntries
          .slice(0, 2)
          .map(([currency, minor]) => `${formatMinorToAmount(minor)} ${currency}`)
          .join(" · ")
      : "0.00";

  const forecastSummary =
    forecastEntries.length > 0
      ? forecastEntries
          .slice(0, 2)
          .map(
            (entry) =>
              `${formatMinorToAmount(entry.projectedBalanceMinor)} ${entry.currencyCode}`
          )
          .join(" · ")
      : "Create a wallet to unlock forecast";

  const executiveHeroMessage =
    executiveRiskLevel === "Critical"
      ? "Immediate review recommended. Cash flow or budget pressure needs attention."
      : executiveRiskLevel === "Warning"
      ? "Review the highlighted alerts before month-end to stay in control."
      : executiveRiskLevel === "Watch"
      ? "Your position is manageable, with a few items worth monitoring."
      : "Your financial position is stable for the selected month.";

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

  const lastSecurityLabel = lastCheckAt
    ? `${daysAgoFromMs(lastCheckAt)} day(s) ago`
    : "Not recorded";

  // ---------- Visual system ----------
  const CARD = "gl-premium-card rounded-[1.35rem] p-5";
  const CHART_CARD = "gl-premium-card gl-chart-card rounded-[1.45rem] p-5 sm:p-6";
  const CARD_TIGHT = "gl-premium-card rounded-[1.2rem] p-4";
  const KPI_CARD = "gl-premium-card rounded-[1.2rem] p-4";
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
    "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] " +
    "px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.35)]";
  const NAV_LINK =
    "px-3 py-1.5 rounded-full text-xs text-gray-300 hover:text-white " +
    "hover:bg-white/[0.09] transition whitespace-nowrap";
  const HEADER_BADGE =
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] " +
    "px-3 py-1 text-[11px] text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
  const HEADER_DOT = <span className="text-gray-600">•</span>;

  return (
    <div className="min-h-screen gl-dashboard-shell text-white flex flex-col">
      {/* Tight top header */}
      <header className="w-full gl-topbar border-b border-white/10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
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

      <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Command Center</h1>
            <p className="text-gray-400 text-sm">
              Premium financial intelligence across wallets, budgets, recurring flows, and activity.
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

        {/* Executive command center */}
        <section className="mb-8">
          {loadingData ? (
            <div className={CARD}>
              <Skeleton className="h-64 w-full" rounded="2xl" />
            </div>
          ) : (
            <ExecutiveHeroCard
              monthLabel={monthLabel}
              healthScore={financialHealthScore}
              healthLabel={financialHealthLabel}
              riskLevel={executiveRiskLevel}
              message={executiveHeroMessage}
              balanceSummary={executiveBalanceSummary}
              netFlowSummary={executiveNetFlowSummary}
              forecastSummary={forecastSummary}
              alertsCount={smartAlerts.length}
              criticalAlertsCount={criticalAlertsCount}
              forecastConfidence={forecastConfidence}
            />
          )}
        </section>

        {/* Executive KPI cards */}
        <section className="mb-8">
          <ExecutiveKpiCards
            loading={loadingData}
            walletsCount={wallets.length}
            totalsByCurrency={totalsByCurrency}
            incomeEntries={monthIncomeEntries}
            expenseEntries={monthExpenseEntries}
            netEntries={monthNetEntries}
            monthLabel={monthLabel}
          />
        </section>

        {/* Activity snapshot */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Activity Snapshot – {monthLabel}
              </h2>
              <p className="text-[11px] text-gray-400">
                Fast operational view of wallets, transactions, budgets, and recent movement.
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" rounded="2xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <QuickStatsRow
                walletsCount={wallets.length}
                monthTransactionsCount={selectedMonthActivityTransactions.length}
                categoriesCount={activeCategoryCount}
                activeBudgetsCount={totalBudgets}
              />

              <div className="grid gap-5 xl:grid-cols-3">
                <div className={CARD}>
                  <LargestExpenseWidget
                    item={largestExpenseItem}
                    monthLabel={monthLabel}
                  />
                </div>

                <div className={`${CARD} xl:col-span-2`}>
                  <RecentTransactionsWidget
                    transactions={recentTransactions}
                    monthLabel={monthLabel}
                  />
                </div>
              </div>

              <div className={CARD}>
                <BudgetHealthWidget
                  summaries={budgetSummaries}
                  totalBudgets={totalBudgets}
                  budgetsOnTrack={budgetsOnTrack}
                  budgetsAtRisk={budgetsAtRisk}
                  budgetsOver={budgetsOver}
                  riskThreshold={RISK_THRESHOLD}
                  monthLabel={monthLabel}
                />
              </div>
            </div>
          )}
        </section>

        {/* Gorilla Intelligence */}
        <section className="mb-12 gl-intelligence-suite rounded-[1.75rem] p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="gl-section-eyebrow">Premium intelligence layer</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Gorilla Intelligence™ – {monthLabel}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                The brain of Gorilla Ledger: health scoring, alerts, executive guidance, AI coaching, and projected month-end position.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 uppercase tracking-[0.16em]">
                {executiveRiskLevel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 uppercase tracking-[0.16em]">
                {forecastConfidence} confidence
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 uppercase tracking-[0.16em]">
                {smartAlerts.length} alerts
              </span>
            </div>
          </div>

          {loadingData ? (
            <div className="grid gap-5 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full" rounded="2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-12">
              <div className={`${CARD} xl:col-span-4`}>
                <FinancialHealthScore
                  score={financialHealthScore}
                  label={financialHealthLabel}
                  riskLevel={executiveRiskLevel}
                  cashFlowMinor={netTotalMinor}
                  budgetPressureCount={budgetsAtRisk + budgetsOver}
                  activeBudgetsCount={totalBudgets}
                  monthLabel={monthLabel}
                />
              </div>

              <div className={`${CARD} xl:col-span-4`}>
                <SmartAlertsPanel alerts={smartAlerts} riskLevel={executiveRiskLevel} />
              </div>

              <div className={`${CARD} xl:col-span-4`}>
                <ForecastMonthEndBalance
                  entries={forecastEntries}
                  scheduledRulesCount={scheduledRecurringThisMonth.length}
                  monthLabel={monthLabel}
                  confidence={forecastConfidence}
                />
              </div>

              <div className={`${CARD} xl:col-span-4`}>
                <ExecutiveInsightsPanel insights={executiveInsights} riskLevel={executiveRiskLevel} />
              </div>

              <div className={`${CARD} xl:col-span-4`}>
                <SmartInsightsPanel
                  transactions={transactions}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                />
              </div>

              <div className={`${CARD} xl:col-span-4`}>
                <AiInsightsSidebar
                  transactions={transactions}
                  categories={categories}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                />
              </div>
            </div>
          )}
        </section>

        {/* Spending trend */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="gl-section-eyebrow">Spending signal</span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                Spending Trend – {monthLabel}
              </h2>
              <p className="text-[12px] text-gray-400">
                Daily expense movement for the selected month. Internal transfers excluded.
              </p>
            </div>
          </div>

          <div className={CHART_CARD}>
            {loadingData ? (
              <Skeleton className={SK_CHART} rounded="2xl" />
            ) : monthlyIncomeExpenseData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
                No spending trend yet. Add transactions for {monthLabel} to see daily movement.
              </div>
            ) : (
              <SpendingTrendChart data={monthlyIncomeExpenseData} />
            )}
          </div>
        </section>

        {/* Executive trend (Hero chart) */}
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="gl-section-eyebrow">Executive trend</span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                Calendar-Year Income vs Expenses
              </h2>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
              Monthly trend for {targetCalendarYear}
            </div>
          </div>

          {loadingData ? (
            <div className={CHART_CARD}>
              <Skeleton className={SK_HERO} rounded="2xl" />
            </div>
          ) : (
            <div className={CHART_CARD}>
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
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="gl-section-eyebrow">Wallet position</span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                Net Worth by Currency
              </h2>
              <p className="text-[12px] text-gray-400">
                Wallet balances include starting balances and transactions. Internal transfers are included.
              </p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
              {wallets.length} {wallets.length === 1 ? "wallet" : "wallets"} tracked
            </div>
          </div>

          {loadingData ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" rounded="2xl" />
              ))}
            </div>
          ) : Object.keys(totalsByCurrency).length === 0 ? (
            <div className="gl-empty-state rounded-2xl p-6 text-sm">
              No balances yet. Add a wallet and your first transaction to activate the net-worth view.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(totalsByCurrency).map(([currency, minor]) => (
                <div key={currency} className="gl-currency-tile rounded-[1.35rem] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                      {currency}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-gray-300">
                      balance
                    </span>
                  </div>
                  <div className={`mt-4 ${KPI_VALUE_MD} tabular-nums`}>
                    {formatMinorToAmount(minor)}{" "}
                    <span className="text-sm text-gray-300">{currency}</span>
                  </div>
                  <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="mt-3 text-[11px] text-gray-500">
                    Current ledger position in {currency}.
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Chart filters */}
        <section className="mb-12 sticky top-0 z-30 -mx-4 px-4 pt-4 pb-4 bg-black/75 backdrop-blur-xl border-b border-white/10">
          <div className="gl-chart-filterbar rounded-[1.35rem] p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="gl-section-eyebrow">Analytics command bar</span>
              <p className="mt-2 text-[11px] text-gray-400">
                Tune the lens for category, wallet, and long-term chart analysis.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Wallet:</span>
                <select
                  value={walletFilter}
                  onChange={(e) => setWalletFilter(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-gray-100 outline-none transition hover:border-white/30"
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
                  className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-gray-100 outline-none transition hover:border-white/30"
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
                  className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-gray-100 outline-none transition hover:border-white/30"
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
        <section className="mb-12">
          <div className="mb-4 flex flex-col gap-2">
            <span className="gl-section-eyebrow">Category intelligence</span>
            <h2 className="text-xl font-semibold tracking-tight">Spending composition</h2>
            <p className="text-[12px] text-gray-400">Ranked category views for the selected filters.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className={CHART_CARD}>
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

            <div className={CHART_CARD}>
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
              <div className="gl-empty-state rounded-2xl p-6">
                <div className="text-sm font-semibold text-gray-100">No budgets configured</div>
                <p className="mt-2 max-w-2xl text-sm text-gray-400">
                  Create your first budget to unlock overspend alerts, budget scoring, and stronger forecast confidence.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-gray-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">Overspend alerts</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">Budget scoring</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">Forecast accuracy</span>
                </div>
              </div>
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
          <details className="group" open>
            <summary className="mb-5 flex cursor-pointer list-none flex-col gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="gl-section-eyebrow">Advanced analytics</span>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">Analytics vault</h2>
                <p className="text-[12px] text-gray-400">
                  Trend charts for seasonality, long-term patterns, and all-time net flow.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-gray-300">
                <span className="group-open:hidden">Show charts</span>
                <span className="hidden group-open:inline">Hide charts</span>
              </span>
            </summary>

            <div className="grid gap-5 lg:grid-cols-2 mb-5">
              <div className={CHART_CARD}>
                {loadingData ? (
                  <Skeleton className={SK_CHART_TALL} rounded="2xl" />
                ) : monthlyIncomeExpenseData.length === 0 ? (
                  <div className="gl-empty-state rounded-2xl p-6 text-sm">
                    No transactions yet to build a trend.
                  </div>
                ) : (
                  <MonthlyIncomeExpenseChart data={monthlyIncomeExpenseData} />
                )}
              </div>

              <div className={CHART_CARD}>
                {loadingData ? (
                  <Skeleton className={SK_CHART_TALL} rounded="2xl" />
                ) : incomeExpenseTrendLast12.length === 0 ? (
                  <div className="gl-empty-state rounded-2xl p-6 text-sm">
                    Not enough history yet to show this trend.
                  </div>
                ) : (
                  <HistoricalIncomeExpenseChart data={incomeExpenseTrendLast12} />
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className={CHART_CARD}>
                {loadingData ? (
                  <Skeleton className={SK_CHART_TALL} rounded="2xl" />
                ) : incomeExpenseTrendData.length === 0 ? (
                  <div className="gl-empty-state rounded-2xl p-6 text-sm">
                    No transactions yet to build an all-time trend.
                  </div>
                ) : (
                  <FullHistoryIncomeExpenseChart data={incomeExpenseTrendData} />
                )}
              </div>

              <div className={CHART_CARD}>
                {loadingData ? (
                  <Skeleton className={SK_CHART_TALL} rounded="2xl" />
                ) : incomeExpenseTrendData.length === 0 ? (
                  <div className="gl-empty-state rounded-2xl p-6 text-sm">
                    No transactions yet to build a cumulative net flow view.
                  </div>
                ) : (
                  <CumulativeNetBalanceChart data={incomeExpenseTrendData} />
                )}
              </div>
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}
