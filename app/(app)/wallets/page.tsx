"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSection } from "@/components/ui/PageSection";
import { PageShell } from "@/components/ui/PageShell";
import Skeleton from "@/components/ui/Skeleton";
import { parseMoneyToMinor } from "@/lib/finance/money";

type Wallet = {
  id: string;
  name: string;
  type: "cash" | "bank" | "mobile" | "other";
  currency_code: string;
  starting_balance_minor: number;
  created_at: string;
};

type WalletBalance = {
  wallet_id: string;
  current_balance_minor: number;
  last_activity_at: string | null;
};

const WALLET_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "mobile", label: "Mobile Money" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
] as const;

const WALLET_TYPE_META: Record<
  Wallet["type"],
  { label: string; icon: string; description: string }
> = {
  cash: {
    label: "Cash",
    icon: "◼",
    description: "Physical cash reserve",
  },
  mobile: {
    label: "Mobile Money",
    icon: "▣",
    description: "Mobile wallet balance",
  },
  bank: {
    label: "Bank",
    icon: "▤",
    description: "Bank account position",
  },
  other: {
    label: "Other",
    icon: "◆",
    description: "Custom asset wallet",
  },
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWalletDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getCurrencyTotals(wallets: Wallet[], balances: Record<string, WalletBalance>) {
  const totals = new Map<string, number>();

  for (const wallet of wallets) {
    const currency = wallet.currency_code || "—";
    const currentBalance = balances[wallet.id]?.current_balance_minor ?? wallet.starting_balance_minor;
    totals.set(currency, (totals.get(currency) ?? 0) + currentBalance);
  }

  return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function WalletsPage() {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletBalances, setWalletBalances] = useState<Record<string, WalletBalance>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  // create form state
  const [name, setName] = useState("");
  const [type, setType] = useState<Wallet["type"]>("cash");
  const [currencyCode, setCurrencyCode] = useState("SSP");
  const [startingBalance, setStartingBalance] = useState("0");
  const [saving, setSaving] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<Wallet["type"]>("cash");
  const [editCurrencyCode, setEditCurrencyCode] = useState("SSP");
  const [editStartingBalance, setEditStartingBalance] = useState("0");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const walletById = useMemo(() => {
    return Object.fromEntries(wallets.map((w) => [w.id, w] as const));
  }, [wallets]);

  const currencyTotals = useMemo(
    () => getCurrencyTotals(wallets, walletBalances),
    [walletBalances, wallets]
  );

  useEffect(() => {
    async function loadWallets() {
      setLoading(true);
      setErrorMsg("");

      const [sessionResult, walletResult, balanceResult] = await Promise.all([
        supabaseBrowserClient.auth.getSession(),
        supabaseBrowserClient
          .from("wallets")
          .select("*")
          .order("created_at", { ascending: true }),
        supabaseBrowserClient.rpc("get_wallet_balances"),
      ]);

      const {
        data: { session },
        error: sessionError,
      } = sessionResult;
      const user = session?.user ?? null;

      if (sessionError || !user) {
        setErrorMsg("You must be logged in to view wallets.");
        setLoading(false);
        return;
      }

      const { data, error } = walletResult;

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setWallets(data as Wallet[]);
      if (balanceResult.error) {
        console.warn("Unable to load transaction-adjusted wallet balances", balanceResult.error);
      } else {
        const rows = (balanceResult.data ?? []) as WalletBalance[];
        setWalletBalances(Object.fromEntries(rows.map((row) => [row.wallet_id, row])));
      }
      setLoading(false);
    }

    loadWallets();
  }, []);

  function beginEdit(id: string) {
    const w = walletById[id];
    if (!w) return;

    setEditingId(id);
    setEditName(w.name);
    setEditType(w.type);
    setEditCurrencyCode(w.currency_code);
    setEditStartingBalance(formatMinorToAmount(w.starting_balance_minor));
    setErrorMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCurrencyCode("SSP");
    setEditStartingBalance("0");
    setErrorMsg("");
  }

  async function handleCreateWallet(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    const normalizedCurrency = currencyCode.trim().toUpperCase();
    if (!name.trim() || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setErrorMsg("Enter a wallet name and a valid three-letter currency code.");
      setSaving(false);
      return;
    }

    const parsedBalance = parseMoneyToMinor(startingBalance);
    if (!parsedBalance.ok) {
      setErrorMsg(parsedBalance.error);
      setSaving(false);
      return;
    }
    const starting_balance_minor = parsedBalance.minor;

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabaseBrowserClient
      .from("wallets")
      .insert({
        user_id: user.id,
        name: name.trim(),
        type,
        currency_code: normalizedCurrency,
        starting_balance_minor,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setWallets((prev) => [...prev, data as Wallet]);
    setName("");
    setType("cash");
    setCurrencyCode("SSP");
    setStartingBalance("0");
    setShowCreatePanel(false);
    setSaving(false);
  }

  async function handleSaveEdit(id: string) {
    setRowBusyId(id);
    setErrorMsg("");

    const normalizedCurrency = editCurrencyCode.trim().toUpperCase();
    if (!editName.trim() || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setErrorMsg("Enter a wallet name and a valid three-letter currency code.");
      setRowBusyId(null);
      return;
    }

    const parsedBalance = parseMoneyToMinor(editStartingBalance);
    if (!parsedBalance.ok) {
      setErrorMsg(parsedBalance.error);
      setRowBusyId(null);
      return;
    }
    const starting_balance_minor = parsedBalance.minor;

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setRowBusyId(null);
      return;
    }

    const originalWallet = walletById[id];
    if (originalWallet && originalWallet.currency_code !== normalizedCurrency) {
      const { count, error: referenceError } = await supabaseBrowserClient
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("wallet_id", id);
      if (referenceError) {
        setErrorMsg("Unable to verify whether this wallet has ledger activity.");
        setRowBusyId(null);
        return;
      }
      if ((count ?? 0) > 0) {
        setErrorMsg("Currency cannot be changed after a wallet has transactions. Create a new wallet and transfer the balance instead.");
        setRowBusyId(null);
        return;
      }
    }

    const { data, error } = await supabaseBrowserClient
      .from("wallets")
      .update({
        name: editName.trim(),
        type: editType,
        currency_code: normalizedCurrency,
        starting_balance_minor,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setRowBusyId(null);
      return;
    }

    setWallets((prev) => prev.map((w) => (w.id === id ? (data as Wallet) : w)));
    setEditingId(null);
    setRowBusyId(null);
  }

  async function handleDeleteWallet(id: string) {
    const w = walletById[id];
    if (!w) return;

    const ok = window.confirm(
      `Delete wallet "${w.name}"? This may fail if transactions/budgets reference it.`
    );
    if (!ok) return;

    setRowBusyId(id);
    setErrorMsg("");

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setRowBusyId(null);
      return;
    }

    const { error } = await supabaseBrowserClient
      .from("wallets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      setErrorMsg(
        error.message ||
          "Unable to delete wallet. It may be referenced by transactions/budgets."
      );
      setRowBusyId(null);
      return;
    }

    setWallets((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
    setRowBusyId(null);
  }

  return (
    <PageShell className="gl-page-stack" size="xl">
      <PageHeader
        title="Wallets"
        description="Track balances across cash, bank, mobile money, and other accounts."
        action={
          <Button
            type="button"
            variant={showCreatePanel ? "secondary" : "primary"}
            onClick={() => setShowCreatePanel((value) => !value)}
            disabled={loading}
          >
            {showCreatePanel ? "Close" : "+ Add wallet"}
          </Button>
        }
      />

      {errorMsg ? <div className="gl-alert-error">{errorMsg}</div> : null}

      <PageSection>
        <Card
          variant="premium"
          className="overflow-hidden p-6 sm:p-7"
          aria-busy={loading}
        >
          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-white/35">
                Balances
              </p>

              <div className="mt-4 space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-48 max-w-full" rounded="xl" />
                    <Skeleton className="h-12 w-40 max-w-full" rounded="xl" />
                  </div>
                ) : currencyTotals.length > 0 ? (
                  currencyTotals.map(([currency, total]) => (
                    <div key={currency} className="flex flex-wrap items-end gap-x-3 gap-y-1">
                      <span className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                        {formatMinorToAmount(total)}
                      </span>
                      <span className="pb-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                        {currency}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <span className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                      0.00
                    </span>
                    <span className="pb-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                      SSP
                    </span>
                  </div>
                )}
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
                Includes each wallet’s opening balance and recorded activity.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div className="gl-inner-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">Wallets</p>
                {loading ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-9 w-14" rounded="lg" />
                    <Skeleton className="h-3 w-36" rounded="full" />
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-white">{wallets.length}</p>
                    <p className="mt-1 text-xs text-white/45">accounts tracked</p>
                  </>
                )}
              </div>

              <div className="gl-inner-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">Currencies</p>
                {loading ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-9 w-14" rounded="lg" />
                    <Skeleton className="h-3 w-28" rounded="full" />
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-3xl font-semibold text-white">{currencyTotals.length}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {currencyTotals.length > 0
                        ? currencyTotals.map(([currency]) => currency).join(" • ")
                        : "No currency yet"}
                    </p>
                  </>
                )}
              </div>

            </div>
          </div>
        </Card>
      </PageSection>

      {showCreatePanel ? (
        <PageSection>
          <Card variant="premium" className="p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge>New wallet</Badge>
                <h2 className="mt-3 text-xl font-semibold text-white">Add a wallet</h2>
                <p className="mt-1 text-sm text-white/50">
                  Add a cash, bank, mobile money, or custom wallet to your ledger.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateWallet} className="grid gap-4 md:grid-cols-2">
              <Input
                label="Wallet Name"
                type="text"
                placeholder="e.g. Cash, Mobile Money, Bank"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Select
                label="Wallet Type"
                value={type}
                onChange={(e) => setType(e.target.value as Wallet["type"])}
              >
                {WALLET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Currency"
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                hint="Use the currency code, for example SSP or USD."
              />

              <Input
                label="Starting Balance"
                type="text"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                hint="This is the opening position for this wallet."
              />

              <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setShowCreatePanel(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Wallet"}
                </Button>
              </div>
            </form>
          </Card>
        </PageSection>
      ) : null}

      <PageSection
        title="Your wallets"
        description="Current balances by account."
      >
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} variant="premium" className="min-h-72 animate-pulse p-6">
                <div className="h-8 w-8 rounded-2xl bg-white/10" />
                <div className="mt-8 h-5 w-2/3 rounded-full bg-white/10" />
                <div className="mt-4 h-10 w-1/2 rounded-full bg-white/10" />
                <div className="mt-10 h-20 rounded-3xl bg-white/5" />
              </Card>
            ))}
          </div>
        ) : wallets.length === 0 ? (
          <EmptyState
            eyebrow="No wallets yet"
            title="Create your first wallet"
            description="Start with your main cash, bank, or mobile money wallet. Once created, transactions and budgets can reference it across Gorilla Ledger."
            action={
              <Button type="button" onClick={() => setShowCreatePanel(true)}>
                Add Wallet
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {wallets.map((wallet) => {
              const isEditing = editingId === wallet.id;
              const isBusy = rowBusyId === wallet.id;
              const meta = WALLET_TYPE_META[wallet.type];
              const balance = walletBalances[wallet.id];
              const currentBalance = balance?.current_balance_minor ?? wallet.starting_balance_minor;

              return (
                <Card key={wallet.id} variant="premium" interactive className="p-5 sm:p-6">
                  {!isEditing ? (
                    <div className="flex h-full min-h-72 flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold text-white">{wallet.name}</h3>
                            <p className="text-xs text-white/45">{meta.description}</p>
                          </div>
                        </div>

                        <Badge>{meta.label}</Badge>
                      </div>

                      <div className="my-8">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/35">
                          Current Balance
                        </p>
                        <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
                          <span className="text-4xl font-semibold tracking-[-0.05em] text-white">
                            {formatMinorToAmount(currentBalance)}
                          </span>
                          <span className="pb-1 text-sm font-semibold uppercase tracking-[0.16em] text-white/65">
                            {wallet.currency_code}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto space-y-3">
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-white/45">Created</span>
                            <span className="text-white/75">{formatWalletDate(wallet.created_at)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-white/45">Opening balance</span>
                            <span className="font-medium text-white/75">{formatMinorToAmount(wallet.starting_balance_minor)} {wallet.currency_code}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-white/45">Last activity</span>
                            <span className="font-medium text-white/75">
                              {balance?.last_activity_at ? formatWalletDate(balance.last_activity_at) : "No activity"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => beginEdit(wallet.id)}
                            disabled={isBusy}
                          >
                            Manage
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteWallet(wallet.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Working..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Badge>Manage Asset</Badge>
                        <h3 className="mt-3 text-lg font-semibold text-white">Edit Wallet</h3>
                        <p className="mt-1 text-sm text-white/50">
                          Update the wallet profile and opening balance.
                        </p>
                      </div>

                      <Input
                        label="Wallet Name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />

                      <Select
                        label="Wallet Type"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as Wallet["type"])}
                      >
                        {WALLET_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>

                      <Input
                        label="Currency"
                        type="text"
                        value={editCurrencyCode}
                        onChange={(e) => setEditCurrencyCode(e.target.value.toUpperCase())}
                      />

                      <Input
                        label="Starting Balance"
                        type="text"
                        value={editStartingBalance}
                        onChange={(e) => setEditStartingBalance(e.target.value)}
                      />

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(wallet.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={isBusy}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
