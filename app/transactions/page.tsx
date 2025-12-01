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

type PendingDelete = {
  tx: Transaction;
  timeoutId: ReturnType<typeof setTimeout>;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Add transaction form
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  // Inline editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmount, setEditAmount] = useState("0");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Search & date filters for recent transactions
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Undo delete
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );

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

  // Inline editing handlers
  function handleStartInlineEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    setEditWalletId(tx.wallet_id);
    if (tx.category_id) {
      setEditCategoryId(tx.category_id);
    } else if (categories.length > 0) {
      setEditCategoryId(categories[0].id);
    }
    setEditType(tx.type);
    setEditAmount(formatMinorToAmount(tx.amount_minor));
    setEditDate(tx.occurred_at.slice(0, 10));
    setEditDescription(tx.description ?? "");
  }

  function handleCancelInlineEdit() {
    setEditingTxId(null);
    setEditWalletId("");
    setEditCategoryId("");
    setEditAmount("0");
    setEditDescription("");
  }

  async function handleSaveInlineEdit() {
    if (!editingTxId) return;
    setSavingEdit(true);
    setErrorMsg("");

    if (!editWalletId) {
      setErrorMsg("Please select a wallet for this transaction.");
      setSavingEdit(false);
      return;
    }

    if (!editCategoryId) {
      setErrorMsg("Please select a category for this transaction.");
      setSavingEdit(false);
      return;
    }

    const selectedWallet = wallets.find((w) => w.id === editWalletId);
    if (!selectedWallet) {
      setErrorMsg("Selected wallet not found.");
      setSavingEdit(false);
      return;
    }

    const amount_minor = parseAmountToMinor(editAmount);
    const occurred_at = new Date(editDate + "T00:00:00Z").toISOString();

    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .update({
        wallet_id: editWalletId,
        category_id: editCategoryId,
        type: editType,
        amount_minor,
        currency_code: selectedWallet.currency_code,
        occurred_at,
        description: editDescription || null,
      })
      .eq("id", editingTxId)
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSavingEdit(false);
      return;
    }

    setTransactions((prev) =>
      prev.map((tx) => (tx.id === editingTxId ? (data as Transaction) : tx))
    );

    setSavingEdit(false);
    handleCancelInlineEdit();
  }

  // Undo delete: schedule delete in DB, allow undo in UI
  async function actuallyDeleteFromDatabase(id: string) {
    const { error } = await supabaseBrowserClient
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
    }
  }

  function handleDeleteTransaction(tx: Transaction) {
    setErrorMsg("");

    // Clear any previous pending delete
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      setPendingDelete(null);
    }

    // Remove from UI immediately
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    if (editingTxId === tx.id) {
      handleCancelInlineEdit();
    }

    const timeoutId = setTimeout(() => {
      actuallyDeleteFromDatabase(tx.id);
      setPendingDelete(null);
    }, 10000); // 10 seconds to undo

    setPendingDelete({ tx, timeoutId });
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;

    clearTimeout(pendingDelete.timeoutId);

    setTransactions((prev) => {
      const next = [pendingDelete.tx, ...prev];
      // Keep list sorted by occurred_at desc
      return next.sort((a, b) =>
        b.occurred_at.localeCompare(a.occurred_at)
      );
    });

    setPendingDelete(null);
  }

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  // First apply date range filter
  const dateFilteredTransactions = transactions.filter((tx) => {
    const dateStr = tx.occurred_at.slice(0, 10);
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    return true;
  });

  // Then apply search filter
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTransactions =
    !normalizedQuery
      ? dateFilteredTransactions
      : dateFilteredTransactions.filter((tx) => {
          const wallet = walletMap[tx.wallet_id];
          const category = tx.category_id ? categoryMap[tx.category_id] : null;
          const dateStr = tx.occurred_at.slice(0, 10);
          const descriptionText = tx.description ?? "";
          const amountText = formatMinorToAmount(tx.amount_minor);

          const parts = [
            wallet ? wallet.name : "",
            wallet ? wallet.currency_code : "",
            category ? category.name : "",
            tx.type,
            tx.currency_code,
            dateStr,
            descriptionText,
            amountText,
          ];

          return parts.some((part) =>
            part.toLowerCase().includes(normalizedQuery)
          );
        });

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
  }

  function handleClearSearch() {
    setSearchInput("");
    setSearchQuery("");
  }

  function handleClearDates() {
    setFromDate("");
    setToDate("");
  }

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

        {/* Add transaction */}
        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add Transaction</h2>

          {wallets.length === 0 || categories.length === 0 ? (
            <p className="text-sm text-yellow-300">
              You need at least one wallet and one category to create a transaction.
            </p>
          ) : (
            <form
              onSubmit={handleCreateTransaction}
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

        {/* Recent transactions */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>

          {/* Date range filters */}
          <div className="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-xs text-gray-400">
              Filter by date range (optional).
            </p>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="date"
                className="p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="self-center text-xs text-gray-500">to</span>
              <input
                type="date"
                className="p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-xs text-gray-200 hover:bg-gray-800 transition"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          {/* Search for recent transactions */}
          <form
            onSubmit={handleSearchSubmit}
            className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          >
            <p className="text-xs text-gray-400">
              Search by description, category, wallet, currency, date or amount.
            </p>
            <div className="flex gap-2 w-full md:w-96">
              <input
                type="text"
                className="flex-1 p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                placeholder="Search recent transactions..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded bg-white text-black text-xs font-semibold hover:bg-gray-200 transition"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-xs text-gray-200 hover:bg-gray-800 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You have no transactions yet.
            </p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No transactions match your filters.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {filteredTransactions.map((tx) => {
                const wallet = walletMap[tx.wallet_id];
                const category = tx.category_id
                  ? categoryMap[tx.category_id]
                  : null;
                const dateStr = tx.occurred_at.slice(0, 10);
                const isEditing = editingTxId === tx.id;

                if (isEditing) {
                  return (
                    <div
                      key={tx.id}
                      className="px-4 py-3 space-y-2 bg-black/60"
                    >
                      <div className="text-xs text-gray-400 mb-1">
                        Editing transaction
                      </div>
                      <div className="grid gap-2 md:grid-cols-4">
                        <div>
                          <label className="block text-[11px] mb-1">
                            Wallet
                          </label>
                          <select
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editWalletId}
                            onChange={(e) =>
                              setEditWalletId(e.target.value)
                            }
                          >
                            {wallets.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currency_code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1">
                            Category
                          </label>
                          <select
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editCategoryId}
                            onChange={(e) =>
                              setEditCategoryId(e.target.value)
                            }
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1">
                            Type
                          </label>
                          <select
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editType}
                            onChange={(e) =>
                              setEditType(
                                e.target.value as TransactionType
                              )
                            }
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editDate}
                            onChange={(e) =>
                              setEditDate(e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <div>
                          <label className="block text-[11px] mb-1">
                            Amount
                          </label>
                          <input
                            type="text"
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editAmount}
                            onChange={(e) =>
                              setEditAmount(e.target.value)
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                            value={editDescription}
                            onChange={(e) =>
                              setEditDescription(e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelInlineEdit}
                          className="px-3 py-1 rounded border border-gray-700 text-[11px] text-gray-200 bg-gray-900 hover:bg-gray-800 transition"
                          disabled={savingEdit}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineEdit}
                          className="px-3 py-1 rounded border border-gray-700 text-[11px] bg-white text-black font-semibold hover:bg-gray-200 transition"
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx)}
                          className="px-3 py-1 rounded border border-red-500 text-[11px] text-red-300 bg-gray-900 hover:bg-gray-900/70 transition"
                          disabled={savingEdit}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {category ? category.name : "Uncategorized"}{" "}
                        <span className="text-xs text-gray-400">
                          ({tx.type})
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {wallet ? wallet.name : "Unknown wallet"} •{" "}
                        {dateStr}
                        {tx.description ? ` • ${tx.description}` : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={
                          tx.type === "income"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatMinorToAmount(tx.amount_minor)}{" "}
                        {tx.currency_code}
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleStartInlineEdit(tx)}
                          className="px-2 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx)}
                          className="px-2 py-1 rounded border border-red-500 text-red-300 bg-gray-900 hover:bg-gray-900/70 transition"
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

        {/* Undo delete toast */}
        {pendingDelete && (
          <div className="fixed bottom-4 inset-x-0 flex justify-center px-4">
            <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 text-xs text-gray-100 flex items-center justify-between gap-3 shadow-lg">
              <span>
                Transaction deleted.{" "}
                <span className="text-gray-400">
                  You can undo this for a few seconds.
                </span>
              </span>
              <button
                type="button"
                onClick={handleUndoDelete}
                className="px-3 py-1 rounded bg-white text-black font-semibold hover:bg-gray-200 transition"
              >
                Undo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
