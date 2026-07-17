"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import ReceiptUploader, {
  validateReceiptFiles,
} from "@/components/receipts/ReceiptUploader";
import ReceiptList from "@/components/receipts/ReceiptList";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionCommandCenter } from "@/components/transactions/TransactionCommandCenter";
import { TransactionActivityCard } from "@/components/transactions/TransactionActivityCard";
import { TransactionTimeline } from "@/components/transactions/TransactionTimeline";
import { DataLoadAlert } from "@/components/ui/DataLoadAlert";
import { PrerequisiteGuide } from "@/components/activation/PrerequisiteGuide";
import { isValidLedgerDate, parsePositiveMoneyToMinor } from "@/lib/finance/money";
import { isMissingLedgerMetadata } from "@/lib/supabase/schemaCompatibility";
import { isInternalTransferCategory } from "@/lib/transactions/classification";
import {
  browserTimeZone,
  buildOccurredAt,
  compareLedgerTransactions,
  currentLocalMonthBoundsIso,
  currentLocalDate,
  currentLocalTime,
  occurredAtFormValues,
  occurredAtDateKey,
  type OccurredAtPrecision,
} from "@/lib/time/ledgerTime";

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
  is_active: boolean;
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
  occurred_at_precision?: OccurredAtPrecision | null;
  occurred_timezone?: string | null;
  description: string | null;
  created_at: string;
  transaction_kind?: string | null;
  transfer_id?: string | null;
};

const PAGE_SIZE = 25;
const SUMMARY_PAGE_SIZE = 1000;

function currentMonthBounds() {
  return currentLocalMonthBoundsIso();
}

function isCurrentMonthTransaction(transaction: Pick<Transaction, "occurred_at">) {
  const { start, end } = currentMonthBounds();
  return transaction.occurred_at >= start && transaction.occurred_at < end;
}

async function loadCurrentMonthTransactions(): Promise<{
  data: Transaction[];
  error: string | null;
}> {
  const { start, end } = currentMonthBounds();
  const rows: Transaction[] = [];

  for (let from = 0; ; from += SUMMARY_PAGE_SIZE) {
    const enhancedResult = await supabaseBrowserClient
      .from("transactions")
      .select("id, wallet_id, category_id, type, amount_minor, currency_code, occurred_at, description, created_at, transaction_kind, transfer_id")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: false })
      .range(from, from + SUMMARY_PAGE_SIZE - 1);

    let pageData = enhancedResult.data as Transaction[] | null;
    let pageError = enhancedResult.error;
    if (isMissingLedgerMetadata(enhancedResult.error)) {
      const legacyResult = await supabaseBrowserClient
        .from("transactions")
        .select("id, wallet_id, category_id, type, amount_minor, currency_code, occurred_at, description, created_at")
        .gte("occurred_at", start)
        .lt("occurred_at", end)
        .order("occurred_at", { ascending: false })
        .range(from, from + SUMMARY_PAGE_SIZE - 1);
      pageData = legacyResult.data as Transaction[] | null;
      pageError = legacyResult.error;
    }

    if (pageError) return { data: [], error: pageError.message };
    const page = pageData ?? [];
    rows.push(...page);
    if (page.length < SUMMARY_PAGE_SIZE) return { data: rows, error: null };
  }
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

