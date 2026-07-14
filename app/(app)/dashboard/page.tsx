"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabaseBrowserClient } from "@/lib/supabase/client";

// Dashboard charts
import SmartInsightsPanel from "@/components/dashboard/SmartInsightsPanel";
import BudgetInsightsPanel from "@/components/dashboard/BudgetInsightsPanel";
import AiInsightsSidebar from "@/components/dashboard/AiInsightsSidebar";
import ExecutiveKpiCards from "@/components/dashboard/ExecutiveKpiCards";
import QuickStatsRow from "@/components/dashboard/QuickStatsRow";
import RecentTransactionsWidget from "@/components/dashboard/RecentTransactionsWidget";
import LargestExpenseWidget from "@/components/dashboard/LargestExpenseWidget";
import BudgetHealthWidget from "@/components/dashboard/BudgetHealthWidget";
import FinancialHealthScore from "@/components/dashboard/FinancialHealthScore";
import SmartAlertsPanel from "@/components/dashboard/SmartAlertsPanel";
import ExecutiveInsightsPanel from "@/components/dashboard/ExecutiveInsightsPanel";
import ForecastMonthEndBalance from "@/components/dashboard/ForecastMonthEndBalance";
import ExecutiveHeroCard from "@/components/dashboard/ExecutiveHeroCard";
import { ActivationGuide } from "@/components/activation/ActivationGuide";

import Skeleton from "@/components/ui/Skeleton";

const DashboardAnalyticsAccordionItem = dynamic(
  () => import("@/components/dashboard/DashboardAnalyticsAccordionItem"),
  { ssr: false }
);

const ChartModuleLoading = () => (
  <div
    className="flex min-h-72 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xs text-gray-500"
    role="status"
    aria-live="polite"
  >
    Loading chart…
  </div>
);

