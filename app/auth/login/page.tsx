"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("savvyrilla@gmail.com"); // prefilled for now
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabaseBrowserClient.auth.signInWithPassword({
        email,
        password,
      });

      console.log("login result:", { data, error });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setInfoMsg("Login successful, redirecting to dashboard...");
      setLoading(false);

      router.push("/dashboard");
    } catch (err: any) {
      console.error("login exception:", err);
      setErrorMsg(err?.message || "Unexpected error during login");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md p-6 border border-gray-700 rounded">
        <h1 className="text-2xl mb-4 font-semibold">Login</h1>

        <form onSubmit={handleLogin} className="space-y-4">
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

          {errorMsg && (
            <p className="text-red-400 text-sm">{errorMsg}</p>
          )}

          {infoMsg && (
            <p className="text-green-400 text-sm">{infoMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 rounded bg-white text-black font-semibold"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400">
          No account yet?{" "}
          <a href="/auth/register" className="underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
