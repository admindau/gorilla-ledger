"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    // Always send confirmation links back to our PKCE confirmation route.
    // This must be allowed in Supabase Auth "Redirect URLs".
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const emailRedirectTo = `${origin}/auth/confirm`;

    const { error } = await supabaseBrowserClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    // ✅ Fire-and-forget welcome email (don’t block the UX)
    fetch("/auth/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch((err) => {
      console.error("send-welcome failed", err);
    });

    setLoading(false);

    // Better UX: tell the user to confirm their email.
    setSuccessMsg("Account created. Please check your email to confirm your account.");

    // Optionally still redirect them to login after a short moment.
    // If you prefer immediate redirect, keep router.push("/auth/login") only.
    setTimeout(() => {
      router.push("/auth/login");
    }, 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md p-6 border border-gray-700 rounded">
        <h1 className="text-2xl mb-4 font-semibold">Create an Account</h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            className="w-full p-3 rounded bg-gray-900 border border-gray-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded bg-gray-900 border border-gray-700"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
          {successMsg && <p className="text-green-400 text-sm">{successMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 rounded bg-white text-black font-semibold"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <a href="/auth/login" className="underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
