"use client";

import { useMemo } from "react";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export type ReceiptFileIssue = { name: string; reason: string };

export function validateReceiptFiles(files: File[]): {
  ok: File[];
  rejected: ReceiptFileIssue[];
} {
  const ok: File[] = [];
  const rejected: ReceiptFileIssue[] = [];

  for (const f of files) {
    if (f.size <= 0) {
      rejected.push({ name: f.name, reason: "Empty file." });
      continue;
    }
    if (f.size > MAX_BYTES) {
      rejected.push({ name: f.name, reason: "File exceeds 5 MB." });
      continue;
    }
    if (!ALLOWED_MIME.has(f.type)) {
      rejected.push({
        name: f.name,
        reason: `Unsupported type (${f.type || "unknown"}).`,
      });
      continue;
    }
    ok.push(f);
  }

  return { ok, rejected };
}

type Props = {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemoveAt: (idx: number) => void;
  disabled?: boolean;
  label?: string;
};

export default function ReceiptUploader({
  files,
  onAdd,
  onRemoveAt,
  disabled,
  label = "Add receipts (PDF or images, max 5 MB each)",
}: Props) {
  const countLabel = useMemo(
    () => (files.length === 0 ? "No files selected" : `${files.length} file(s)`),
    [files.length]
  );

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length === 0) return;
    onAdd(list);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length === 0) return;
    onAdd(list);
  }

  return (
    <div className="md:col-span-3">
      <label className="block text-sm mb-1">{label}</label>

      <div
        className={`border border-gray-700 rounded p-3 bg-gray-900/40 ${
          disabled ? "opacity-60" : "hover:bg-gray-900/60"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-300">{countLabel}</div>

          <label className="px-3 py-2 rounded bg-white text-black text-xs font-semibold hover:bg-gray-200 transition cursor-pointer">
            Upload files
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handlePick}
              disabled={disabled}
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, idx) => (
              <div
                key={`${f.name}-${f.size}-${idx}`}
                className="flex items-center justify-between gap-3 text-xs border border-gray-800 rounded px-3 py-2 bg-black/40"
              >
                <div className="truncate">
                  <span className="text-gray-100">{f.name}</span>{" "}
                  <span className="text-gray-500">({Math.ceil(f.size / 1024)} KB)</span>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 transition"
                  onClick={() => onRemoveAt(idx)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 text-[11px] text-gray-500">
          Tip: you can drag & drop files here.
        </div>
      </div>
    </div>
  );
}
