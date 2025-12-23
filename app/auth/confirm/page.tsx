import { Suspense } from "react";
import ConfirmClient from "./ConfirmClient";

export const dynamic = "force-dynamic";

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-black text-white px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6">
            <h1 className="text-xl font-semibold">Confirming…</h1>
            <p className="mt-2 text-sm text-white/70">Preparing confirmation…</p>
          </div>
        </main>
      }
    >
      <ConfirmClient />
    </Suspense>
  );
}
