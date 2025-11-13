"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Wallet = {
  id: string;
  name: string;
  currency_code: string;
  starting_balance_minor: number;
};

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
};

function formatMinorToAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function DashboardPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [email, setEmail] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function init() {
      setCheckingSession(true);
      setErrorMsg("");

      // 1) Check auth session
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setCheckingSession(false);

      // 2) Load wallets
      setLoadingData(true);

      const { data: walletData, error: walletError } =
        await supabaseBrowserClient
          .from("wallets")
          .select("id, name, currency_code, starting_balance_minor")
          .order("created_at", { ascending: true });

      if (walletError) {
        console.error(walletError);
        setErrorMsg(walletError.message);
        setLoadingData(false);
        return;
      }

      setWallets(walletData as Wallet[]);

      // 3) Load recent transactions (e.g. last 200)
      const { data: txData, error: txError } = await supabaseBrowserClient
        .from("transactions")
        .select(
          "id, wallet_id, type, amount_minor, currency_code, occurred_at"
        )
        .order("occurred_at", { ascending: false })
        .limit(200);

      if (txError) {
        console.error(txError);
        setErrorMsg(txError.message);
        setLoadingData(false);
        return;
      }

      setTransactions(txData as Transaction[]);
      setLoadingData(false);
    }

    init();
  }, [router]);

  async function handleLogout() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-400">Checking your session...</p>
      </div>
    );
  }

  // ----- Derived data -----

  // Per-wallet balance
  const walletBalances = wallets.map((w) => {
    const walletTxs = transactions.filter((tx) => tx.wallet_id === w.id);
    const delta = walletTxs.reduce((sum, tx) => {
      const sign = tx.type === "income" ? 1 : -1;
      return sum + sign * tx.amount_minor;
    }, 0);

    const balanceMinor = w.starting_balance_minor + delta;

    return {
      ...w,
      balanceMinor,
    };
  });

  // Totals per currency
  const totalsByCurrency: Record<string, number> = {};
  for (const wb of walletBalances) {
    if (!totalsByCurrency[wb.currency_code]) {
      totalsByCurrency[wb.currency_code] = 0;
    }
    totalsByCurrency[wb.currency_code] += wb.balanceMinor;
  }

  // Current month income/expense
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthIncomeMinor = 0;
  let monthExpenseMinor = 0;

  for (const tx of transactions) {
    const d = new Date(tx.occurred_at);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      if (tx.type === "income") {
        monthIncomeMinor += tx.amount_minor;
      } else if (tx.type === "expense") {
        monthExpenseMinor += tx.amount_minor;
      }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold text-lg">Gorilla Ledger™</div>
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <a href="/wallets" className="underline">
            Wallets
          </a>
          <a href="/categories" className="underline">
            Categories
          </a>
          <a href="/transactions" className="underline">
            Transactions
          </a>
          {email && <span className="hidden sm:inline">{email}</span>}
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded border border-gray-600 hover:bg-white hover:text-black transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-2">
          Overview
        </h1>
        <p className="text-gray-400 mb-4 text-sm">
          High-level snapshot of your wallets and activity. We&apos;ll evolve
          this into charts and deeper analytics as we go.
        </p>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              Wallets
            </div>
            <div className="text-2xl font-semibold">
              {wallets.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total number of wallets you&apos;re tracking.
            </div>
          </div>

          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              This Month – Income
            </div>
            <div className="text-lg font-semibold">
              {formatMinorToAmount(monthIncomeMinor)} (mixed currencies)
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total of all income transactions this month.
            </div>
          </div>

          <div className="border border-gray-800 rounded p-4">
            <div className="text-xs text-gray-400 uppercase mb-1">
              This Month – Expenses
            </div>
            <div className="text-lg font-semibold">
              {formatMinorToAmount(monthExpenseMinor)} (mixed currencies)
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total of all expense transactions this month.
            </div>
          </div>
        </section>

        {/* Totals per currency */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            Total Balance by Currency
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : Object.keys(totalsByCurrency).length === 0 ? (
            <p className="text-gray-500 text-sm">
              No wallets found yet. Create one to start tracking.
            </p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(totalsByCurrency).map(
                ([currency, minor]) => (
                  <div
                    key={currency}
                    className="border border-gray-800 rounded px-4 py-2"
                  >
                    <div className="text-xs text-gray-400 uppercase">
                      {currency}
                    </div>
                    <div className="text-lg font-semibold">
                      {formatMinorToAmount(minor)} {currency}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* Wallet list with balances */}
        <section>
          <h2 className="text-lg font-semibold mb-2">
            Wallet Balances
          </h2>
          {loadingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : walletBalances.length === 0 ? (
            <p className="text-gray-500 text-sm">
              You don&apos;t have any wallets yet. Create one from the
              Wallets page.
            </p>
          ) : (
            <div className="border border-gray-800 rounded divide-y divide-gray-800 text-sm">
              {walletBalances.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-gray-400">
                      {w.currency_code}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatMinorToAmount(w.balanceMinor)}{" "}
                    {w.currency_code}
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
