"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import ReceiptUploader, {
  validateReceiptFiles,
} from "@/components/receipts/ReceiptUploader";
import ReceiptList from "@/components/receipts/ReceiptList";

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

const PAGE_SIZE = 25;

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

function extFromFile(file: File): string {
  const name = file.name || "";
  const idx = name.lastIndexOf(".");
  if (idx >= 0 && idx < name.length - 1) return name.slice(idx + 1).toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  return "bin";
}

async function uploadReceiptForTransaction(params: {
  userId: string;
  transactionId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Create receipt row first to get receipt_id (uuid) for a stable path
    const { data: receipt, error: insErr } = await supabaseBrowserClient
      .from("receipts")
      .insert({
        user_id: params.userId,
        transaction_id: params.transactionId,
        storage_bucket: "receipts",
        storage_path: "pending",
        original_name: params.file.name,
        mime_type: params.file.type || "application/octet-stream",
        size_bytes: params.file.size,
      })
      .select("id")
      .single();

    if (insErr || !receipt?.id) {
      return {
        ok: false,
        error: insErr?.message ?? "Failed to create receipt record.",
      };
    }

    const receiptId = receipt.id as string;
    const ext = extFromFile(params.file);

    // Ensure we have a session token for secure server-side validation.
    const {
      data: sessionData,
      error: sessionError,
    } = await supabaseBrowserClient.auth.getSession();

    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      // cleanup db row
      await supabaseBrowserClient.from("receipts").delete().eq("id", receiptId);
      return { ok: false, error: "Not authenticated (missing access token)." };
    }

    // Ask server for signed upload token/path (server infers user from JWT)
    const signRes = await fetch("/api/receipts/sign-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transaction_id: params.transactionId,
        receipt_id: receiptId,
        ext,
      }),
    });

    const signJson = await signRes.json();
    if (!signRes.ok) {
      // cleanup db row
      await supabaseBrowserClient.from("receipts").delete().eq("id", receiptId);
      return { ok: false, error: signJson?.error ?? "Failed to sign upload." };
    }

    const path = signJson.path as string;
    const token = signJson.token as string;

    // Upload using signed token
    const { error: upErr } = await supabaseBrowserClient.storage
      .from("receipts")
      .uploadToSignedUrl(path, token, params.file, {
        contentType: params.file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      // cleanup db row
      await supabaseBrowserClient.from("receipts").delete().eq("id", receiptId);
      return { ok: false, error: upErr.message };
    }

    // Finalize receipt row with real storage_path
    const { error: updErr } = await supabaseBrowserClient
      .from("receipts")
      .update({ storage_path: path })
      .eq("id", receiptId);

    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown upload error." };
  }
}

