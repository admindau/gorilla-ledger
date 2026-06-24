import { Suspense } from "react";
import MfaClient from "./MfaClient";

export const dynamic = "force-dynamic";

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
          <div className="gl-card w-full max-w-md p-6">
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
