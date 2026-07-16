import Link from "next/link";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";
import { sanitizeAppDestination } from "@/lib/auth/navigation";

type AuthUnavailablePageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function AuthUnavailablePage({
  searchParams,
}: AuthUnavailablePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const nextParam = typeof params?.next === "string" ? params.next : undefined;
  const next = sanitizeAppDestination(nextParam);

  return (
    <PublicAuthShell>
      <section className="gl-card w-full max-w-md p-6 text-center text-white" aria-labelledby="auth-unavailable-title">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Account security
        </p>
        <h1 id="auth-unavailable-title" className="mt-2 text-2xl font-semibold">
          We could not verify your session
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">
          Your account has not been signed out. Please try again once the security check is available.
        </p>
        <Link href={next} className="gl-btn gl-btn-primary gl-btn-md mt-6 w-full">
          Try again
        </Link>
        <Link href="/contact" className="mt-4 inline-block text-xs text-gray-400 underline underline-offset-4 hover:text-white">
          Contact support
        </Link>
      </section>
    </PublicAuthShell>
  );
}
