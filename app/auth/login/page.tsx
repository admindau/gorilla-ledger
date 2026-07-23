import { LoginForm } from "@/components/auth/LoginForm";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";
import { sanitizeAppDestination } from "@/lib/auth/navigation";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const resolvedSearchParams = searchParams
    ? await searchParams
    : undefined;

  const nextParam = resolvedSearchParams?.next;
  const errorParam = resolvedSearchParams?.error;

  const next = sanitizeAppDestination(
    typeof nextParam === "string" ? nextParam : undefined
  );

  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
        <LoginForm
          next={next}
          initialError={
            typeof errorParam === "string"
              ? "That sign-in link is invalid or has expired. Request a new one below."
              : ""
          }
        />
      </div>
    </PublicAuthShell>
  );
}