const SpendingByCategoryChart = dynamic(
  () => import("@/components/dashboard/SpendingByCategoryChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const MonthlyIncomeExpenseChart = dynamic(
  () => import("@/components/dashboard/MonthlyIncomeExpenseChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const TopCategoriesBarChart = dynamic(
  () => import("@/components/dashboard/TopCategoriesBarChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const HistoricalIncomeExpenseChart = dynamic(
  () => import("@/components/dashboard/HistoricalIncomeExpenseChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const FullHistoryIncomeExpenseChart = dynamic(
  () => import("@/components/dashboard/FullHistoryIncomeExpenseChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const CumulativeNetBalanceChart = dynamic(
  () => import("@/components/dashboard/CumulativeNetBalanceChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const YearlyIncomeExpenseBarChart = dynamic(
  () => import("@/components/dashboard/YearlyIncomeExpenseBarChart"),
  { ssr: false, loading: ChartModuleLoading }
);
const SpendingTrendChart = dynamic(
  () => import("@/components/dashboard/SpendingTrendChart"),
  { ssr: false, loading: ChartModuleLoading }
);

import { isInternalTransfer } from "@/lib/transactions/classification";
import { buildDashboardReconciliation } from "@/lib/dashboard/reconciliation";
import {
  buildDailyIncomeExpenseSeries,
  buildDensifiedMonthSeries,
  takeTrailingTwelveMonths,
  type DailyIncomeExpensePoint,
} from "@/lib/dashboard/chartReconciliation";
import {
  buildBudgetReconciliation,
  buildMonthEndForecastReconciliation,
} from "@/lib/dashboard/budgetForecastReconciliation";
import { buildDashboardInsightModel } from "@/lib/dashboard/intelligence";
import { buildActivationModel } from "@/lib/activation/model";

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
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  next_run_at: string | null;
  is_active: boolean;
};

type SmartAlert = {
  id: string;
  tone: "good" | "watch" | "danger" | "neutral";
  title: string;
  detail: string;
};


function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}


const DASHBOARD_PAGE_SIZE = 1000;
const DASHBOARD_MAX_PAGES = 250;

type PagedResult<T> = {
  data: T[];
  error: Error | null;
};

function createAbortError(): Error {
  const error = new Error("Dashboard request was cancelled.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error &&
    (error.name === "AbortError" || /abort|cancel/i.test(error.message))
  );
}

/**
 * Fetches a complete, deterministically ordered dataset in bounded pages.
 *
 * The previous dashboard query used fixed `.limit(...)` clauses, which made
 * balances and historical analytics silently incomplete after the limit was
 * exceeded. Pagination preserves completeness without issuing one unbounded
 * browser request.
 */
async function fetchAllTransactions(
  signal: AbortSignal
): Promise<PagedResult<Transaction>> {
  const rows: Transaction[] = [];

  for (let page = 0; page < DASHBOARD_MAX_PAGES; page += 1) {
    if (signal.aborted) {
      return { data: [], error: createAbortError() };
    }

    const from = page * DASHBOARD_PAGE_SIZE;
    const to = from + DASHBOARD_PAGE_SIZE - 1;
    const result = await supabaseBrowserClient
      .from("transactions")
      .select(
        "id, wallet_id, category_id, type, amount_minor, currency_code, occurred_at"
      )
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
      .abortSignal(signal);

    if (result.error) {
      return { data: [], error: new Error(result.error.message) };
    }

    const pageRows = (result.data ?? []) as Transaction[];
    rows.push(...pageRows);

    if (pageRows.length < DASHBOARD_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }

  return {
    data: [],
    error: new Error(
      "Dashboard transaction history exceeded the supported pagination safety limit."
    ),
  };
}

async function fetchAllBudgets(
  signal: AbortSignal
): Promise<PagedResult<Budget>> {
  const rows: Budget[] = [];

  for (let page = 0; page < DASHBOARD_MAX_PAGES; page += 1) {
    if (signal.aborted) {
      return { data: [], error: createAbortError() };
    }

    const from = page * DASHBOARD_PAGE_SIZE;
    const to = from + DASHBOARD_PAGE_SIZE - 1;
    const result = await supabaseBrowserClient
      .from("budgets")
      .select("id, wallet_id, category_id, year, month, amount_minor")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
      .abortSignal(signal);

    if (result.error) {
      return { data: [], error: new Error(result.error.message) };
    }

    const pageRows = (result.data ?? []) as Budget[];
    rows.push(...pageRows);

    if (pageRows.length < DASHBOARD_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }

  return {
    data: [],
    error: new Error(
      "Dashboard budget history exceeded the supported pagination safety limit."
    ),
  };
}

async function fetchAllActiveRecurringRules(
  signal: AbortSignal
): Promise<PagedResult<RecurringRule>> {
  const rows: RecurringRule[] = [];

  for (let page = 0; page < DASHBOARD_MAX_PAGES; page += 1) {
    if (signal.aborted) {
      return { data: [], error: createAbortError() };
    }

    const from = page * DASHBOARD_PAGE_SIZE;
    const to = from + DASHBOARD_PAGE_SIZE - 1;
    const result = await supabaseBrowserClient
      .from("recurring_rules")
      .select(
        "id, wallet_id, category_id, type, amount_minor, currency_code, frequency, interval, day_of_month, day_of_week, start_date, end_date, next_run_at, is_active"
      )
      .eq("is_active", true)
      .order("next_run_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .abortSignal(signal);

    if (result.error) {
      return { data: [], error: new Error(result.error.message) };
    }

    const pageRows = (result.data ?? []) as RecurringRule[];
    rows.push(...pageRows);

    if (pageRows.length < DASHBOARD_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }

  return {
    data: [],
    error: new Error(
      "Active recurring rules exceeded the supported pagination safety limit."
    ),
  };
}

export default function DashboardPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

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
    const controller = new AbortController();
    const { signal } = controller;
    let isMounted = true;

    const canCommit = () => isMounted && !signal.aborted;

    async function init() {
      if (canCommit()) {
        setCheckingSession(true);
        setErrorMsg("");
      }

      try {
        // Authentication does not currently expose an AbortSignal, so every
        // post-await state transition is protected by canCommit().
        const {
          data: { session },
        } = await supabaseBrowserClient.auth.getSession();

        if (!canCommit()) return;

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        if (!canCommit()) return;
        setCheckingSession(false);
        setLoadingData(true);

        const [walletRes, categoryRes, txRes, budgetRes, recurringRes] =
          await Promise.all([
            supabaseBrowserClient
              .from("wallets")
              .select("id, name, currency_code, starting_balance_minor")
              .order("created_at", { ascending: true })
              .abortSignal(signal),
            supabaseBrowserClient
              .from("categories")
              .select("id, name, type")
              .eq("is_active", true)
              .order("type", { ascending: true })
              .order("name", { ascending: true })
              .abortSignal(signal),
            fetchAllTransactions(signal),
            fetchAllBudgets(signal),
            fetchAllActiveRecurringRules(signal),
          ]);

        if (!canCommit()) return;

        if (walletRes.error) {
          if (isAbortError(walletRes.error)) return;
          console.error(walletRes.error);
          setErrorMsg(walletRes.error.message);
          return;
        }
        if (categoryRes.error) {
          if (isAbortError(categoryRes.error)) return;
          console.error(categoryRes.error);
          setErrorMsg(categoryRes.error.message);
          return;
        }
        if (txRes.error) {
          if (isAbortError(txRes.error)) return;
          console.error(txRes.error);
          setErrorMsg(txRes.error.message);
          return;
        }
        if (budgetRes.error) {
          if (isAbortError(budgetRes.error)) return;
          console.error(budgetRes.error);
          setErrorMsg(budgetRes.error.message);
          return;
        }

        if (recurringRes.error) {
          if (!isAbortError(recurringRes.error)) {
            // Recurring data is optional for the main dashboard; forecasts
            // degrade safely when this dataset is unavailable.
            console.error("Error loading recurring rules:", recurringRes.error);
            setRecurringRules([]);
          }
        } else {
          setRecurringRules(recurringRes.data as RecurringRule[]);
        }

        setWallets(walletRes.data as Wallet[]);
        setCategories(categoryRes.data as Category[]);
        setTransactions(txRes.data as Transaction[]);
        setBudgets(budgetRes.data as Budget[]);
      } catch (error: unknown) {
        if (!canCommit() || isAbortError(error)) return;
        console.error("Dashboard initialization failed:", error);
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "The dashboard could not be loaded."
        );
      } finally {
        if (canCommit()) {
          setCheckingSession(false);
          setLoadingData(false);
        }
      }
    }

    void init();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  // ----- Derived data -----

  const walletMap = useMemo(
    () => Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet] as const)),
    [wallets]
  );
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category] as const)),
    [categories]
  );
  const walletNamesById = useMemo(
    () => Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name] as const)),
    [wallets]
  );
  const activationModel = useMemo(
    () =>
      buildActivationModel({
        walletCount: wallets.length,
        incomeCategoryCount: categories.filter((category) => category.type === "income").length,
        expenseCategoryCount: categories.filter((category) => category.type === "expense").length,
        transactionCount: transactions.length,
        budgetCount: budgets.length,
        recurringRuleCount: recurringRules.length,
      }),
    [budgets.length, categories, recurringRules.length, transactions.length, wallets.length]
  );

  // Per-wallet balances and currency totals are derived once per source-data
  // change instead of being rebuilt by every unrelated UI interaction.
  const totalsByCurrency = useMemo(() => {
    const deltaByWallet: Record<string, number> = {};

    for (const tx of transactions) {
      const sign = tx.type === "income" ? 1 : -1;
      deltaByWallet[tx.wallet_id] =
        (deltaByWallet[tx.wallet_id] ?? 0) + sign * tx.amount_minor;
    }

    const balances = wallets.map((wallet) => ({
      ...wallet,
      balanceMinor:
        wallet.starting_balance_minor + (deltaByWallet[wallet.id] ?? 0),
    }));

    const totals: Record<string, number> = {};
    for (const wallet of balances) {
      totals[wallet.currency_code] =
        (totals[wallet.currency_code] ?? 0) + wallet.balanceMinor;
    }

    return totals;
  }, [transactions, wallets]);

  // One selected-month pass now supplies both KPI totals and activity widgets.
  const {
    monthIncomeByCurrency,
    monthExpenseByCurrency,
    selectedMonthActivityTransactions,
  } = useMemo(() => {
    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};
    const activityTransactions: Transaction[] = [];

    for (const tx of transactions) {
      const date = new Date(tx.occurred_at);
      if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== selectedYear ||
        date.getMonth() !== selectedMonth
      ) {
        continue;
      }

      const category = tx.category_id ? categoryMap[tx.category_id] : null;
      if (isInternalTransfer(tx, category)) continue;

      activityTransactions.push(tx);
      if (tx.type === "income") {
        incomeByCurrency[tx.currency_code] =
          (incomeByCurrency[tx.currency_code] ?? 0) + tx.amount_minor;
      } else {
        expenseByCurrency[tx.currency_code] =
          (expenseByCurrency[tx.currency_code] ?? 0) + tx.amount_minor;
      }
    }

    return {
      monthIncomeByCurrency: incomeByCurrency,
      monthExpenseByCurrency: expenseByCurrency,
      selectedMonthActivityTransactions: activityTransactions,
    };
  }, [categoryMap, selectedMonth, selectedYear, transactions]);

  const RISK_THRESHOLD = 0.8;
  const budgetReconciliation = useMemo(
    () =>
      buildBudgetReconciliation({
        budgets,
        wallets,
        categories,
        transactions,
        selectedYear,
        selectedMonth0: selectedMonth,
        riskThreshold: RISK_THRESHOLD,
        isInternalTransfer,
      }),
    [budgets, categories, selectedMonth, selectedYear, transactions, wallets]
  );

  const budgetSummaries = budgetReconciliation.summaries;
  const budgetStatsByCurrency = budgetReconciliation.statsByCurrency;
  const totalBudgets = budgetReconciliation.totalBudgets;
  const budgetsOnTrack = budgetReconciliation.budgetsOnTrack;
  const budgetsAtRisk = budgetReconciliation.budgetsAtRisk;
  const budgetsOver = budgetReconciliation.budgetsOver;

  const recentTransactions = useMemo(
    () =>
      selectedMonthActivityTransactions.slice(0, 5).map((tx) => ({
        id: tx.id,
        type: tx.type,
        amountMinor: tx.amount_minor,
        currencyCode: tx.currency_code,
        occurredAt: tx.occurred_at,
        categoryName: tx.category_id
          ? categoryMap[tx.category_id]?.name ?? "Uncategorized"
          : "Uncategorized",
        walletName: walletMap[tx.wallet_id]?.name ?? "Unknown wallet",
      })),
    [categoryMap, selectedMonthActivityTransactions, walletMap]
  );

  const reconciliationEntries = useMemo(
    () =>
      buildDashboardReconciliation({
        totalsByCurrency,
        incomeByCurrency: monthIncomeByCurrency,
        expenseByCurrency: monthExpenseByCurrency,
        monthTransactions: selectedMonthActivityTransactions,
        budgetStatsByCurrency,
      }),
    [
      budgetStatsByCurrency,
      monthExpenseByCurrency,
      monthIncomeByCurrency,
      selectedMonthActivityTransactions,
      totalsByCurrency,
    ]
  );

  const activeCategoryCount = useMemo(
    () => categories.filter((category) => category.type === "expense").length,
    [categories]
  );

  const forecastReconciliation = useMemo(
    () =>
      buildMonthEndForecastReconciliation({
        totalsByCurrency,
        recurringRules,
        selectedYear,
        selectedMonth0: selectedMonth,
      }),
    [recurringRules, selectedMonth, selectedYear, totalsByCurrency]
  );

  const monthLabel = useMemo(
    () =>
      new Date(selectedYear, selectedMonth, 1).toLocaleString("en", {
        month: "long",
        year: "numeric",
      }),
    [selectedMonth, selectedYear]
  );

  const dashboardInsightModel = useMemo(
    () =>
      buildDashboardInsightModel({
        reconciliationEntries,
        budgetReconciliation,
        forecastReconciliation,
        filters: {
          walletId: walletFilter === "all" ? null : walletFilter,
          categoryId: categoryFilter === "all" ? null : categoryFilter,
          currencyCode: null,
          period: {
            start: new Date(selectedYear, selectedMonth, 1).toISOString(),
            end: new Date(
              selectedYear,
              selectedMonth + 1,
              0,
              23,
              59,
              59,
              999
            ).toISOString(),
            label: monthLabel,
            year: selectedYear,
            month0: selectedMonth,
          },
        },
        sourceCounts: {
          transactions: transactions.length,
          wallets: wallets.length,
          budgets: budgets.length,
          recurringRules: recurringRules.length,
        },
        resolveTransactionPresentation: (transaction) => ({
          categoryName: transaction?.category_id
            ? categoryMap[transaction.category_id]?.name ?? "Uncategorized"
            : "Uncategorized",
          description: null,
        }),
      }),
    [
      budgetReconciliation,
      budgets.length,
      categoryFilter,
      categoryMap,
      forecastReconciliation,
      monthLabel,
      reconciliationEntries,
      recurringRules.length,
      selectedMonth,
      selectedYear,
      transactions.length,
      walletFilter,
      wallets.length,
    ]
  );

  const weakestCurrencyInsight =
    dashboardInsightModel.currencies.find(
      (currency) =>
        currency.currencyCode === dashboardInsightModel.weakestCurrencyCode
    ) ?? null;

  const weakestCurrencyHealth = {
    currencyCode: weakestCurrencyInsight?.currencyCode ?? "—",
    score: weakestCurrencyInsight?.health.score ?? 0,
    label: weakestCurrencyInsight?.health.label ?? "No activity",
  };
  const financialHealthScore = weakestCurrencyHealth.score;
  const financialHealthLabel = weakestCurrencyHealth.label;

  const smartAlerts: SmartAlert[] = dashboardInsightModel.alerts.map(
    (alert) => ({
      id: alert.id,
      tone:
        alert.severity === "critical"
          ? "danger"
          : alert.severity === "warning"
          ? "watch"
          : alert.severity === "success"
          ? "good"
          : "neutral",
      title: alert.title,
      detail:
        alert.currencyCode === "GLOBAL"
          ? alert.message
          : `${alert.message} ${
              alert.metricKey === "netMinor"
                ? `Net: ${formatMinorToAmount(
                    Math.abs(
                      dashboardInsightModel.currencies.find(
                        (currency) =>
                          currency.currencyCode === alert.currencyCode
                      )?.netMinor ?? 0
                    )
                  )} ${alert.currencyCode}.`
                : ""
            }`.trim(),
    })
  );

  if (smartAlerts.length === 0) {
    smartAlerts.push({
      id: "no-alerts",
      tone: "neutral",
      title: "No urgent alerts",
      detail:
        "Add more transactions, budgets, and recurring rules to unlock deeper monitoring.",
    });
  }

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

  const transactionMonthsTracked = new Set(
    transactions
      .map((tx) => {
        const date = new Date(tx.occurred_at);
        if (Number.isNaN(date.getTime())) return null;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      })
      .filter(Boolean)
  ).size;

  const forecastConfidence =
    transactionMonthsTracked >= 12
      ? "Established"
      : transactionMonthsTracked >= 6
      ? "Reliable"
      : transactionMonthsTracked >= 3
      ? "Emerging"
      : "Building History";

  const executiveBalanceSummary =
    dashboardInsightModel.currencies.length > 0
      ? dashboardInsightModel.currencies
          .slice(0, 2)
          .map(
            (currency) =>
              `${formatMinorToAmount(currency.balanceMinor)} ${currency.currencyCode}`
          )
          .join(" · ")
      : "No wallet balance yet";

  const executiveNetFlowSummary =
    dashboardInsightModel.currencies.length > 0
      ? dashboardInsightModel.currencies
          .slice(0, 2)
          .map(
            (currency) =>
              `${formatMinorToAmount(currency.netMinor)} ${currency.currencyCode}`
          )
          .join(" · ")
      : "0.00";

  const forecastableCurrencies = dashboardInsightModel.currencies.filter(
    (currency) => currency.forecast.availability === "available"
  );
  const forecastSummary =
    forecastableCurrencies.length > 0
      ? forecastableCurrencies
          .slice(0, 2)
          .map(
            (currency) =>
              `${formatMinorToAmount(currency.forecast.projectedBalanceMinor)} ${currency.currencyCode}`
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

  // -------- Certified chart reconciliation pipeline --------

  type IncomeExpenseDailyPoint = DailyIncomeExpensePoint;

  // Years available in transactions (for year filter)
  const chartYearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          transactions.map((tx) => {
            const date = new Date(tx.occurred_at);
            return Number.isNaN(date.getTime())
              ? null
              : String(date.getFullYear());
          })
        )
      )
        .filter((year): year is string => Boolean(year))
        .sort(),
    [transactions]
  );

  const incomeExpenseTrendData: IncomeExpenseDailyPoint[] = useMemo(
    () =>
      buildDailyIncomeExpenseSeries(transactions, categoryMap, {
        walletFilter,
        categoryFilter,
        yearFilter,
      }),
    [categoryFilter, categoryMap, transactions, walletFilter, yearFilter]
  );

  const incomeExpenseTrendLast12: IncomeExpenseDailyPoint[] = useMemo(
    () => takeTrailingTwelveMonths(incomeExpenseTrendData),
    [incomeExpenseTrendData]
  );

  const monthlyIncomeExpenseData: IncomeExpenseDailyPoint[] = useMemo(
    () =>
      buildDensifiedMonthSeries(
        transactions,
        categoryMap,
        { walletFilter, categoryFilter },
        selectedYear,
        selectedMonth
      ),
    [
      categoryFilter,
      categoryMap,
      selectedMonth,
      selectedYear,
      transactions,
      walletFilter,
    ]
  );

  // Calendar-year selection for the new bar chart:
  // - if Year filter is "all", default to current calendar year
  // - else use the selected year
  const targetCalendarYear = (() => {
    if (yearFilter === "all") return new Date().getFullYear();
    const parsed = Number(yearFilter);
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  })();

  // ---------- Visual system ----------
  const CARD = "gl-premium-card rounded-[1.35rem] p-4 sm:p-5";
  const CHART_CARD = "gl-premium-card gl-chart-card min-w-0 overflow-hidden rounded-[1.45rem] p-3.5 sm:p-6";

  // KPI typography helpers
  const KPI_VALUE = "font-semibold tracking-tight tabular-nums leading-none";
  const KPI_VALUE_MD = `text-xl sm:text-2xl ${KPI_VALUE}`;

  // Skeleton heights (stable layout, low CLS)
  const SK_HERO = "h-[320px] sm:h-[360px]";
  const SK_CHART = "h-[300px] sm:h-[320px]";
  const SK_CHART_TALL = "h-[320px] sm:h-[360px]";


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

  return (
    <div className="gl-page-migrated gl-dashboard-shell">
      {/* Tight top header */}
<div className="gl-page-shell gl-dashboard-main max-w-7xl" aria-labelledby="dashboard-title">
        <div className="gl-dashboard-page-header">
          <div>
            <h1 id="dashboard-title" className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Command Center</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">
              Premium financial intelligence across wallets, budgets, recurring flows, and activity.
            </p>
          </div>

          {/* Month selector */}
          <div className="gl-month-switcher" role="group" aria-label="Dashboard month navigation">
            <button type="button" onClick={goToPreviousMonth} className="gl-month-switcher-button" aria-label="Previous month">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12.5 5-5 5 5 5" /></svg>
            </button>
            <div className="gl-month-switcher-label" aria-live="polite">{monthLabel}</div>
            <button type="button" onClick={goToNextMonth} className="gl-month-switcher-button" aria-label="Next month">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7.5 5 5 5-5 5" /></svg>
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="mb-6 text-red-400 text-sm" role="alert">
            {errorMsg}
          </p>
        )}

        {loadingData ? (
          <Skeleton className="mb-7 h-64 w-full sm:mb-8" rounded="2xl" />
        ) : (
          <ActivationGuide model={activationModel} />
        )}

        {/* Executive command center */}
        <section className="mb-7 sm:mb-8">
          {loadingData ? (
            <div className={CARD}>
              <Skeleton className="h-64 w-full" rounded="2xl" />
            </div>
          ) : (
            <ExecutiveHeroCard
              monthLabel={monthLabel}
              healthScore={financialHealthScore}
              healthLabel={financialHealthLabel}
              healthCurrency={weakestCurrencyHealth.currencyCode}
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
        <section className="mb-7 sm:mb-8">
          <ExecutiveKpiCards
            loading={loadingData}
            walletsCount={wallets.length}
            model={dashboardInsightModel}
          />
        </section>

        {/* Activity snapshot */}
        <section className="mb-9 sm:mb-10">
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
                    model={dashboardInsightModel}
                    walletNamesById={walletNamesById}
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
                  model={dashboardInsightModel}
                  summaries={budgetSummaries}
                  riskThreshold={RISK_THRESHOLD}
                />
              </div>
            </div>
          )}
        </section>

        {/* Gorilla Intelligence */}
        <section className="mb-10 gl-intelligence-suite rounded-[1.5rem] p-3.5 sm:mb-12 sm:rounded-[1.75rem] sm:p-6">
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
                {forecastConfidence}
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5">
              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <FinancialHealthScore model={dashboardInsightModel} />
              </div>

              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <SmartAlertsPanel alerts={smartAlerts} riskLevel={executiveRiskLevel} />
              </div>

              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <ForecastMonthEndBalance
                  model={dashboardInsightModel}
                  confidence={forecastConfidence}
                />
              </div>

              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <ExecutiveInsightsPanel model={dashboardInsightModel} />
              </div>

              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <SmartInsightsPanel model={dashboardInsightModel} />
              </div>

              <div className={`${CARD} md:col-span-1 xl:col-span-4`}>
                <AiInsightsSidebar model={dashboardInsightModel} />
              </div>
            </div>
          )}
        </section>

        {/* Spending trend */}
        <DashboardAnalyticsAccordionItem title="Spending Trend" kicker="Spending signal" description="Daily expense movement for the selected month." defaultOpenOnMobile>
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
        </DashboardAnalyticsAccordionItem>

        {/* Executive trend (Hero chart) */}
        <DashboardAnalyticsAccordionItem title="Calendar-Year Income vs Expenses" kicker="Executive trend" description="Monthly income versus expenses for the selected year.">
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
        </DashboardAnalyticsAccordionItem>

        {/* Total Balance by currency */}
        <DashboardAnalyticsAccordionItem title="Net Worth by Currency" kicker="Wallet position" description="Current balances grouped by currency.">
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
        </DashboardAnalyticsAccordionItem>

        {/* Chart filters */}
        <section className="gl-dashboard-filter-dock">
          <div className="gl-chart-filterbar rounded-[1.35rem] p-3.5 sm:p-4 lg:flex lg:items-center lg:justify-between lg:gap-6">
            <div>
              <span className="gl-section-eyebrow">Analytics command bar</span>
              <p className="mt-2 text-[11px] text-gray-400">
                Tune the lens for category, wallet, and long-term chart analysis.
              </p>
            </div>
            <div className="gl-dashboard-filter-controls">
              <div className="gl-dashboard-filter-field">
                <label htmlFor="dashboard-wallet-filter" className="text-gray-400">Wallet:</label>
                <select
                  id="dashboard-wallet-filter"
                  aria-label="Filter dashboard analytics by wallet"
                  value={walletFilter}
                  onChange={(e) => setWalletFilter(e.target.value)}
                  className="gl-dashboard-filter-select"
                >
                  <option value="all">All wallets</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="gl-dashboard-filter-field">
                <label htmlFor="dashboard-category-filter" className="text-gray-400">Category:</label>
                <select
                  id="dashboard-category-filter"
                  aria-label="Filter dashboard analytics by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="gl-dashboard-filter-select"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gl-dashboard-filter-field">
                <label htmlFor="dashboard-year-filter" className="text-gray-400">Year:</label>
                <select
                  id="dashboard-year-filter"
                  aria-label="Filter dashboard analytics by year"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="gl-dashboard-filter-select"
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
        <DashboardAnalyticsAccordionItem title="Spending Composition" kicker="Category intelligence" description="Ranked category views for the selected filters.">
          <div className="mb-4 flex flex-col gap-2">
            <span className="gl-section-eyebrow">Category intelligence</span>
            <h2 className="text-xl font-semibold tracking-tight">Spending composition</h2>
            <p className="text-[12px] text-gray-400">Ranked category views for the selected filters.</p>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
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
        </DashboardAnalyticsAccordionItem>

        {/* Budget control */}
        <DashboardAnalyticsAccordionItem title="Budget Control" kicker="Budget intelligence" description="Budget health and budget-vs-actual performance.">
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
              model={dashboardInsightModel}
              summaries={budgetSummaries}
              riskThreshold={RISK_THRESHOLD}
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

                    const currency = item.currencyCode ?? wallet?.currency_code ?? "";
                    const isScorable = item.isScorable;
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

                    let statusLabel = isScorable ? "ON TRACK" : "UNSCORED";
                    let statusBorder = "border-gray-700";
                    let statusText = isScorable ? "text-gray-300" : "text-gray-400";

                    if (isScorable && usedRatio > 1) {
                      statusLabel = "OVER BUDGET";
                      statusBorder = "border-white/70";
                      statusText = "text-white";
                    } else if (isScorable && usedRatio > RISK_THRESHOLD && usedRatio <= 1) {
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
                              {isScorable
                                ? `${labelVerb} ${formatMinorToAmount(actualMinor)} / ${formatMinorToAmount(budget.amount_minor)} ${currency}`
                                : item.scoringReason ?? "Budget cannot be scored"}
                            </div>
                            <div className="text-xs text-gray-400 ml-3 whitespace-nowrap tabular-nums">
                              {isScorable ? `${usedPercent}% of budget used` : "—"}
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

                          {isScorable && usedPercent > 100 && (
                            <div className="mt-1 text-[11px] text-gray-400">
                              You&apos;ve exceeded this budget.
                            </div>
                          )}
                          {isScorable && usedPercent <= 100 &&
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
        </DashboardAnalyticsAccordionItem>

        {/* Advanced analytics */}
        <DashboardAnalyticsAccordionItem title="Analytics Vault" kicker="Advanced analytics" description="Long-term charts for seasonality, history, and net flow.">
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

            <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
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
        </DashboardAnalyticsAccordionItem>
      </div>
    </div>
  );
}
