import { PublicAuthShell } from "@/components/public/PublicAuthShell";
import { sanitizeAppDestination } from "@/lib/auth/navigation";
import { RegisterForm } from "./RegisterForm";

type RegisterPageProps = { searchParams?: Promise<{ next?: string | string[] }> };

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const nextParam = (await searchParams)?.next;
  const next = sanitizeAppDestination(typeof nextParam === "string" ? nextParam : undefined);
  return <PublicAuthShell><div className="flex w-full items-center justify-center px-4 text-white"><RegisterForm next={next} /></div></PublicAuthShell>;
}
