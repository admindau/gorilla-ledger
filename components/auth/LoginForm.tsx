"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { error } = await supabaseBrowserClient.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.push(next || "/dashboard");
  }

  function goToRegister() {
    router.push("/auth/register");
  }

  function goToResetPassword() {
    router.push("/auth/reset-password");
  }

  return (
    <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
      <h1 className="text-2xl font-semibold mb-1 text-center">
        Login to Gorilla Ledger™
      </h1>
      <p className="text-gray-400 text-xs mb-6 text-center">
        Enter your email and password to access your money command center.
      </p>

      {errorMsg && (
        <p className="mb-4 text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-950/30">
          {errorMsg}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div>
          <label className="block mb-1 text-xs text-gray-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-gray-400">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={goToResetPassword}
            className="text-gray-300 hover:text-white underline"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-white text-black py-2 rounded font-semibold text-sm hover:bg-gray-200 disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-400 text-center">
        No account yet?{" "}
        <button
          type="button"
          onClick={goToRegister}
          className="text-white underline"
        >
          Register
        </button>
      </div>
    </div>
  );
}
