"use client";

import { useEffect, useState } from "react";
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

type Budget = {
  id: string;
  wallet_id: string | null;
  category_id: string;
  year: number;
  month: number;
  amount_minor: number;
  created_at: string;
};

function parseAmountToMinor(amount: string): number {
  const cleaned = amount.replace(",", "").trim();
  const [whole, fractional = ""] = cleaned.split(".");
  const fracPadded = (fractional + "00").slice(0, 2);
  const wholeNum = Number(whole) || 0;
  const fracNum = Number(fracPadded) || 0;
  return wholeNum * 100 + fracNum;
}

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function BudgetsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Form + filter state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view budgets.");
        setLoading(false);
        return;
      }

      // Wallets
      const { data: walletData, error: walletError } =
        await supabaseBrowserClient
          .from("wallets")
          .select("id, name, currency_code")
          .order("created_at", { ascending: true });

      if (walletError) {
        console.error(walletError);
        setErrorMsg(walletError.message);
        setLoading(false);
        return;
      }

      setWallets(walletData as Wallet[]);

      // Categories
      const { data: categoryData, error: categoryError } =
        await supabaseBrowserClient
          .from("categories")
          .select("id, name, type")
          .eq("is_active", true)
          .order("type", { ascending: true })
          .order("name", { ascending: true });

      if (categoryError) {
        console.error(categoryError);
        setErrorMsg(categoryError.message);
        setLoading(false);
        return;
      }

      setCategories(categoryData as Category[]);

      // Budgets (we load a chunk and filter client-side)
      const { data: budgetData, error: budgetError } =
        await supabaseBrowserClient
          .from("budgets")
          .select("*")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200);

      if (budgetError) {
        console.error(budgetError);
        setErrorMsg(budgetError.message);
        setLoading(false);
        return;
      }

      setBudgets(budgetData as Budget[]);

      // sensible defaults
      if (walletData && walletData.length > 0 && !walletId) {
        setWalletId(walletData[0].id);
      }
      if (categoryData && categoryData.length > 0 && !categoryId) {
        setCategoryId(categoryData[0].id);
      }

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    if (!walletId) {
      setErrorMsg("Please select a wallet.");
      setSaving(false);
      return;
    }

    if (!categoryId) {
      setErrorMsg("Please select a category.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setSaving(false);
      return;
    }

    const amount_minor = parseAmountToMinor(amount);

    const { data, error } = await supabaseBrowserClient
      .from("budgets")
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        category_id: categoryId,
        year,
        month,
        amount_minor,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setBudgets((prev) => [data as Budget, ...prev]);
    setAmount("0");
    setSaving(false);
  }

  const walletMap = Object.fromEntries(
    wallets.map((w) => [w.id, w] as const)
  );
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  const budgetsForPeriod = budgets.filter(
    (b) => b.year === year && b.month === month
  );

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold">Gorilla Ledger™ – Budgets</div>
        <div className="flex gap-4 text-sm">
          <a href="/wallets" className="underline text-gray-300">
            Wallets
          </a>
          <a href="/categories" className="underline text-gray-300">
            Categories
          </a>
          <a href="/transactions" className="underline text-gray-300">
            Transactions
          </a>
          <a href="/dashboard" className="underline text-gray-300">
            Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-4">Budgets</h1>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Period selector */}
        <section className="mb-4 flex flex-wrap gap-4 items-center text-sm">
          <div>
            <label className="block text-xs mb-1">Year</label>
            <input
              type="number"
              className="w-24 p-1 rounded bg-gray-900 border border-gray-700"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Month</label>
            <select
              className="w-32 p-1 rounded bg-gray-900 border border-gray-700"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
          </div>
          <div className="text-gray-400 mt-4 md:mt-6">
            Viewing budgets for <span className="font-semibold">{monthLabel}</span>
          </div>
        </section>

        {/* Add budget form */}
        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add Budget</h2>

          {wallets.length === 0 || categories.length === 0 ? (
            <p className="text-sm text-yellow-300">
              You need at least one wallet and one category to set a budget.
            </p>
          ) : (
            <form
              onSubmit={handleCreateBudget}
              className="grid gap-4 md:grid-cols-3"
            >
              <div>
                <label className="block text-sm mb-1">Wallet</label>
                <select
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
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
                <label className="block text-sm mb-1">Category</label>
                <select
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
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

              <div>
                <label className="block text-sm mb-1">Budget Amount</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-white text-black font-semibold"
                >
                  {saving ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Budgets list */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Budgets for {monthLabel}
          </h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : budgetsForPeriod.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You have no budgets set for this period yet.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {budgetsForPeriod.map((b) => {
                const wallet = b.wallet_id ? walletMap[b.wallet_id] : null;
                const category = categoryMap[b.category_id];
                const currency = wallet?.currency_code ?? "";

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {category ? category.name : "Unknown category"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {wallet ? wallet.name : "All wallets"} •{" "}
                        {currency || "—"}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {formatMinorToAmount(b.amount_minor)}{" "}
                      {currency}
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
