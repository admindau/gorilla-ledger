import { LoginForm } from "@/components/auth/LoginForm";

type LoginPageProps = {
  searchParams?: {
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextParam = searchParams?.next;

  const next =
    typeof nextParam === "string" && nextParam.length > 0
      ? nextParam
      : "/dashboard";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <LoginForm next={next} />
    </div>
  );
}
