"use client";

import { useEffect, useState } from "react";
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
];

function parseAmountToMinor(amount: string): number {
  // simple parser: "100.50" -> 10050
  const cleaned = amount.replace(",", "").trim();
  const [whole, fractional = ""] = cleaned.split(".");
  const fracPadded = (fractional + "00").slice(0, 2); // 2 decimal places
  const wholeNum = Number(whole) || 0;
  const fracNum = Number(fracPadded) || 0;
  return wholeNum * 100 + fracNum;
}

export default function WalletsPage() {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // form state
  const [name, setName] = useState("");
  const [type, setType] = useState<Wallet["type"]>("cash");
  const [currencyCode, setCurrencyCode] = useState("SSP");
  const [startingBalance, setStartingBalance] = useState("0");
  const [saving, setSaving] = useState(false);

  // 1. Ensure profile exists and load wallets
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

      // Ensure profile row exists for this user
      await supabaseBrowserClient.from("profiles").upsert(
        {
          id: user.id,
          full_name: user.email ?? null,
          // default_currency uses DB default if not provided
        },
        { onConflict: "id" }
      );

      // Load wallets
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

    // Add new wallet to state
    setWallets((prev) => [...prev, data as Wallet]);

    // Reset form
    setName("");
    setType("cash");
    setCurrencyCode("SSP");
    setStartingBalance("0");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar (simple) */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold">
          Gorilla Ledger™ – Wallets
        </div>
        <a
          href="/dashboard"
          className="text-sm text-gray-300 underline"
        >
          Back to Dashboard
        </a>
      </header>

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-4">Your Wallets</h1>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Create wallet form */}
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
              <label className="block text-sm mb-1">
                Starting Balance
              </label>
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

        {/* Wallets list */}
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
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <div className="font-medium">{wallet.name}</div>
                    <div className="text-xs text-gray-400">
                      {wallet.type.toUpperCase()} • {wallet.currency_code}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300">
                    Starting: {(wallet.starting_balance_minor / 100).toFixed(2)}{" "}
                    {wallet.currency_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
