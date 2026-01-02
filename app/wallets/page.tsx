"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Wallet = {
  id: string;
  name: string;
  type: "cash" | "bank" | "mobile" | "other";
  currency_code: string;
  starting_balance_minor: number;
  created_at: string;
};

const WALLET_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "mobile", label: "Mobile Money" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
] as const;

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

export default function WalletsPage() {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

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

  useEffect(() => {
    async function loadWallets() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view wallets.");
        setLoading(false);
        return;
      }

      // Ensure profile row exists for this user (keeps onboarding smooth)
      await supabaseBrowserClient.from("profiles").upsert(
        {
          id: user.id,
          full_name: user.email ?? null,
        },
        { onConflict: "id" }
      );

      const { data, error } = await supabaseBrowserClient
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setWallets(data as Wallet[]);
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

    const starting_balance_minor = parseAmountToMinor(startingBalance);

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
        name,
        type,
        currency_code: currencyCode,
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
    setSaving(false);
  }

  async function handleSaveEdit(id: string) {
    setRowBusyId(id);
    setErrorMsg("");

    const starting_balance_minor = parseAmountToMinor(editStartingBalance);

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowserClient.auth.getUser();

    if (userError || !user) {
      setErrorMsg("You must be logged in.");
      setRowBusyId(null);
      return;
    }

    const { data, error } = await supabaseBrowserClient
      .from("wallets")
      .update({
        name: editName,
        type: editType,
        currency_code: editCurrencyCode,
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Tight, premium header (less “link-bar”) */}
      <header className="w-full border-b border-gray-800 bg-black/60 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Gorilla Ledger™</div>
            <div className="text-[11px] text-gray-400 tracking-wide uppercase">
              Wallets
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/dashboard"
              className="px-3 py-1.5 rounded border border-gray-700 text-xs text-gray-200 hover:bg-white hover:text-black transition"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        {/* Tightened page heading rhythm */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
            Your Wallets
          </h1>
          <p className="text-sm text-gray-400">
            Create, edit, and manage wallet balances (starting balance + transactions).
          </p>
        </div>

        {errorMsg && <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>}

        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add a Wallet</h2>

          <form
            onSubmit={handleCreateWallet}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-1">
              <label className="block text-sm mb-1">Name</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                placeholder="e.g. Cash, Mobile Money, Bank"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={type}
                onChange={(e) => setType(e.target.value as Wallet["type"])}
              >
                {WALLET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Currency</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Starting Balance</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-white text-black font-semibold"
              >
                {saving ? "Saving..." : "Create Wallet"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Wallet List</h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Loading wallets...</p>
          ) : wallets.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You don’t have any wallets yet. Add one using the form above.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800">
              {wallets.map((wallet) => {
                const isEditing = editingId === wallet.id;
                const isBusy = rowBusyId === wallet.id;

                return (
                  <div key={wallet.id} className="px-4 py-3">
                    {!isEditing ? (
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-medium">{wallet.name}</div>
                          <div className="text-xs text-gray-400">
                            {wallet.type.toUpperCase()} • {wallet.currency_code} • Starting{" "}
                            {formatMinorToAmount(wallet.starting_balance_minor)}{" "}
                            {wallet.currency_code}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(wallet.id)}
                            className="px-3 py-1.5 rounded border border-gray-700 text-sm text-gray-200"
                            disabled={isBusy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWallet(wallet.id)}
                            className="px-3 py-1.5 rounded border border-red-900 text-sm text-red-300"
                            disabled={isBusy}
                          >
                            {isBusy ? "Working..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs mb-1 text-gray-400">
                            Name
                          </label>
                          <input
                            type="text"
                            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs mb-1 text-gray-400">
                            Type
                          </label>
                          <select
                            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                            value={editType}
                            onChange={(e) =>
                              setEditType(e.target.value as Wallet["type"])
                            }
                          >
                            {WALLET_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs mb-1 text-gray-400">
                            Currency
                          </label>
                          <input
                            type="text"
                            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                            value={editCurrencyCode}
                            onChange={(e) =>
                              setEditCurrencyCode(e.target.value.toUpperCase())
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs mb-1 text-gray-400">
                            Starting Balance
                          </label>
                          <input
                            type="text"
                            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                            value={editStartingBalance}
                            onChange={(e) => setEditStartingBalance(e.target.value)}
                          />
                        </div>

                        <div className="md:col-span-2 flex gap-2 md:justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(wallet.id)}
                            disabled={isBusy}
                            className="px-3 py-2 rounded bg-white text-black font-semibold"
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isBusy}
                            className="px-3 py-2 rounded border border-gray-700 text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
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
