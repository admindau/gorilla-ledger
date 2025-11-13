export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-semibold">
          Gorilla Ledger™
        </h1>
        <p className="text-gray-400">
          A clean, focused ledger to track your money across wallets, currencies,
          and time. Built for clarity, not confusion.
        </p>

        <div className="flex items-center justify-center gap-4">
          <a
            href="/auth/register"
            className="px-4 py-2 rounded bg-white text-black font-semibold"
          >
            Get Started
          </a>
          <a
            href="/auth/login"
            className="px-4 py-2 rounded border border-gray-600"
          >
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
