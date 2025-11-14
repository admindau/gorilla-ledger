"use client";

import { FormEvent, useEffect, useState } from "react";
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
  description: string | null;
  amount_minor: number;
  currency_code: string;
  day_of_month: number | null;
  start_date: string | null;
  next_run_at: string | null;
  is_active: boolean;
  wallet: Wallet;
  category: Category | null;
};

export default function RecurringPage() {
  const { showToast } = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [firstRunDate, setFirstRunDate] = useState("");
  const [description, setDescription] = useState("");

  // ---------- initial load ----------
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = supabaseBrowserClient;

        const [{ data: w, error: wErr }, { data: c, error: cErr }, { data: r, error: rErr }] =
          await Promise.all([
            supabase
              .from("wallets")
              .select("*")
              .order("name", { ascending: true }),
            supabase
              .from("categories")
              .select("*")
              .order("name", { ascending: true }),
            supabase
              .from("recurring_rules")
              .select(
                `
                id,
                description,
                amount_minor,
                currency_code,
                day_of_month,
                start_date,
                next_run_at,
                is_active,
                wallet:wallets (
                  id,
                  name,
                  currency_code
                ),
                category:categories (
                  id,
                  name,
                  type
                )
              `
              )
              .order("created_at", { ascending: true }),
          ]);

        if (wErr) console.error("Error loading wallets", wErr);
        if (cErr) console.error("Error loading categories", cErr);
        if (rErr) console.error("Error loading recurring rules", rErr);

        setWallets(w ?? []);
        setCategories(c ?? []);
        setRules((r as unknown as RecurringRule[]) ?? []);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ---------- create rule ----------
  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();

    const supabase = supabaseBrowserClient;

    if (!walletId || !categoryId || !amount || !firstRunDate) {
      showToast("Please fill all required fields.", "error");
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Amount must be a positive number.", "error");
      return;
    }

    const amountMinor = Math.round(parsedAmount * 100);

    const wallet = wallets.find((w) => w.id === walletId);
    const category = categories.find((c) => c.id === categoryId);

    // table requires a type with a check constraint
    const type: "income" | "expense" =
      (category?.type as "income" | "expense") ?? "expense";

    const dayOfMonth = new Date(firstRunDate).getDate();

    const { error } = await supabase.from("recurring_rules").insert({
      wallet_id: walletId,
      category_id: categoryId,
      type, // 👈 this fixes the recurring_rules_type_check failure
      amount_minor: amountMinor,
      currency_code: wallet?.currency_code ?? "USD",
      frequency: "monthly",
      interval: 1,
      day_of_month: dayOfMonth,
      start_date: firstRunDate,
      next_run_at: firstRunDate, // first scheduled run
      description: description || null,
      is_active: true,
    });

    if (error) {
      console.error("Failed to create recurring rule", error);
      showToast("Failed to create recurring rule.", "error");
      return;
    }

    showToast("Recurring rule created.", "success");
    setAmount("");
    setDescription("");

    // reload rules list from the same joined query
    const { data: r, error: rErr } = await supabase
      .from("recurring_rules")
      .select(
        `
        id,
        description,
        amount_minor,
        currency_code,
        day_of_month,
        start_date,
        next_run_at,
        is_active,
        wallet:wallets (
          id,
          name,
          currency_code
        ),
        category:categories (
          id,
          name,
          type
        )
      `
      )
      .order("created_at", { ascending: true });

    if (rErr) {
      console.error("Error reloading recurring rules", rErr);
    }

    setRules((r as unknown as RecurringRule[]) ?? []);
  }

  // ---------- toggle active / paused ----------
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

  // ---------- delete rule ----------
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

  // ---------- UI ----------
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
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center px-4 py-2 bg-white text-black rounded text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Rule"}
          </button>
        </form>

        <section className="border border-gray-800 rounded-lg p-4 bg-black/40 text-sm">
          <h2 className="text-sm font-semibold mb-4">Existing Rules</h2>

          {rules.length === 0 ? (
            <p className="text-xs text-gray-500">
              No recurring rules yet. Add one above.
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-800 rounded px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold">
                      {rule.description || "Recurring rule"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {rule.wallet.name} • {rule.wallet.currency_code} • Every
                      month on day {rule.day_of_month ?? "?"} • Next run:{" "}
                      {rule.next_run_at
                        ? new Date(rule.next_run_at).toLocaleDateString()
                        : "—"}
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
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
