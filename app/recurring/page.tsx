"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type RecurringRule = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount_minor: number;
  currency_code: string;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  next_run_at: string;
  description: string | null;
  is_active: boolean;
};

function formatMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function describeSchedule(rule: RecurringRule): string {
  if (rule.frequency === "monthly") {
    const day = rule.day_of_month ?? new Date(rule.start_date).getDate();
    return `Every month on day ${day}`;
  }
  if (rule.frequency === "weekly") {
    return "Every week";
  }
  if (rule.frequency === "daily") {
    return "Every day";
  }
  return "";
}

function computeNextRun(startDateStr: string): string {
  // Start date chosen by user; we schedule the next run at that date
  // or the same day in a future month if start date is in the past.
  const start = new Date(startDateStr + "T00:00:00");
  const today = new Date();

  let candidate = new Date(start);
  while (candidate < today) {
    candidate.setMonth(candidate.getMonth() + 1);
  }

  return candidate.toISOString();
}

export default function RecurringPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form state
  const [walletId, setWalletId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [firstRunDate, setFirstRunDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10); // yyyy-mm-dd
  });
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    async function init() {
      setCheckingSession(true);
      setLoadingData(true);
      setErrorMsg("");
      setSuccessMsg("");

      // 1. Auth check
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      setUserId(session.user.id);
      setEmail(session.user.email ?? null);
      setCheckingSession(false);

      // 2. Load wallets, categories, and existing recurring rules
      const [walletRes, categoryRes, rulesRes] = await Promise.all([
        supabaseBrowserClient
          .from("wallets")
          .select("id, name, currency_code")
          .order("created_at", { ascending: true }),
        supabaseBrowserClient
          .from("categories")
          .select("id, name, type")
          .eq("is_active", true)
          .order("type", { ascending: true })
          .order("name", { ascending: true }),
        supabaseBrowserClient
          .from("recurring_rules")
          .select(
            "id, wallet_id, category_id, type, amount_minor, currency_code, frequency, interval, day_of_month, day_of_week, start_date, end_date, next_run_at, description, is_active"
          )
          .order("created_at", { ascending: true }),
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
      if (rulesRes.error) {
        console.error(rulesRes.error);
        setErrorMsg(rulesRes.error.message);
        setLoadingData(false);
        return;
      }

      setWallets(walletRes.data as Wallet[]);
      setCategories(categoryRes.data as Category[]);
      setRules(rulesRes.data as RecurringRule[]);

      // Default wallet/category selections
      if (walletRes.data && walletRes.data.length > 0) {
        setWalletId((walletRes.data[0] as Wallet).id);
      }
      const expenseCats = (categoryRes.data as Category[]).filter(
        (c) => c.type === "expense"
      );
      if (expenseCats.length > 0) {
        setCategoryId(expenseCats[0].id);
      }

      setLoadingData(false);
    }

    init();
  }, [router]);

  async function reloadRules() {
    const rulesRes = await supabaseBrowserClient
      .from("recurring_rules")
      .select(
        "id, wallet_id, category_id, type, amount_minor, currency_code, frequency, interval, day_of_month, day_of_week, start_date, end_date, next_run_at, description, is_active"
      )
      .order("created_at", { ascending: true });

    if (rulesRes.error) {
      console.error(rulesRes.error);
      setErrorMsg(rulesRes.error.message);
      return;
    }

    setRules(rulesRes.data as RecurringRule[]);
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!userId) {
      setErrorMsg("No user session found.");
      return;
    }
    if (!walletId) {
      setErrorMsg("Please select a wallet.");
      return;
    }
    if (!categoryId) {
      setErrorMsg("Please select a category.");
      return;
    }
    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Amount must be a positive number.");
      return;
    }

    const wallet = wallets.find((w) => w.id === walletId);
    const category = categories.find((c) => c.id === categoryId);

    if (!wallet || !category) {
      setErrorMsg("Selected wallet or category not found.");
      return;
    }

    const amountMinor = Math.round(numericAmount * 100);
    const startDate = firstRunDate;
    const dayOfMonth = new Date(startDate + "T00:00:00").getDate();
    const nextRunAt = computeNextRun(startDate);

    setSubmitting(true);

    const { error } = await supabaseBrowserClient.from("recurring_rules").insert({
      user_id: userId,
      wallet_id: wallet.id,
      category_id: category.id,
      type: category.type, // align with category
      amount_minor: amountMinor,
      currency_code: wallet.currency_code,
      frequency: "monthly",
      interval: 1,
      day_of_month: dayOfMonth,
      day_of_week: null,
      start_date: startDate,
      end_date: null,
      next_run_at: nextRunAt,
      description: description || null,
      is_active: true,
    });

    setSubmitting(false);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Recurring rule created.");
    setAmount("");
    setDescription("");
    // keep other selections as-is
    await reloadRules();
  }

  async function handleToggleActive(rule: RecurringRule) {
    setErrorMsg("");
    setSuccessMsg("");

    const { error } = await supabaseBrowserClient
      .from("recurring_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg(
      `Rule ${rule.is_active ? "paused" : "activated"} successfully.`
    );
    await reloadRules();
  }

  async function handleDelete(rule: RecurringRule) {
    setErrorMsg("");
    setSuccessMsg("");

    const confirmDelete = window.confirm(
      `Delete recurring rule for ${
        categories.find((c) => c.id === rule.category_id)?.name ?? "this item"
      }?`
    );
    if (!confirmDelete) return;

    const { error } = await supabaseBrowserClient
      .from("recurring_rules")
      .delete()
      .eq("id", rule.id);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Recurring rule deleted.");
    await reloadRules();
  }

  async function handleLogout() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-400">Checking your session...</p>
      </div>
    );
  }

  const monthLabel = new Date().toLocaleString("en", {
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
          <span className="font-semibold">Recurring</span>
          <a href="/dashboard" className="underline">
            Dashboard
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

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-2">
          Recurring Rules – {monthLabel}
        </h1>
        <p className="text-gray-400 mb-4 text-sm">
          Define automatic monthly transactions like salary, rent, and
          subscriptions. Gorilla Ledger will materialize them using the cron
          engine we wired up.
        </p>

        {errorMsg && (
          <p className="mb-3 text-sm text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="mb-3 text-sm text-emerald-400 border border-emerald-500/40 rounded px-3 py-2 bg-emerald-950/30">
            {successMsg}
          </p>
        )}

        {/* Create rule form */}
        <section className="border border-gray-800 rounded mb-8">
          <div className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-lg font-semibold">Add a Recurring Rule</h2>
            <p className="text-gray-400 text-xs mt-1">
              For now, rules are monthly. Pick a date for the first run; we&apos;ll
              reuse that day each month.
            </p>
          </div>

          <form
            className="px-4 py-4 space-y-4 text-sm"
            onSubmit={handleCreateRule}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Wallet
                </label>
                <select
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
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
                <label className="block mb-1 text-xs text-gray-400">
                  Category
                </label>
                <select
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                  placeholder="e.g. 50.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block mb-1 text-xs text-gray-400">
                  First run date
                </label>
                <input
                  type="date"
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                  value={firstRunDate}
                  onChange={(e) => setFirstRunDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-xs text-gray-400">
                Description (optional)
              </label>
              <input
                type="text"
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                placeholder="e.g. Starlink subscription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Gorilla Ledger will automatically create monthly transactions
                using these rules when your cron endpoint runs.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded bg-white text-black font-semibold text-xs hover:bg-gray-200 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing rules */}
        <section className="border border-gray-800 rounded text-sm">
          <div className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-lg font-semibold">Existing Rules</h2>
          </div>

          {loadingData ? (
            <div className="px-4 py-4 text-gray-400 text-sm">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="px-4 py-4 text-gray-500 text-sm">
              You don&apos;t have any recurring rules yet. Create one above to
              automate salary, rent, or subscriptions.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {rules.map((rule) => {
                const wallet = wallets.find((w) => w.id === rule.wallet_id);
                const category = categories.find(
                  (c) => c.id === rule.category_id
                );

                return (
                  <div
                    key={rule.id}
                    className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium">
                        {category ? category.name : "Unknown category"}{" "}
                        <span className="text-xs text-gray-400">
                          ({rule.type})
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {wallet ? `${wallet.name} • ${wallet.currency_code}` : ""}
                        {rule.description ? ` • ${rule.description}` : ""}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {describeSchedule(rule)} • Next run:{" "}
                        {formatDateOnly(rule.next_run_at)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="font-semibold">
                        {formatMinor(rule.amount_minor)} {rule.currency_code}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "px-2 py-0.5 rounded-full text-[10px] uppercase " +
                            (rule.is_active
                              ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/50"
                              : "bg-gray-900 text-gray-400 border border-gray-600/60")
                          }
                        >
                          {rule.is_active ? "Active" : "Paused"}
                        </span>
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className="px-2 py-1 rounded border border-gray-600 text-xs hover:bg-white hover:text-black"
                        >
                          {rule.is_active ? "Pause" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="px-2 py-1 rounded border border-red-600 text-xs text-red-300 hover:bg-red-600 hover:text-white"
                        >
                          Delete
                        </button>
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
