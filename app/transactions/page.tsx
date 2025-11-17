"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
};

type CategoryType = "income" | "expense";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
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
  description: string | null;
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

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view transactions.");
        setLoading(false);
        return;
      }

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

      const { data: txData, error: txError } = await supabaseBrowserClient
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (txError) {
        console.error(txError);
        setErrorMsg(txError.message);
        setLoading(false);
        return;
      }

      setTransactions(txData as Transaction[]);

      if (walletData && walletData.length > 0 && !walletId) {
        setWalletId(walletData[0].id);
      }
      if (categoryData && categoryData.length > 0 && !categoryId) {
        setCategoryId(categoryData[0].id);
      }
      if (!date) {
        setDate(new Date().toISOString().slice(0, 10));
      }

      setLoading(false);
    }

    loadData();
  }, [walletId, categoryId, date]);

  async function handleCreateTransaction(e: React.FormEvent) {
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

    const selectedWallet = wallets.find((w) => w.id === walletId);
    if (!selectedWallet) {
      setErrorMsg("Selected wallet not found.");
      setSaving(false);
      return;
    }

    const amount_minor = parseAmountToMinor(amount);
    const occurred_at = new Date(date + "T00:00:00Z").toISOString();

    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        category_id: categoryId,
        type,
        amount_minor,
        currency_code: selectedWallet.currency_code,
        occurred_at,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setTransactions((prev) => [data as Transaction, ...prev]);
    setAmount("0");
    setDescription("");
    setSaving(false);
  }

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold">Gorilla Ledger™ – Transactions</div>
        <div className="flex gap-4 text-sm">
          <a href="/wallets" className="underline text-gray-300">
            Wallets
          </a>
          <a href="/categories" className="underline text-gray-300">
            Categories
          </a>
          <a href="/dashboard" className="underline text-gray-300">
            Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-4">Transactions</h1>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add Transaction</h2>

          {wallets.length === 0 || categories.length === 0 ? (
            <p className="text-sm text-yellow-300">
              You need at least one wallet and one category to create a transaction.
            </p>
          ) : (
            <form onSubmit={handleCreateTransaction} className="grid gap-4 md:grid-cols-3">
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
                <label className="block text-sm mb-1">Type</label>
                <select
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Amount</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Date</label>
                <input
                  type="date"
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Description</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                  placeholder="Optional note (e.g. salary for Nov, rent for Juba house)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-white text-black font-semibold hover:bg-gray-200 transition"
                >
                  {saving ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-gray-500 text-sm">You have no transactions yet.</p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {transactions.map((tx) => {
                const wallet = walletMap[tx.wallet_id];
                const category = tx.category_id ? categoryMap[tx.category_id] : null;
                const dateStr = tx.occurred_at.slice(0, 10);

                return (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="font-medium">
                        {category ? category.name : "Uncategorized"}{" "}
                        <span className="text-xs text-gray-400">({tx.type})</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {wallet ? wallet.name : "Unknown wallet"} • {dateStr}
                        {tx.description ? ` • ${tx.description}` : null}
                      </div>
                    </div>
                    <div
                      className={
                        tx.type === "income"
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatMinorToAmount(tx.amount_minor)} {tx.currency_code}
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
