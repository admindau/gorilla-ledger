"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecurringCommandCenter } from "@/components/recurring/RecurringCommandCenter";
import { RecurringInsights } from "@/components/recurring/RecurringInsights";
import { RecurringRuleCard } from "@/components/recurring/RecurringRuleCard";
import { RecurringTimeline } from "@/components/recurring/RecurringTimeline";
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

type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  description: string | null;
  amount_minor: number;
  currency_code: string;
  type: "income" | "expense" | string;
  frequency: RecurringFrequency | string;
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  total_runs: number | null;
  is_active: boolean;
};

type RecurringRunLog = {
  id: string;
  rule_id: string;
  user_id: string;
  transaction_id: string | null;
  run_at: string;
  status: "success" | "failed" | "skipped" | string;
  details: string | null;
  created_at: string;
};


export default function RecurringPage() {
  const { showToast } = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [runLogs, setRunLogs] = useState<RecurringRunLog[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  // form state
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [firstRunDate, setFirstRunDate] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [description, setDescription] = useState("");

  const now = useMemo(() => new Date(), []);
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  // Load wallets, categories, existing rules, and user email
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadingPage(true);
      setLoadError(false);
      const supabase = supabaseBrowserClient;

      try {
        const [
          { data: w, error: wErr },
          { data: c, error: cErr },
          { data: r, error: rErr },
          { data: logs, error: logsErr },
        ] = await Promise.all([
          supabase
            .from("wallets")
            .select("id,name,currency_code")
            .order("name", { ascending: true }),
          supabase
            .from("categories")
            .select("id,name,type")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("recurring_rules")
            .select(
              "id,user_id,wallet_id,category_id,description,amount_minor,currency_code,type,frequency,interval,day_of_month,day_of_week,start_date,next_run_at,last_run_at,total_runs,is_active"
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("recurring_run_logs")
            .select("id,rule_id,user_id,transaction_id,run_at,status,details,created_at")
            .order("run_at", { ascending: false })
            .limit(12),
        ]);

        if (cancelled) return;

        if (wErr || cErr || rErr || logsErr) {
          console.error("Unable to certify recurring automation data:", {
            walletError: wErr,
            categoryError: cErr,
            ruleError: rErr,
            runLogError: logsErr,
          });
          setLoadError(true);
          return;
        }

        setWallets(w ?? []);
        setCategories(c ?? []);
        setRules((r as RecurringRule[]) ?? []);
        setRunLogs((logs as RecurringRunLog[]) ?? []);
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [loadVersion]);

  // Create a new recurring rule
  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();

    if (!walletId || !categoryId || !amount || !firstRunDate) {
      showToast("Please fill all required fields.", "error");
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Amount must be a positive number.", "error");
      return;
    }

    const supabase = supabaseBrowserClient;

    // 🔐 Get current user for user_id / RLS
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user:", userError);
    }

    if (!user) {
      showToast("You must be logged in to create a recurring rule.", "error");
      return;
    }

    const amountMinor = Math.round(parsedAmount * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      showToast("Enter a valid recurring amount greater than zero.", "error");
      return;
    }

    const selectedWallet = wallets.find((w) => w.id === walletId);
    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (!selectedWallet || !selectedCategory) {
      showToast("Select a valid wallet and category.", "error");
      return;
    }

    const currencyCode = selectedWallet.currency_code;
    const type: "income" | "expense" = selectedCategory.type;

    const firstDate = new Date(`${firstRunDate}T00:00:00Z`);
    if (Number.isNaN(firstDate.getTime())) {
      showToast("Select a valid first run date.", "error");
      return;
    }
    const dayOfMonth = firstDate.getUTCDate();
    const dayOfWeek = firstDate.getUTCDay();
    const nextRunAt = firstDate.toISOString(); // timestamptz-safe

    setSaving(true);

    const { error } = await supabase.from("recurring_rules").insert({
      user_id: user.id, // 🔑 satisfy NOT NULL + RLS
      wallet_id: walletId,
      category_id: categoryId,
      type, // 🔑 satisfy recurring_rules_type_check
      amount_minor: amountMinor,
      currency_code: currencyCode,
      frequency,
      interval: 1,
      day_of_month: frequency === "monthly" || frequency === "yearly" ? dayOfMonth : null,
      day_of_week: frequency === "weekly" ? dayOfWeek : null,
      start_date: firstRunDate,
      next_run_at: nextRunAt,
      description: description || null,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      console.error("Failed to create recurring rule:", error);
      showToast("Failed to create recurring rule.", "error");
      return;
    }

    showToast("Recurring rule created.", "success");
    setAmount("");
    setDescription("");
    setFrequency("monthly");

    // reload rules from base table
    const { data: r, error: rErr } = await supabase
      .from("recurring_rules")
      .select(
        "id,user_id,wallet_id,category_id,description,amount_minor,currency_code,type,frequency,interval,day_of_month,day_of_week,start_date,next_run_at,last_run_at,total_runs,is_active"
      )
      .order("created_at", { ascending: true });

    if (rErr) {
      console.error("Failed to reload recurring rules:", rErr);
    } else {
      setRules((r as RecurringRule[]) ?? []);
    }
  }

  async function toggleRuleActive(rule: RecurringRule, isActive: boolean) {
    const supabase = supabaseBrowserClient;

    const { error } = await supabase
      .from("recurring_rules")
      .update({ is_active: isActive })
      .eq("id", rule.id);

    if (error) {
      console.error(error);
      showToast(
        isActive
          ? "Failed to activate recurring rule."
          : "Failed to pause recurring rule.",
        "error"
      );
      return;
    }

    showToast(
      isActive ? "Rule activated successfully." : "Rule paused successfully.",
      "success"
    );

    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: isActive } : r))
    );
  }

  async function deleteRule(rule: RecurringRule) {
    if (
      !window.confirm(
        `Delete recurring rule for ${rule.description || "rule"}?`
      )
    ) {
      return;
    }

    const supabase = supabaseBrowserClient;

    const { error } = await supabase
      .from("recurring_rules")
      .delete()
      .eq("id", rule.id);

    if (error) {
      console.error(error);
      showToast("Failed to delete recurring rule.", "error");
      return;
    }

    showToast("Recurring rule deleted.", "success");
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
  }
  function formatDateTimeWithTime(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRunLogTone(status: string) {
    if (status === "success") {
      return "border-emerald-500/60 text-emerald-300 bg-emerald-950/20";
    }

    if (status === "failed") {
      return "border-red-500/60 text-red-300 bg-red-950/20";
    }

    return "border-amber-500/60 text-amber-300 bg-amber-950/20";
  }

  function getRuleLabel(ruleId: string) {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return "Recurring rule";

    const category = categories.find((c) => c.id === rule.category_id);
    return rule.description || category?.name || "Recurring rule";
  }

  function getRunLogSummary() {
    return runLogs.reduce(
      (acc, log) => {
        if (log.status === "success") acc.success += 1;
        else if (log.status === "failed") acc.failed += 1;
        else acc.skipped += 1;
        return acc;
      },
      { success: 0, failed: 0, skipped: 0 }
    );
  }

  const runLogSummary = getRunLogSummary();


  return (
    <div className="gl-page-migrated">
      {/* ========================= Hardened Top Navigation ========================= */}
{/* ========================= Page Content ========================= */}
      <main className="gl-page-shell max-w-5xl">
          <PageHeader
            eyebrow="Automation"
            title={`Recurring Automation Center – ${monthName} ${year}`}
            description="Monitor recurring income, expenses, upcoming executions, run history, and automation health from one command center."
          />

          <RecurringCommandCenter
            rules={rules}
            runLogs={runLogs}
            dataState={loadingPage ? "loading" : loadError ? "error" : "ready"}
          />

          {loadError ? <DataLoadAlert onRetry={() => setLoadVersion((value) => value + 1)} /> : null}

          {!loadError ? (
            <RecurringTimeline
              rules={rules}
              wallets={wallets}
              categories={categories}
              loading={loadingPage}
            />
          ) : null}

          <form
            onSubmit={handleCreateRule}
            className="gl-premium-card mb-8 space-y-4 p-4 text-sm"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                New automation
              </p>
              <h2 className="mt-1 text-sm font-semibold">Add a Recurring Rule</h2>
              <p className="mt-1 text-xs text-gray-500">
                Create scheduled transactions for predictable income, bills, subscriptions, and renewals.
              </p>
            </div>

            <PrerequisiteGuide
              title="Prepare the ledger before adding automation"
              items={[
                { label: "Wallet", complete: wallets.length > 0, href: "/wallets", actionLabel: "Add wallet" },
                { label: "Category", complete: categories.length > 0, href: "/categories", actionLabel: "Add category" },
              ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Wallet
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                  required
                >
                  <option value="">Select wallet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                  placeholder="e.g. 50.00"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  First run date
                </label>
                <input
                  type="date"
                  value={firstRunDate}
                  onChange={(e) => setFirstRunDate(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                  required
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-1 text-xs text-gray-400">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                placeholder="e.g. Starlink subscription"
              />
            </div>

            <button
              type="submit"
              disabled={saving || loadingPage || loadError || wallets.length === 0 || categories.length === 0}
              className="gl-btn gl-btn-primary gl-btn-md mt-2"
            >
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </form>

          {/* Automation rules */}
          <section className="gl-premium-card p-4 text-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                  Automation rules
                </p>
                <h2 className="mt-1 text-sm font-semibold">Recurring Rule Portfolio</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Review, pause, activate, or delete the rules powering your automated transactions.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-gray-400">
                {loadError ? "Unavailable" : `${rules.filter((rule) => rule.is_active).length} active / ${rules.length} total`}
              </div>
            </div>

            {loadingPage ? (
              <p className="text-xs text-gray-500">Loading recurring rules…</p>
            ) : loadError ? (
              <p className="text-xs text-gray-500">Recurring rules are unavailable.</p>
            ) : rules.length === 0 ? (
              <EmptyState
                compact
                eyebrow="Automation"
                title="No recurring rules yet"
                description="Create your first recurring rule to automate predictable income, bills, subscriptions, or annual renewals."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {rules.map((rule) => (
                  <RecurringRuleCard
                    key={rule.id}
                    rule={rule}
                    wallet={wallets.find((wallet) => wallet.id === rule.wallet_id)}
                    category={categories.find((category) => category.id === rule.category_id)}
                    onToggle={(isActive) => toggleRuleActive(rule, isActive)}
                    onDelete={() => deleteRule(rule)}
                  />
                ))}
              </div>
            )}
          </section>

          {!loadingPage && !loadError ? (
            <RecurringInsights rules={rules} runLogs={runLogs} wallets={wallets} categories={categories} />
          ) : null}

          {/* Recurring run audit logs */}
          <section className="gl-premium-card mt-8 p-4 text-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Recurring Run Audit</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Recent cron execution history for recurring rules. Failed and skipped runs are tracked for visibility.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
                <span className="rounded-full border border-emerald-500/50 px-2 py-1 text-emerald-300">
                  {runLogSummary.success} success
                </span>
                <span className="rounded-full border border-amber-500/50 px-2 py-1 text-amber-300">
                  {runLogSummary.skipped} skipped
                </span>
                <span className="rounded-full border border-red-500/50 px-2 py-1 text-red-300">
                  {runLogSummary.failed} failed
                </span>
              </div>
            </div>

            {loadingPage ? (
              <p className="text-xs text-gray-500">Loading audit logs…</p>
            ) : loadError ? (
              <p className="text-xs text-gray-500">Run audit data is unavailable.</p>
            ) : runLogs.length === 0 ? (
              <EmptyState
                compact
                eyebrow="Audit"
                title="No recurring run logs yet"
                description="Logs will appear after the recurring cron endpoint processes due rules."
              />
            ) : (
              <div className="space-y-2">
                {runLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-gray-100">
                            {getRuleLabel(log.rule_id)}
                          </p>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                              getRunLogTone(log.status),
                            ].join(" ")}
                          >
                            {log.status}
                          </span>
                        </div>

                        <p className="mt-1 text-[11px] text-gray-500">
                          Run at {formatDateTimeWithTime(log.run_at)}
                          {log.transaction_id
                            ? ` • Transaction ${log.transaction_id.slice(0, 8)}`
                            : ""}
                        </p>

                        {log.details ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                            {log.details}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
      </main>
    </div>
  );
}
