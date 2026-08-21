import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicAuthShell } from "@/components/public/PublicAuthShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitePageProps = { searchParams?: Promise<{ token?: string | string[] }> };

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const tokenParam = (await searchParams)?.token;
  const token = typeof tokenParam === "string" && /^[a-f0-9]{64}$/.test(tokenParam) ? tokenParam : "";
  const destination = token ? `/settings/family?invite=${token}` : "/settings/family";
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(destination);

  return (
    <PublicAuthShell>
      <div className="flex w-full items-center justify-center px-4 text-white">
        <div className="gl-auth-card gl-card w-full max-w-md">
          <div className="gl-auth-card-heading">
            <p className="gl-auth-eyebrow">Family invitation</p>
            <h1>Join a household ledger</h1>
            <p>Use your own secure account to work together. Your login and security settings remain private.</p>
          </div>
          {!token ? <p className="gl-auth-alert gl-auth-alert-error">This invitation link is invalid.</p> : (
            <div className="grid gap-3">
              <Link className="gl-btn gl-btn-primary gl-btn-md w-full text-center" href={`/auth/login?next=${encodeURIComponent(destination)}`}>Sign in to accept</Link>
              <Link className="gl-btn gl-btn-secondary gl-btn-md w-full text-center" href={`/auth/register?next=${encodeURIComponent(destination)}`}>Create an account</Link>
              <p className="gl-auth-legal">Sign in with the same email address that received the invitation.</p>
            </div>
          )}
        </div>
      </div>
    </PublicAuthShell>
  );
}