type PendingDelete = {
  tx: Transaction;
  timeoutId: ReturnType<typeof setTimeout>;
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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

  // Receipt selection for new transaction
  const [newReceiptFiles, setNewReceiptFiles] = useState<File[]>([]);
  const [receiptWarn, setReceiptWarn] = useState<string>("");

  // Inline editing state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmount, setEditAmount] = useState("0");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // receipts upload while editing a transaction
  const [editReceiptFiles, setEditReceiptFiles] = useState<File[]>([]);
  const [editReceiptWarn, setEditReceiptWarn] = useState("");
  const [uploadingEditReceipts, setUploadingEditReceipts] = useState(false);

  // Search & date filters for recent transactions
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Undo delete
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // Pagination cursor
  const [oldestOccurredAt, setOldestOccurredAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function loadInitial() {
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

      const { data: walletData, error: walletError } = await supabaseBrowserClient
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

      const { data: categoryData, error: categoryError } = await supabaseBrowserClient
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
        .limit(PAGE_SIZE);

      if (txError) {
        console.error(txError);
        setErrorMsg(txError.message);
        setLoading(false);
        return;
      }

      const castTx = (txData ?? []) as Transaction[];
      setTransactions(castTx);

      if (castTx.length > 0) {
        setOldestOccurredAt(castTx[castTx.length - 1].occurred_at);
        setHasMore(castTx.length === PAGE_SIZE);
      } else {
        setOldestOccurredAt(null);
        setHasMore(false);
      }

      if (walletData && walletData.length > 0 && !walletId) setWalletId(walletData[0].id);
      if (categoryData && categoryData.length > 0 && !categoryId) setCategoryId(categoryData[0].id);
      if (!date) setDate(new Date().toISOString().slice(0, 10));

      setLoading(false);
    }

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoadMore() {
    if (!oldestOccurredAt || !hasMore || loadingMore) return;

    setLoadingMore(true);
    setErrorMsg("");

    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .select("*")
      .lt("occurred_at", oldestOccurredAt)
      .order("occurred_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setLoadingMore(false);
      return;
    }

    const newTx = (data ?? []) as Transaction[];

    if (newTx.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const filteredNew = newTx.filter((t) => !existingIds.has(t.id));
      const combined = [...prev, ...filteredNew];
      combined.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return combined;
    });

    if (newTx.length < PAGE_SIZE) setHasMore(false);
    setOldestOccurredAt(newTx[newTx.length - 1].occurred_at);
    setLoadingMore(false);
  }

  function handleAddReceiptFiles(files: File[]) {
    setReceiptWarn("");
    const { ok, rejected } = validateReceiptFiles(files);

    if (rejected.length > 0) {
      const msg = rejected.map((r) => `${r.name}: ${r.reason}`).join(" | ");
      setReceiptWarn(msg);
    }

    if (ok.length > 0) {
      setNewReceiptFiles((prev) => [...prev, ...ok]);
    }
  }

  function handleRemoveNewReceiptAt(idx: number) {
    setNewReceiptFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddEditReceiptFiles(files: File[]) {
    setEditReceiptWarn("");
    const { ok, rejected } = validateReceiptFiles(files);

    if (rejected.length > 0) {
      const msg = rejected.map((r) => `${r.name}: ${r.reason}`).join(" | ");
      setEditReceiptWarn(msg);
    }
    if (ok.length > 0) {
      setEditReceiptFiles((prev) => [...prev, ...ok]);
    }
  }

  function handleRemoveEditReceiptAt(idx: number) {
    setEditReceiptFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUploadReceiptsForEditingTx() {
    if (!editingTxId) return;
    if (editReceiptFiles.length === 0) {
      setEditReceiptWarn("Please select at least one receipt file to upload.");
      return;
    }

    setUploadingEditReceipts(true);
    setErrorMsg("");
    setEditReceiptWarn("");

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setUploadingEditReceipts(false);
      return;
    }

    for (const f of editReceiptFiles) {
      const res = await uploadReceiptForTransaction({
        userId: user.id,
        transactionId: editingTxId,
        file: f,
      });
      if (!res.ok) {
        setErrorMsg(`Failed to upload receipt: ${res.error}`);
        break;
      }
    }

    setEditReceiptFiles([]);
    setUploadingEditReceipts(false);
  }

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

    const created = data as Transaction;

    if (newReceiptFiles.length > 0) {
      for (const f of newReceiptFiles) {
        const res = await uploadReceiptForTransaction({
          userId: user.id,
          transactionId: created.id,
          file: f,
        });
        if (!res.ok) {
          setErrorMsg(
            `Transaction saved, but a receipt failed to upload: ${res.error}`
          );
          break;
        }
      }
    }

    setTransactions((prev) => {
      const combined = [created, ...prev];
      combined.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return combined;
    });

    if (!oldestOccurredAt) setOldestOccurredAt(created.occurred_at);

    setAmount("0");
    setDescription("");
    setNewReceiptFiles([]);
    setReceiptWarn("");
    setSaving(false);
  }

  function handleStartInlineEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    setEditWalletId(tx.wallet_id);
    if (tx.category_id) setEditCategoryId(tx.category_id);
    else if (categories.length > 0) setEditCategoryId(categories[0].id);
    setEditType(tx.type);
    setEditAmount(formatMinorToAmount(tx.amount_minor));
    setEditDate(tx.occurred_at.slice(0, 10));
    setEditDescription(tx.description ?? "");

    setEditReceiptFiles([]);
    setEditReceiptWarn("");
  }

  function handleCancelInlineEdit() {
    setEditingTxId(null);
    setEditWalletId("");
    setEditCategoryId("");
    setEditAmount("0");
    setEditDescription("");

    setEditReceiptFiles([]);
    setEditReceiptWarn("");
    setUploadingEditReceipts(false);
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

    const updated = data as Transaction;

    setTransactions((prev) => {
      const combined = prev.map((tx) => (tx.id === editingTxId ? updated : tx));
      combined.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return combined;
    });

    setSavingEdit(false);
    handleCancelInlineEdit();
  }

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

    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      setPendingDelete(null);
    }

    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    if (editingTxId === tx.id) handleCancelInlineEdit();

    const timeoutId = setTimeout(() => {
      actuallyDeleteFromDatabase(tx.id);
      setPendingDelete(null);
    }, 10000);

    setPendingDelete({ tx, timeoutId });
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;

    clearTimeout(pendingDelete.timeoutId);

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      if (existingIds.has(pendingDelete.tx.id)) return prev;
      const combined = [pendingDelete.tx, ...prev];
      combined.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return combined;
    });

    setPendingDelete(null);
  }

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );

  const dateFilteredTransactions = transactions.filter((tx) => {
    const dateStr = tx.occurred_at.slice(0, 10);
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    return true;
  });

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

  const headerLinkClass =
    "px-2.5 py-1 rounded border border-gray-800 bg-black/40 text-xs text-gray-200 hover:bg-white hover:text-black transition";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Tight, app-like header (less link-bar) */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-900 bg-black/80 backdrop-blur">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              Gorilla Ledger™
            </div>
            <div className="text-[11px] text-gray-400 leading-tight">
              Transactions
            </div>
          </div>

          <nav className="flex items-center gap-2 shrink-0">
            <a href="/dashboard" className={headerLinkClass}>
              Dashboard
            </a>
            <a href="/wallets" className={headerLinkClass}>
              Wallets
            </a>
            <a href="/categories" className={headerLinkClass}>
              Categories
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {/* Tightened page title rhythm */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
            Transactions
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Add, search, edit, and attach receipts to your records.
          </p>
        </div>

        {errorMsg && <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>}

        {/* Add Transaction */}
        <section className="mb-8 border border-gray-800 rounded-lg bg-black/40">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-[11px] uppercase tracking-wider text-gray-400">
              Operational
            </div>
            <h2 className="text-sm font-semibold mt-1 leading-tight">
              Add Transaction
            </h2>
          </div>

          <div className="p-4">
            {wallets.length === 0 || categories.length === 0 ? (
              <p className="text-sm text-yellow-300">
                You need at least one wallet and one category to create a
                transaction.
              </p>
            ) : (
              <form
                onSubmit={handleCreateTransaction}
                className="grid gap-4 md:grid-cols-3"
              >
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Wallet
                  </label>
                  <select
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
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
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Category
                  </label>
                  <select
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
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
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Type
                  </label>
                  <select
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Amount
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-sm"
                    placeholder="Optional note (e.g. salary for Nov, rent for Juba house)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <ReceiptUploader
                  files={newReceiptFiles}
                  onAdd={handleAddReceiptFiles}
                  onRemoveAt={handleRemoveNewReceiptAt}
                  disabled={saving}
                />

                {receiptWarn && (
                  <div className="md:col-span-3 text-xs text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded p-2">
                    Some files were rejected: {receiptWarn}
                  </div>
                )}

                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded bg-white text-black text-sm font-semibold hover:bg-gray-200 transition"
                  >
                    {saving ? "Saving..." : "Save Transaction"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="border border-gray-800 rounded-lg bg-black/40">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-[11px] uppercase tracking-wider text-gray-400">
              Records
            </div>
            <h2 className="text-sm font-semibold mt-1 leading-tight">
              Recent Transactions
            </h2>
          </div>

          <div className="p-4">
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
              <>
                <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm overflow-hidden">
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
                          <div className="text-[11px] uppercase tracking-wider text-gray-400">
                            Editing transaction
                          </div>

                          <div className="grid gap-2 md:grid-cols-4">
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Wallet
                              </label>
                              <select
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editWalletId}
                                onChange={(e) => setEditWalletId(e.target.value)}
                              >
                                {wallets.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} ({w.currency_code})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Category
                              </label>
                              <select
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editCategoryId}
                                onChange={(e) => setEditCategoryId(e.target.value)}
                              >
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Type
                              </label>
                              <select
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editType}
                                onChange={(e) =>
                                  setEditType(e.target.value as TransactionType)
                                }
                              >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-3">
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Amount
                              </label>
                              <input
                                type="text"
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                className="w-full p-1.5 rounded bg-gray-900 border border-gray-700 text-xs"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelInlineEdit}
                              className="px-3 py-1 rounded border border-gray-700 text-[11px] text-gray-200 bg-gray-900 hover:bg-gray-800 transition"
                              disabled={savingEdit || uploadingEditReceipts}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              className="px-3 py-1 rounded border border-gray-700 text-[11px] bg-white text-black font-semibold hover:bg-gray-200 transition"
                              disabled={savingEdit || uploadingEditReceipts}
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx)}
                              className="px-3 py-1 rounded border border-red-500 text-[11px] text-red-300 bg-gray-900 hover:bg-gray-900/70 transition"
                              disabled={savingEdit || uploadingEditReceipts}
                            >
                              Delete
                            </button>
                          </div>

                          <div className="pt-2 border-t border-gray-800">
                            <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">
                              Receipts
                            </div>

                            <ReceiptUploader
                              files={editReceiptFiles}
                              onAdd={handleAddEditReceiptFiles}
                              onRemoveAt={handleRemoveEditReceiptAt}
                              disabled={uploadingEditReceipts || savingEdit}
                              label="Upload receipts (PDF or images, max 5 MB each)"
                            />

                            {editReceiptWarn && (
                              <div className="mt-2 text-xs text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded p-2">
                                {editReceiptWarn}
                              </div>
                            )}

                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={handleUploadReceiptsForEditingTx}
                                disabled={
                                  uploadingEditReceipts ||
                                  editReceiptFiles.length === 0
                                }
                                className="px-4 py-2 rounded bg-white text-black text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                              >
                                {uploadingEditReceipts
                                  ? "Uploading..."
                                  : "Upload receipts"}
                              </button>
                            </div>
                          </div>

                          <div className="pt-2">
                            <ReceiptList transactionId={tx.id} />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={tx.id} className="px-4 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {category ? category.name : "Uncategorized"}{" "}
                              <span className="text-xs text-gray-400">
                                ({tx.type})
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {wallet ? wallet.name : "Unknown wallet"} • {dateStr}
                              {tx.description ? ` • ${tx.description}` : null}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
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

                        <div className="mt-2">
                          <ReceiptList transactionId={tx.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-4 py-2 rounded border border-gray-700 text-sm bg-gray-900 hover:bg-gray-800 disabled:opacity-50 transition"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

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
