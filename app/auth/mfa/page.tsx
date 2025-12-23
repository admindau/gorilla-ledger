import { Suspense } from "react";
import MfaClient from "./MfaClient";

export const dynamic = "force-dynamic";

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
          <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-black/60">
            <h1 className="text-2xl font-semibold mb-1 text-center">
              Two-factor verification
            </h1>
            <p className="text-gray-400 text-xs mb-6 text-center">
              Preparing verification…
            </p>
          </div>
        </div>
      }
    >
      <MfaClient />
    </Suspense>
  );
}
