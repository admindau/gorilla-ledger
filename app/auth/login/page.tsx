import { LoginForm } from "@/components/auth/LoginForm";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const resolvedSearchParams = searchParams
    ? await searchParams
    : undefined;

  const nextParam = resolvedSearchParams?.next;

  const next =
    typeof nextParam === "string" && nextParam.length > 0
      ? nextParam
      : "/dashboard";

  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
        <LoginForm next={next} />
      </div>
    </PublicAuthShell>
  );
}
