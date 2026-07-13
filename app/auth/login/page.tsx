import { LoginForm } from "@/components/auth/LoginForm";

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
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <LoginForm next={next} />
    </div>
  );
}