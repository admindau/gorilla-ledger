"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

export type ReceiptRow = {
  id: string;
  transaction_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type Props = {
  transactionId: string;
};

export default function ReceiptList({ transactionId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error } = await supabaseBrowserClient
      .from("receipts")
      .select("id, transaction_id, storage_path, original_name, mime_type, size_bytes, created_at")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ReceiptRow[]);
    setLoading(false);
  }

  async function openReceipt(path: string) {
    const res = await fetch("/api/receipts/sign-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, expires_in: 600 }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to open receipt.");
      return;
    }

    window.open(json.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteReceipt(id: string) {
    if (!confirm("Delete this receipt?")) return;

    setError("");
    const res = await fetch("/api/receipts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt_id: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to delete receipt.");
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleToggle() {
    const next = !opened;
    setOpened(next);
    if (next && rows.length === 0) await load();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleToggle}
        className="px-2 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 transition text-[11px]"
      >
        {opened ? "Hide receipts" : "Receipts"}
      </button>

      {opened && (
        <div className="mt-2 border border-gray-800 rounded bg-black/40 p-3">
          {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

          {loading ? (
            <div className="text-xs text-gray-400">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-gray-500">No receipts yet.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 text-xs border border-gray-800 rounded px-3 py-2 bg-gray-900/40"
                >
                  <div className="truncate">
                    <div className="text-gray-100">{r.original_name}</div>
                    <div className="text-[11px] text-gray-500">
                      {Math.ceil(r.size_bytes / 1024)} KB • {r.mime_type}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 transition text-[11px]"
                      onClick={() => openReceipt(r.storage_path)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-red-500 text-red-300 bg-gray-900 hover:bg-gray-900/70 transition text-[11px]"
                      onClick={() => deleteReceipt(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={load}
              className="px-3 py-2 rounded border border-gray-700 text-xs bg-gray-900 hover:bg-gray-800 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
