import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center space-y-6">
        
        {/* Logo */}
        <Image
          src="/logos/savvy-gorilla-logo.png"
          alt="Savvy Gorilla Technologies"
          width={250}
          height={250}
          className="object-contain"
        />

        {/* Title */}
        <h1 className="text-4xl font-semibold text-center">
          Gorilla Ledger™
        </h1>

        {/* Description */}
        <p className="text-gray-400 text-center max-w-xl">
          A clean, focused ledger to track your finances across wallets, currencies,
          and time. Built by Savvy Gorilla Technologies — for clarity, not confusion.
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <a
            href="/auth/register"
            className="gl-btn gl-btn-primary gl-btn-md"
          >
            Get Started
          </a>

          <a
            href="/auth/login"
            className="gl-btn gl-btn-secondary gl-btn-md"
          >
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
