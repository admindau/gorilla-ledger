"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type CategoryType = "income" | "expense";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
};

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // form state
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowserClient.auth.getUser();

      if (userError || !user) {
        setErrorMsg("You must be logged in to view categories.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabaseBrowserClient
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setCategories(data as Category[]);
      setLoading(false);
    }

    loadCategories();
  }, []);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

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
      .from("categories")
      .insert({
        user_id: user.id,
        name,
        type,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setCategories((prev) => [...prev, data as Category]);
    setName("");
    setType("expense");
    setSaving(false);
  }

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="font-semibold">Gorilla Ledger™ – Categories</div>
        <div className="flex gap-4 text-sm">
          <a href="/wallets" className="underline text-gray-300">
            Wallets
          </a>
          <a href="/dashboard" className="underline text-gray-300">
            Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-4">Your Categories</h1>

        {errorMsg && (
          <p className="mb-4 text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Create category form */}
        <section className="mb-8 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Add a Category</h2>

          <form
            onSubmit={handleCreateCategory}
            className="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                placeholder="e.g. Salary, Rent, Food, Transport"
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
                onChange={(e) => setType(e.target.value as CategoryType)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-white text-black font-semibold"
              >
                {saving ? "Saving..." : "Create Category"}
              </button>
            </div>
          </form>
        </section>

        {/* Categories lists */}
        <section className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Income</h2>
            {loading ? (
              <p className="text-gray-400 text-sm">Loading categories...</p>
            ) : incomeCategories.length === 0 ? (
              <p className="text-gray-500 text-sm">
                You don&apos;t have any income categories yet.
              </p>
            ) : (
              <ul className="border border-gray-800 rounded divide-y divide-gray-800">
                {incomeCategories.map((cat) => (
                  <li key={cat.id} className="px-4 py-2 text-sm">
                    {cat.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Expenses</h2>
            {loading ? (
              <p className="text-gray-400 text-sm">Loading categories...</p>
            ) : expenseCategories.length === 0 ? (
              <p className="text-gray-500 text-sm">
                You don&apos;t have any expense categories yet.
              </p>
            ) : (
              <ul className="border border-gray-800 rounded divide-y divide-gray-800">
                {expenseCategories.map((cat) => (
                  <li key={cat.id} className="px-4 py-2 text-sm">
                    {cat.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