async function uploadReceiptForTransaction(params: {
  userId: string;
  transactionId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let receiptId: string | null = null;

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

    receiptId = receipt.id as string;
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

    // Persist the signed path before uploading so a successful upload can never
    // be left behind with an unusable "pending" database record.
    const { error: pathError } = await supabaseBrowserClient
      .from("receipts")
      .update({ storage_path: path })
      .eq("id", receiptId);

    if (pathError) {
      await supabaseBrowserClient.from("receipts").delete().eq("id", receiptId);
      return { ok: false, error: pathError.message };
    }

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

    return { ok: true };
  } catch (error: unknown) {
    if (receiptId) {
      await supabaseBrowserClient.from("receipts").delete().eq("id", receiptId);
    }
    return { ok: false, error: getErrorMessage(error, "Unknown upload error.") };
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
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);

  // Add transaction form
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeKnown, setTimeKnown] = useState(true);
  const [description, setDescription] = useState("");
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [destinationWalletId, setDestinationWalletId] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferTime, setTransferTime] = useState("");
  const [transferTimeKnown, setTransferTimeKnown] = useState(true);
  const [transferDescription, setTransferDescription] = useState("");
  const [savingTransfer, setSavingTransfer] = useState(false);

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
  const [editTime, setEditTime] = useState("");
  const [editTimeKnown, setEditTimeKnown] = useState(false);
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
  const [oldestTransactionId, setOldestTransactionId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setErrorMsg("");
      setLoadError(false);

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        console.error("Unable to verify the transaction session:", userError);
        setLoadError(true);
        setLoading(false);
        return;
      }

      const [walletResult, categoryResult, transactionResult, monthResult] = await Promise.all([
        supabaseBrowserClient.from("wallets").select("id, name, currency_code").order("created_at", { ascending: true }),
        supabaseBrowserClient.from("categories").select("id, name, type, is_active").order("type", { ascending: true }).order("name", { ascending: true }),
        supabaseBrowserClient.from("transactions").select("*").order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE),
        loadCurrentMonthTransactions(),
      ]);

      const { data: walletData, error: walletError } = walletResult;
      const { data: categoryData, error: categoryError } = categoryResult;
      const { data: txData, error: txError } = transactionResult;

      if (walletError || categoryError || txError || monthResult.error) {
        console.error("Unable to certify transaction data:", {
          walletError,
          categoryError,
          transactionError: txError,
          monthSummaryError: monthResult.error,
        });
        setLoadError(true);
        setLoading(false);
        return;
      }

      setWallets(walletData as Wallet[]);
      setCategories(categoryData as Category[]);
      const castTx = (txData ?? []) as Transaction[];
      setTransactions(castTx);
      setMonthTransactions(monthResult.data);

      if (castTx.length > 0) {
        setOldestOccurredAt(castTx[castTx.length - 1].occurred_at);
        setOldestTransactionId(castTx[castTx.length - 1].id);
        setHasMore(castTx.length === PAGE_SIZE);
      } else {
        setOldestOccurredAt(null);
        setOldestTransactionId(null);
        setHasMore(false);
      }

      if (walletData && walletData.length > 0 && !walletId) setWalletId(walletData[0].id);
      if (walletData && walletData.length > 0 && !sourceWalletId) setSourceWalletId(walletData[0].id);
      if (walletData && walletData.length > 1 && !destinationWalletId) setDestinationWalletId(walletData[1].id);
      const loadedCategories = (categoryData as Category[] | null) ?? [];
      const initialCategory = loadedCategories.find(
        (category) =>
          category.is_active &&
          category.type === "expense" &&
          !isInternalTransferCategory(category)
      ) ?? loadedCategories.find(
        (category) => category.is_active && !isInternalTransferCategory(category)
      );
      if (initialCategory && !categoryId) {
        setCategoryId(initialCategory.id);
        setType(initialCategory.type);
      }
      if (!date) setDate(currentLocalDate());
      if (!time) setTime(currentLocalTime());
      if (!transferDate) setTransferDate(currentLocalDate());
      if (!transferTime) setTransferTime(currentLocalTime());

      setLoading(false);
    }

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVersion]);

  async function handleLoadMore() {
    if (!oldestOccurredAt || !oldestTransactionId || !hasMore || loadingMore) return;

    setLoadingMore(true);
    setErrorMsg("");

    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .select("*")
      .or(
        `occurred_at.lt.${oldestOccurredAt},and(occurred_at.eq.${oldestOccurredAt},id.lt.${oldestTransactionId})`
      )
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
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
      combined.sort(compareLedgerTransactions);
      return combined;
    });

    if (newTx.length < PAGE_SIZE) setHasMore(false);
    setOldestOccurredAt(newTx[newTx.length - 1].occurred_at);
    setOldestTransactionId(newTx[newTx.length - 1].id);
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

    const selectedCategory = categories.find((category) => category.id === categoryId);
    if (!selectedCategory?.is_active || selectedCategory.type !== type) {
      setErrorMsg(`Please select an ${type} category for this ${type} transaction.`);
      setSaving(false);
      return;
    }
    if (isInternalTransferCategory(selectedCategory)) {
      setErrorMsg("Use Transfer / FX to record both sides of this balance movement together.");
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

    const parsedAmount = parsePositiveMoneyToMinor(amount);
    if (!parsedAmount.ok) {
      setErrorMsg(parsedAmount.error);
      setSaving(false);
      return;
    }
    const amount_minor = parsedAmount.minor;
    if (!isValidLedgerDate(date)) {
      setErrorMsg("Select a valid transaction date.");
      setSaving(false);
      return;
    }
    const precision: OccurredAtPrecision = timeKnown ? "datetime" : "date";
    const occurred_at = buildOccurredAt({ date, time, precision });
    if (!occurred_at) {
      setErrorMsg(timeKnown ? "Select a valid transaction date and time." : "Select a valid transaction date.");
      setSaving(false);
      return;
    }

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
        occurred_at_precision: precision,
        occurred_timezone: timeKnown ? browserTimeZone() : null,
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
      combined.sort(compareLedgerTransactions);
      return combined;
    });
    if (isCurrentMonthTransaction(created)) {
      setMonthTransactions((prev) => [created, ...prev]);
    }

    if (!oldestOccurredAt) {
      setOldestOccurredAt(created.occurred_at);
      setOldestTransactionId(created.id);
    }

    setAmount("0");
    setDescription("");
    setDate(currentLocalDate());
    setTime(currentLocalTime());
    setTimeKnown(true);
    setNewReceiptFiles([]);
    setReceiptWarn("");
    setSaving(false);
  }

  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSavingTransfer(true);

    const sourceWallet = wallets.find((wallet) => wallet.id === sourceWalletId);
    const destinationWallet = wallets.find((wallet) => wallet.id === destinationWalletId);
    if (!sourceWallet || !destinationWallet || sourceWallet.id === destinationWallet.id) {
      setErrorMsg("Select two different wallets.");
      setSavingTransfer(false);
      return;
    }

    const source = parsePositiveMoneyToMinor(sourceAmount);
    const destination = parsePositiveMoneyToMinor(destinationAmount);
    if (!source.ok || !destination.ok) {
      setErrorMsg(!source.ok ? source.error : destination.ok ? "Enter valid amounts." : destination.error);
      setSavingTransfer(false);
      return;
    }
    if (!isValidLedgerDate(transferDate)) {
      setErrorMsg("Select a valid transfer date.");
      setSavingTransfer(false);
      return;
    }

    const kind = sourceWallet.currency_code === destinationWallet.currency_code ? "transfer" : "fx";
    if (kind === "transfer" && source.minor !== destination.minor) {
      setErrorMsg("Transfers between wallets in the same currency must use the same amount.");
      setSavingTransfer(false);
      return;
    }

    const transferPrecision: OccurredAtPrecision = transferTimeKnown ? "datetime" : "date";
    const transferOccurredAt = buildOccurredAt({
      date: transferDate,
      time: transferTime,
      precision: transferPrecision,
    });
    if (!transferOccurredAt) {
      setErrorMsg(transferTimeKnown ? "Select a valid transfer date and time." : "Select a valid transfer date.");
      setSavingTransfer(false);
      return;
    }

    const { data: transferId, error } = await supabaseBrowserClient.rpc("create_wallet_transfer", {
      p_source_wallet_id: sourceWallet.id,
      p_destination_wallet_id: destinationWallet.id,
      p_source_amount_minor: source.minor,
      p_destination_amount_minor: destination.minor,
      p_occurred_at: transferOccurredAt,
      p_kind: kind,
      p_description: transferDescription.trim() || null,
    });

    if (error) {
      setErrorMsg(
        isMissingLedgerMetadata(error)
          ? "Transfers and currency exchanges are being upgraded. Refresh after the database update is complete."
          : "We could not save both sides of this balance movement. No partial transfer was created."
      );
      setSavingTransfer(false);
      return;
    }

    if (transferId) {
      const { error: metadataError } = await supabaseBrowserClient
        .from("transactions")
        .update({
          occurred_at_precision: transferPrecision,
          occurred_timezone: transferTimeKnown ? browserTimeZone() : null,
        })
        .eq("transfer_id", transferId as string);
      if (metadataError) {
        console.warn("Balance movement saved, but its time metadata could not be certified", metadataError);
      }
    }

    setSourceAmount("");
    setDestinationAmount("");
    setTransferDescription("");
    setTransferDate(currentLocalDate());
    setTransferTime(currentLocalTime());
    setTransferTimeKnown(true);
    setShowTransferForm(false);
    setSavingTransfer(false);
    setLoadVersion((value) => value + 1);
  }

  function handleStartInlineEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    setEditWalletId(tx.wallet_id);
    if (tx.category_id) setEditCategoryId(tx.category_id);
    else if (categories.length > 0) setEditCategoryId(categories[0].id);
    setEditType(tx.type);
    setEditAmount(formatMinorToAmount(tx.amount_minor));
    const precision = tx.occurred_at_precision === "datetime" ? "datetime" : "date";
    const formValues = occurredAtFormValues(tx.occurred_at, precision, tx.occurred_timezone);
    setEditDate(formValues.date);
    setEditTime(formValues.time ?? currentLocalTime());
    setEditTimeKnown(precision === "datetime");
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
    setEditTime("");
    setEditTimeKnown(false);

    setEditReceiptFiles([]);
    setEditReceiptWarn("");
    setUploadingEditReceipts(false);
  }

  async function handleSaveInlineEdit() {
    if (!editingTxId) return;
    setSavingEdit(true);
    setErrorMsg("");

    const editingTransaction =
      transactions.find((transaction) => transaction.id === editingTxId) ??
      monthTransactions.find((transaction) => transaction.id === editingTxId);

    if (editingTransaction?.transfer_id) {
      const parsedAmount = parsePositiveMoneyToMinor(editAmount);
      if (!parsedAmount.ok) {
        setErrorMsg(parsedAmount.error);
        setSavingEdit(false);
        return;
      }
      if (!isValidLedgerDate(editDate)) {
        setErrorMsg("Select a valid transaction date.");
        setSavingEdit(false);
        return;
      }

      const precision: OccurredAtPrecision = editTimeKnown ? "datetime" : "date";
      const occurredAt = buildOccurredAt({ date: editDate, time: editTime, precision });
      if (!occurredAt) {
        setErrorMsg(editTimeKnown ? "Select a valid transaction date and time." : "Select a valid transaction date.");
        setSavingEdit(false);
        return;
      }

      const { error } = await supabaseBrowserClient.rpc("update_wallet_transfer", {
        p_transaction_id: editingTransaction.id,
        p_amount_minor: parsedAmount.minor,
        p_occurred_at: occurredAt,
        p_description: editDescription.trim() || null,
      });

      if (error) {
        console.error("Unable to update paired wallet movement:", error);
        setErrorMsg("We could not update both sides of this balance movement. No partial change was saved.");
        setSavingEdit(false);
        return;
      }

      const { error: metadataError } = await supabaseBrowserClient
        .from("transactions")
        .update({
          occurred_at_precision: precision,
          occurred_timezone: editTimeKnown ? browserTimeZone() : null,
        })
        .eq("transfer_id", editingTransaction.transfer_id);
      if (metadataError) {
        console.warn("Paired movement updated, but its time metadata could not be certified", metadataError);
      }

      setSavingEdit(false);
      handleCancelInlineEdit();
      setLoadVersion((value) => value + 1);
      return;
    }

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

    const selectedCategory = categories.find((category) => category.id === editCategoryId);
    if (!selectedCategory || selectedCategory.type !== editType) {
      setErrorMsg(`Please select an ${editType} category for this ${editType} transaction.`);
      setSavingEdit(false);
      return;
    }

    const parsedAmount = parsePositiveMoneyToMinor(editAmount);
    if (!parsedAmount.ok) {
      setErrorMsg(parsedAmount.error);
      setSavingEdit(false);
      return;
    }
    if (!isValidLedgerDate(editDate)) {
      setErrorMsg("Select a valid transaction date.");
      setSavingEdit(false);
      return;
    }
    const amount_minor = parsedAmount.minor;
    const precision: OccurredAtPrecision = editTimeKnown ? "datetime" : "date";
    const occurred_at = buildOccurredAt({ date: editDate, time: editTime, precision });
    if (!occurred_at) {
      setErrorMsg(editTimeKnown ? "Select a valid transaction date and time." : "Select a valid transaction date.");
      setSavingEdit(false);
      return;
    }

    const { data, error } = await supabaseBrowserClient
      .from("transactions")
      .update({
        wallet_id: editWalletId,
        category_id: editCategoryId,
        type: editType,
        amount_minor,
        currency_code: selectedWallet.currency_code,
        occurred_at,
        occurred_at_precision: precision,
        occurred_timezone: editTimeKnown ? browserTimeZone() : null,
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
      combined.sort(compareLedgerTransactions);
      return combined;
    });
    setMonthTransactions((prev) => {
      const withoutEdited = prev.filter((tx) => tx.id !== editingTxId);
      return isCurrentMonthTransaction(updated) ? [updated, ...withoutEdited] : withoutEdited;
    });

    setSavingEdit(false);
    handleCancelInlineEdit();
  }

  async function actuallyDeleteFromDatabase(tx: Transaction) {
    const { error } = await supabaseBrowserClient
      .from("transactions")
      .delete()
      .eq("id", tx.id);
    if (error) {
      console.error(error);
      setTransactions((prev) => {
        if (prev.some((item) => item.id === tx.id)) return prev;
        const restored = [tx, ...prev];
        restored.sort(compareLedgerTransactions);
        return restored;
      });
      if (isCurrentMonthTransaction(tx)) {
        setMonthTransactions((prev) => {
          if (prev.some((item) => item.id === tx.id)) return prev;
          const restored = [tx, ...prev];
          restored.sort(compareLedgerTransactions);
          return restored;
        });
      }
      setErrorMsg(`The transaction could not be deleted and was restored. ${error.message}`);
      return false;
    }
    return true;
  }

  async function handleDeleteTransaction(tx: Transaction) {
    setErrorMsg("");

    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      await actuallyDeleteFromDatabase(pendingDelete.tx);
      setPendingDelete(null);
    }

    if (tx.transfer_id) {
      const confirmed = window.confirm(
        "Delete both sides of this transfer or currency exchange? This keeps wallet balances consistent."
      );
      if (!confirmed) return;

      const { error } = await supabaseBrowserClient.rpc("delete_wallet_transfer", {
        p_transfer_id: tx.transfer_id,
      });
      if (error) {
        console.error("Unable to delete paired wallet movement:", error);
        setErrorMsg("We could not delete the complete balance movement. No ledger entries were removed.");
        return;
      }

      setTransactions((prev) => prev.filter((item) => item.transfer_id !== tx.transfer_id));
      setMonthTransactions((prev) => prev.filter((item) => item.transfer_id !== tx.transfer_id));
      if (editingTxId === tx.id) handleCancelInlineEdit();
      setLoadVersion((value) => value + 1);
      return;
    }

    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    setMonthTransactions((prev) => prev.filter((item) => item.id !== tx.id));
    if (editingTxId === tx.id) handleCancelInlineEdit();

    const timeoutId = setTimeout(() => {
      void actuallyDeleteFromDatabase(tx);
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
      combined.sort(compareLedgerTransactions);
      return combined;
    });
    if (isCurrentMonthTransaction(pendingDelete.tx)) {
      setMonthTransactions((prev) => {
        if (prev.some((tx) => tx.id === pendingDelete.tx.id)) return prev;
        return [pendingDelete.tx, ...prev];
      });
    }

    setPendingDelete(null);
  }

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.id, c] as const)
  );
  const activeCategories = categories.filter((category) => category.is_active);
  const operationalCategories = activeCategories.filter(
    (category) => !isInternalTransferCategory(category)
  );

  const dateFilteredTransactions = transactions.filter((tx) => {
    const dateStr = occurredAtDateKey(
      tx.occurred_at,
      tx.occurred_at_precision === "datetime" ? "datetime" : "date",
      tx.occurred_timezone
    );
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
          const dateStr = occurredAtDateKey(
            tx.occurred_at,
            tx.occurred_at_precision === "datetime" ? "datetime" : "date",
            tx.occurred_timezone
          );
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
    <div className="gl-page-migrated">
      {/* Tight, app-like header (less link-bar) */}
        <div className="gl-page-shell max-w-6xl">
        <PageHeader
          title="Transactions"
          description="Add and review income, expenses, transfers, and receipts."
        />

        <TransactionCommandCenter
          transactions={monthTransactions}
          categoriesById={categoryMap}
          dataState={loading ? "loading" : loadError ? "error" : "ready"}
          scopeLabel="This month"
        />

        {loadError ? <DataLoadAlert onRetry={() => setLoadVersion((value) => value + 1)} /> : null}
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

        {/* Add Transaction */}
        <section className="gl-card">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400">
                Income or expense
              </div>
              <h2 className="text-sm font-semibold mt-1 leading-tight">
                Add Transaction
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="gl-btn gl-btn-primary gl-btn-sm"
            >
              {showCreateForm ? "Hide Form" : "+ Add Transaction"}
            </button>
          </div>

          {showCreateForm ? (
          <div className="p-4">
            {wallets.length === 0 || activeCategories.length === 0 ? (
              <PrerequisiteGuide
                title="Before adding a transaction"
                items={[
                  { label: "Wallet", complete: wallets.length > 0, href: "/wallets", actionLabel: "Add wallet" },
                  { label: "Category", complete: activeCategories.length > 0, href: "/categories", actionLabel: "Add category" },
                ]}
              />
            ) : (
              <form
                onSubmit={handleCreateTransaction}
                className="grid gap-4 md:grid-cols-3"
              >
                <div>
                  <label htmlFor="transaction-wallet" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Wallet
                  </label>
                  <select
                    id="transaction-wallet"
                    className="gl-input"
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency_code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] font-medium text-amber-300">
                    This transaction will be recorded in {walletMap[walletId]?.currency_code ?? "the wallet currency"}.
                  </p>
                </div>

                <div>
                  <label htmlFor="transaction-category" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Category
                  </label>
                  <select
                    id="transaction-category"
                    className="gl-input"
                    value={categoryId}
                    onChange={(e) => {
                      const nextCategoryId = e.target.value;
                      const nextCategory = categories.find(
                        (category) => category.id === nextCategoryId
                      );
                      setCategoryId(nextCategoryId);
                      if (nextCategory) setType(nextCategory.type);
                    }}
                  >
                    <optgroup label="Expense categories">
                      {activeCategories
                        .filter((category) => category.type === "expense")
                        .map((category) => {
                          const internalMovement = isInternalTransferCategory(category);
                          return (
                          <option key={category.id} value={category.id} disabled={internalMovement}>
                            {category.name}{internalMovement ? " — Use Transfer / FX" : ""}
                          </option>
                          );
                        })}
                    </optgroup>
                    <optgroup label="Income categories">
                      {activeCategories
                        .filter((category) => category.type === "income")
                        .map((category) => {
                          const internalMovement = isInternalTransferCategory(category);
                          return (
                          <option key={category.id} value={category.id} disabled={internalMovement}>
                            {category.name}{internalMovement ? " — Use Transfer / FX" : ""}
                          </option>
                          );
                        })}
                    </optgroup>
                  </select>
                  <p className="mt-1 text-[11px] leading-4 text-gray-500">
                    All {activeCategories.length} active categories are visible. Transfer and FX categories use the paired balance-movement workflow below.
                  </p>
                </div>

                <div>
                  <label htmlFor="transaction-type" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Type
                  </label>
                  <select
                    id="transaction-type"
                    className="gl-input"
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as TransactionType;
                      setType(nextType);
                      setCategoryId(operationalCategories.find((category) => category.type === nextType)?.id ?? "");
                    }}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="transaction-amount" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Amount
                  </label>
                  <input
                    id="transaction-amount"
                    type="text"
                    className="gl-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="transaction-date" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Date
                  </label>
                  <input
                    id="transaction-date"
                    type="date"
                    className="gl-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="transaction-time" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Time
                  </label>
                  <input
                    id="transaction-time"
                    type="time"
                    className="gl-input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={!timeKnown}
                    required={timeKnown}
                  />
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-gray-400">
                    <input
                      type="checkbox"
                      checked={!timeKnown}
                      onChange={(event) => setTimeKnown(!event.target.checked)}
                    />
                    Time unknown — keep this as a date-only record
                  </label>
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="transaction-description" className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    Description
                  </label>
                  <input
                    id="transaction-description"
                    type="text"
                    className="gl-input"
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
                    className="gl-btn gl-btn-primary gl-btn-md"
                  >
                    {saving ? "Saving..." : "Save Transaction"}
                  </button>
                </div>
              </form>
            )}
          </div>
          ) : null}
        </section>

        <section className="gl-card">
          <div className="flex items-center justify-between gap-4 border-b border-gray-800 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400">Between wallets</div>
              <h2 className="mt-1 text-sm font-semibold">Transfer or exchange</h2>
              <p className="mt-1 text-xs text-gray-500">Creates both ledger entries together. Balances change; income, expenses and budgets do not.</p>
            </div>
            <button
              type="button"
              className="gl-btn gl-btn-secondary gl-btn-sm"
              onClick={() => setShowTransferForm((value) => !value)}
              disabled={wallets.length < 2}
            >
              {showTransferForm ? "Hide Form" : "+ Transfer / FX"}
            </button>
          </div>
          {showTransferForm ? (
            <form onSubmit={handleCreateTransfer} className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label htmlFor="transfer-source-wallet" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">From wallet</label>
                <select id="transfer-source-wallet" className="gl-input" value={sourceWalletId} onChange={(event) => setSourceWalletId(event.target.value)}>
                  {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency_code})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="transfer-destination-wallet" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">To wallet</label>
                <select id="transfer-destination-wallet" className="gl-input" value={destinationWalletId} onChange={(event) => setDestinationWalletId(event.target.value)}>
                  {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} ({wallet.currency_code})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="transfer-source-amount" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">Amount sent ({walletMap[sourceWalletId]?.currency_code ?? "—"})</label>
                <input id="transfer-source-amount" className="gl-input" inputMode="decimal" value={sourceAmount} onChange={(event) => setSourceAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label htmlFor="transfer-destination-amount" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">Amount received ({walletMap[destinationWalletId]?.currency_code ?? "—"})</label>
                <input id="transfer-destination-amount" className="gl-input" inputMode="decimal" value={destinationAmount} onChange={(event) => setDestinationAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label htmlFor="transfer-date" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">Date</label>
                <input id="transfer-date" type="date" className="gl-input" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="transfer-time" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">Time</label>
                <input
                  id="transfer-time"
                  type="time"
                  className="gl-input"
                  value={transferTime}
                  onChange={(event) => setTransferTime(event.target.value)}
                  disabled={!transferTimeKnown}
                  required={transferTimeKnown}
                />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-gray-400">
                  <input
                    type="checkbox"
                    checked={!transferTimeKnown}
                    onChange={(event) => setTransferTimeKnown(!event.target.checked)}
                  />
                  Time unknown
                </label>
              </div>
              <div>
                <label htmlFor="transfer-description" className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">Description</label>
                <input id="transfer-description" className="gl-input" value={transferDescription} onChange={(event) => setTransferDescription(event.target.value)} placeholder="Optional transfer or exchange note" />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={savingTransfer} className="gl-btn gl-btn-primary gl-btn-md">
                  {savingTransfer ? "Saving both entries..." : "Save balance movement"}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {/* Recent Transactions */}
        <section className="gl-card">
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
                  className="gl-input"
                  aria-label="Filter transactions from date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <span className="self-center text-xs text-gray-500">to</span>
                <input
                  type="date"
                  className="gl-input"
                  aria-label="Filter transactions through date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="gl-btn gl-btn-secondary gl-btn-sm"
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
                  className="flex-1 gl-input"
                  aria-label="Search recent transactions"
                  placeholder="Search recent transactions..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="gl-btn gl-btn-primary gl-btn-sm"
                >
                  Search
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="gl-btn gl-btn-secondary gl-btn-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {loading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : loadError ? (
              <p className="text-gray-500 text-sm">Transaction records are unavailable.</p>
            ) : transactions.length === 0 ? (
              <EmptyState
                compact
                title="No transactions yet"
                description="Create your first transaction to begin tracking activity."
                action={
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="gl-btn gl-btn-primary gl-btn-sm"
                  >
                    Add Transaction
                  </button>
                }
              />
            ) : filteredTransactions.length === 0 ? (
              <EmptyState
                compact
                title="No matching transactions"
                description="Adjust your search or date filters to see more activity."
              />
            ) : (
              <>
                <TransactionTimeline
                  transactions={filteredTransactions}
                  renderTransaction={(tx) => {
                    const wallet = walletMap[tx.wallet_id];
                    const category = tx.category_id
                      ? categoryMap[tx.category_id]
                      : null;
                    const isEditing = editingTxId === tx.id;

                    if (isEditing) {
                      return (
                        <div
                          key={tx.id}
                          className="px-4 py-3 space-y-2 bg-black/60"
                        >
                          <div className="text-[11px] uppercase tracking-wider text-gray-400">
                            {tx.transfer_id ? "Editing paired balance movement" : "Editing transaction"}
                          </div>

                          {tx.transfer_id ? (
                            <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                              <p className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs leading-5 text-blue-100">
                                Wallet, currency, direction, and classification stay locked so both ledger legs remain consistent. Date and description update both sides.
                              </p>
                              <div>
                                <label htmlFor={`edit-date-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                  Date
                                </label>
                                <input
                                  id={`edit-date-${tx.id}`}
                                  type="date"
                                  className="gl-input text-xs py-1.5"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-2 md:grid-cols-4">
                            <div>
                              <label htmlFor={`edit-wallet-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Wallet
                              </label>
                              <select
                                id={`edit-wallet-${tx.id}`}
                                className="gl-input text-xs py-1.5"
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
                              <label htmlFor={`edit-category-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Category
                              </label>
                              <select
                                id={`edit-category-${tx.id}`}
                                className="gl-input text-xs py-1.5"
                                value={editCategoryId}
                                onChange={(e) => {
                                  const nextCategoryId = e.target.value;
                                  const nextCategory = categories.find(
                                    (category) => category.id === nextCategoryId
                                  );
                                  setEditCategoryId(nextCategoryId);
                                  if (nextCategory) setEditType(nextCategory.type);
                                }}
                              >
                                <optgroup label="Expense categories">
                                  {operationalCategories
                                    .filter((category) => category.type === "expense")
                                    .map((category) => (
                                      <option key={category.id} value={category.id}>
                                        {category.name}
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Income categories">
                                  {operationalCategories
                                    .filter((category) => category.type === "income")
                                    .map((category) => (
                                      <option key={category.id} value={category.id}>
                                        {category.name}
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                            </div>

                            <div>
                              <label htmlFor={`edit-type-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Type
                              </label>
                              <select
                                id={`edit-type-${tx.id}`}
                                className="gl-input text-xs py-1.5"
                                value={editType}
                                onChange={(e) => {
                                  const nextType = e.target.value as TransactionType;
                                  setEditType(nextType);
                                  setEditCategoryId(
                                    operationalCategories.find((category) => category.type === nextType)?.id ?? ""
                                  );
                                }}
                              >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                              </select>
                            </div>

                            <div>
                              <label htmlFor={`edit-date-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Date
                              </label>
                              <input
                                id={`edit-date-${tx.id}`}
                                type="date"
                                className="gl-input text-xs py-1.5"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            </div>
                            </div>
                          )}

                          <div className="grid gap-2 md:grid-cols-[220px_1fr] md:items-end">
                            <div>
                              <label htmlFor={`edit-time-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Time
                              </label>
                              <input
                                id={`edit-time-${tx.id}`}
                                type="time"
                                className="gl-input text-xs py-1.5"
                                value={editTime}
                                onChange={(event) => setEditTime(event.target.value)}
                                disabled={!editTimeKnown}
                                required={editTimeKnown}
                              />
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 pb-2 text-[11px] text-gray-400">
                              <input
                                type="checkbox"
                                checked={!editTimeKnown}
                                onChange={(event) => setEditTimeKnown(!event.target.checked)}
                              />
                              Time unknown — display only the calendar date
                            </label>
                          </div>

                          <div className="grid gap-2 md:grid-cols-3">
                            <div>
                              <label htmlFor={`edit-amount-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Amount
                              </label>
                              <input
                                id={`edit-amount-${tx.id}`}
                                type="text"
                                className="gl-input text-xs py-1.5"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label htmlFor={`edit-description-${tx.id}`} className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                                Description
                              </label>
                              <input
                                id={`edit-description-${tx.id}`}
                                type="text"
                                className="gl-input text-xs py-1.5"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelInlineEdit}
                              className="gl-btn gl-btn-secondary gl-btn-sm"
                              disabled={savingEdit || uploadingEditReceipts}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              className="gl-btn gl-btn-primary gl-btn-sm"
                              disabled={savingEdit || uploadingEditReceipts}
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx)}
                              className="gl-btn gl-btn-danger gl-btn-sm"
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
                                className="gl-btn gl-btn-primary gl-btn-sm"
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
                      <TransactionActivityCard
                        key={tx.id}
                        tx={tx}
                        wallet={wallet}
                        category={category}
                        onEdit={handleStartInlineEdit}
                        onDelete={handleDeleteTransaction}
                      />
                    );
                  }}
                />

                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="gl-btn gl-btn-secondary gl-btn-md"
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
                className="gl-btn gl-btn-primary gl-btn-sm"
              >
                Undo
              </button>
            </div>
          </div>
        )}
        </div>
    </div>
  );
}
