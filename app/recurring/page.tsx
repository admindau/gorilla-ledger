"use client";

import { useEffect, useState, FormEvent } from "react";
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

type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  description: string | null;
  amount_minor: number;
  currency_code: string;
  day_of_month: number | null;
  start_date: string | null;
  next_run_at: string | null;
  is_active: boolean;
};

export default function RecurringPage() {
  const { showToast } = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [firstRunDate, setFirstRunDate] = useState("");
  const [description, setDescription] = useState("");

  // Load wallets, categories, and existing rules
  useEffect(() => {
    async function loadData() {
      setLoadingPage(true);
      const supabase = supabaseBrowserClient;

      try {
        const [{ data: w, error: wErr }, { data: c, error: cErr }, { data: r, error: rErr }] =
          await Promise.all([
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
                "id,user_id,wallet_id,category_id,description,amount_minor,currency_code,day_of_month,start_date,next_run_at,is_active"
              )
              .order("created_at", { ascending: true }),
          ]);

        if (wErr) console.error("Error loading wallets", wErr);
        if (cErr) console.error("Error loading categories", cErr);
        if (rErr) console.error("Error loading recurring rules", rErr);

        setWallets(w ?? []);
        setCategories(c ?? []);
        setRules((r as RecurringRule[]) ?? []);
      } finally {
        setLoadingPage(false);
      }
    }

    loadData();
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
    const dayOfMonth = firstDate.getDate();
    const nextRunAt = firstDate.toISOString(); // timestamptz-safe

    setSaving(true);

    const { error } = await supabase.from("recurring_rules").insert({
      user_id: user.id, // 🔑 satisfy NOT NULL + RLS
      wallet_id: walletId,
      category_id: categoryId,
      type, // 🔑 satisfy recurring_rules_type_check
      amount_minor: amountMinor,
      currency_code: currencyCode,
      frequency: "monthly",
      interval: 1,
      day_of_month: dayOfMonth,
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

    // reload rules from base table
    const { data: r, error: rErr } = await supabase
      .from("recurring_rules")
      .select(
        "id,user_id,wallet_id,category_id,description,amount_minor,currency_code,day_of_month,start_date,next_run_at,is_active"
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
    if (!window.confirm(`Delete recurring rule for ${rule.description || "rule"}?`)) {
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

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">
          Recurring Rules – {monthName} {year}
        </h1>
        <p className="text-xs text-gray-400 mb-6">
          Define automatic monthly transactions like salary, rent, and
          subscriptions. Gorilla Ledger will materialize them using the cron
          engine we wired up.
        </p>

        <form
          onSubmit={handleCreateRule}
          className="border border-gray-800 rounded-lg p-4 mb-8 bg-black/40 space-y-4 text-sm"
        >
          <h2 className="text-sm font-semibold mb-2">Add a Recurring Rule</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-xs text-gray-400">Wallet</label>
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
              <label className="block mb-1 text-xs text-gray-400">Amount</label>
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
                const amount = (rule.amount_minor ?? 0) / 100;

                return (
                  <div
                    key={rule.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-800 rounded px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-semibold">
                        {rule.description || category?.name || "Recurring rule"}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {wallet
                          ? `${wallet.name} • ${wallet.currency_code}`
                          : rule.currency_code}
                        {" • "}
                        Every month on day {rule.day_of_month ?? "?"} • Next
                        run:{" "}
                        {rule.next_run_at
                          ? new Date(rule.next_run_at).toLocaleDateString()
                          : "—"}{" "}
                        • Amount: {amount.toLocaleString()}{" "}
                        {rule.currency_code}
                      </p>
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
      </div>
    </div>
  );
}
