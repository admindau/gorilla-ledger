"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!session) {
        // No session → send to login
        router.replace("/auth/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setLoading(false);
    }

    checkSession();
  }, [router]);

  async function handleLogout() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-400">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Simple top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold">Gorilla Ledger™</div>
        <div className="flex items-center gap-4 text-sm text-gray-300">
          {email && <span>{email}</span>}
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded border border-gray-600 hover:bg-white hover:text-black transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-xl">
          <h1 className="text-3xl font-semibold">
            Welcome to Gorilla Ledger 🦍
          </h1>
          <p className="text-gray-400">
            You are logged in. This is the placeholder dashboard.
            We’ll turn this into your real money command center soon —
            with wallets, transactions, budgets, and analytics.
          </p>
        </div>
      </main>
    </div>
  );
}
