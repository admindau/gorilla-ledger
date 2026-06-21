"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";

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

  const [userEmail, setUserEmail] = useState<string>("");
  const [signingOut, setSigningOut] = useState(false);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [runLogs, setRunLogs] = useState<RecurringRunLog[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
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

  async function handleLogout() {
    if (signingOut) return;

    const ok = window.confirm(
      "You are about to log out of Gorilla Ledger™. Continue?"
    );
    if (!ok) return;

    setSigningOut(true);
    try {
      await supabaseBrowserClient.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  // Load wallets, categories, existing rules, and user email
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadingPage(true);
      const supabase = supabaseBrowserClient;

      try {
        const [
          { data: u },
          { data: w, error: wErr },
          { data: c, error: cErr },
          { data: r, error: rErr },
          { data: logs, error: logsErr },
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("wallets")
            .select("id,name,currency_code")
            .order("name", { ascending: true }),
          supabase
            .from("categories")
            .select("id,name,type")
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

        setUserEmail(u?.user?.email ?? "");

        if (wErr) console.error("Error loading wallets", wErr);
        if (cErr) console.error("Error loading categories", cErr);
        if (rErr) console.error("Error loading recurring rules", rErr);
        if (logsErr) console.error("Error loading recurring run logs", logsErr);

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
  }, []);

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

    const selectedWallet = wallets.find((w) => w.id === walletId);
    const selectedCategory = categories.find((c) => c.id === categoryId);

    const currencyCode = selectedWallet?.currency_code ?? "USD";
    const type: "income" | "expense" = selectedCategory?.type ?? "expense";

    const firstDate = new Date(firstRunDate);
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


  function formatDateTime(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatFrequency(rule: RecurringRule) {
    const every = rule.interval && rule.interval > 1 ? `Every ${rule.interval}` : "Every";

    switch (rule.frequency) {
      case "daily":
        return `${every} day${rule.interval && rule.interval > 1 ? "s" : ""}`;
      case "weekly":
        return `${every} week${rule.interval && rule.interval > 1 ? "s" : ""}`;
      case "yearly":
        return `${every} year${rule.interval && rule.interval > 1 ? "s" : ""}`;
      case "monthly":
      default:
        return `${every} month${rule.interval && rule.interval > 1 ? "s" : ""}`;
    }
  }

  function formatSchedule(rule: RecurringRule) {
    if (rule.frequency === "daily") return "Runs daily";
    if (rule.frequency === "weekly") {
      return `Runs weekly${rule.day_of_week != null ? ` on day ${rule.day_of_week}` : ""}`;
    }
    if (rule.frequency === "yearly") {
      return `Runs yearly${rule.day_of_month != null ? ` on day ${rule.day_of_month}` : ""}`;
    }
    return `Runs monthly${rule.day_of_month != null ? ` on day ${rule.day_of_month}` : ""}`;
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
      <Link
        href={href}
        className={[
          "px-2.5 py-1.5 rounded-md border text-xs transition",
          active
            ? "border-white/30 bg-white/10 text-white"
            : "border-gray-800 bg-black/40 text-gray-300 hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ========================= Hardened Top Navigation ========================= */}
      <header className="w-full border-b border-gray-900 bg-black/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard"
                className="font-semibold tracking-tight truncate"
              >
                Gorilla Ledger™
              </Link>

              <nav className="hidden md:flex items-center gap-2">
                <NavLink href="/wallets" label="Wallets" />
                <NavLink href="/categories" label="Categories" />
                <NavLink href="/transactions" label="Transactions" />
                <NavLink href="/budgets" label="Budgets" />
                <NavLink href="/recurring" label="Recurring" active />
                <NavLink href="/settings/security" label="Security" />
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {userEmail ? (
                <div className="hidden sm:flex items-center gap-2 max-w-[260px]">
                  <span className="text-[11px] text-gray-400">Signed in</span>
                  <span className="text-xs text-gray-200 truncate">
                    {userEmail}
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-200 hover:bg-white/5 transition disabled:opacity-60"
              >
                {signingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>

          {/* Mobile nav (compact) */}
          <nav className="md:hidden mt-2 flex flex-wrap gap-2">
            <NavLink href="/wallets" label="Wallets" />
            <NavLink href="/categories" label="Categories" />
            <NavLink href="/transactions" label="Transactions" />
            <NavLink href="/budgets" label="Budgets" />
            <NavLink href="/recurring" label="Recurring" active />
            <NavLink href="/settings/security" label="Security" />
          </nav>
        </div>
      </header>

      {/* ========================= Page Content ========================= */}
      <main className="px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold mb-2">
            Recurring Rules – {monthName} {year}
          </h1>
          <p className="text-xs text-gray-400 mb-6">
            Define automatic transactions like salary, rent, subscriptions, and annual renewals. Gorilla Ledger tracks next run, last run, total runs, and active status.
          </p>

          <form
            onSubmit={handleCreateRule}
            className="border border-gray-800 rounded-lg p-4 mb-8 bg-black/40 space-y-4 text-sm"
          >
            <h2 className="text-sm font-semibold mb-2">Add a Recurring Rule</h2>

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
                  {categories
                    .filter((c) => c.type === "expense")
                    .map((c) => (
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
              disabled={saving}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-white text-black rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </form>

          {/* Existing rules */}
          <section className="border border-gray-800 rounded-lg p-4 bg-black/40 text-sm">
            <h2 className="text-sm font-semibold mb-4">Existing Rules</h2>

            {loadingPage ? (
              <p className="text-xs text-gray-500">Loading…</p>
            ) : rules.length === 0 ? (
              <p className="text-xs text-gray-500">
                No recurring rules yet. Add one above.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => {
                  const wallet = wallets.find((w) => w.id === rule.wallet_id);
                  const category = categories.find(
                    (c) => c.id === rule.category_id
                  );
                  const amt = (rule.amount_minor ?? 0) / 100;

                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-black/30 px-3 py-3 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold">
                            {rule.description || category?.name || "Recurring rule"}
                          </p>
                          <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-300">
                            {formatFrequency(rule)}
                          </span>
                          <span className="rounded-full border border-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-400">
                            {rule.type}
                          </span>
                        </div>

                        <p className="mt-1 text-[11px] text-gray-400">
                          {wallet
                            ? `${wallet.name} • ${wallet.currency_code}`
                            : rule.currency_code}
                          {" • "}
                          {category?.name ?? "Uncategorized"}
                          {" • "}
                          {formatSchedule(rule)}
                          {" • "}
                          Amount: {amt.toLocaleString()} {rule.currency_code}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                          <div className="rounded-md border border-gray-900 bg-black/50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Last run</p>
                            <p className="mt-1 text-gray-200">{formatDateTime(rule.last_run_at)}</p>
                          </div>
                          <div className="rounded-md border border-gray-900 bg-black/50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Next run</p>
                            <p className="mt-1 text-gray-200">{formatDateTime(rule.next_run_at)}</p>
                          </div>
                          <div className="rounded-md border border-gray-900 bg-black/50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Total runs</p>
                            <p className="mt-1 text-gray-200">{rule.total_runs ?? 0}</p>
                          </div>
                          <div className="rounded-md border border-gray-900 bg-black/50 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Status</p>
                            <p className="mt-1 text-gray-200">{rule.is_active ? "Active" : "Paused"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-full border ${
                            rule.is_active
                              ? "border-emerald-500/70 text-emerald-300"
                              : "border-gray-600 text-gray-400"
                          }`}
                        >
                          {rule.is_active ? "ACTIVE" : "PAUSED"}
                        </span>
                        {rule.is_active ? (
                          <button
                            onClick={() => toggleRuleActive(rule, false)}
                            className="px-2 py-1 border border-gray-700 rounded hover:bg-gray-900"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleRuleActive(rule, true)}
                            className="px-2 py-1 border border-gray-700 rounded hover:bg-gray-900"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => deleteRule(rule)}
                          className="px-2 py-1 border border-red-700 text-red-300 rounded hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recurring run audit logs */}
          <section className="mt-8 border border-gray-800 rounded-lg p-4 bg-black/40 text-sm">
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
            ) : runLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-800 bg-black/30 p-4 text-xs text-gray-500">
                No recurring run logs yet. Logs will appear after the recurring cron endpoint processes due rules.
              </div>
            ) : (
              <div className="space-y-2">
                {runLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-gray-800 bg-black/30 px-3 py-3"
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

        </div>
      </main>
    </div>
  );
}
