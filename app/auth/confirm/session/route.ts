import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isEmailOtpType } from "@/lib/auth/confirmation";
import { hasTrustedMutationOrigin } from "@/lib/http/sameOrigin";

function json(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(req: NextRequest) {
  if (!hasTrustedMutationOrigin(req)) return json({ error: "untrusted_origin" }, 403);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "missing_env" }, 500);
  }

  const body = await req.json().catch(() => null);
  const access_token = body?.access_token;
  const refresh_token = body?.refresh_token;
  const token_hash = body?.token_hash;
  const type = body?.type;
  const email = body?.email;
  const token = body?.token;

  const hasLegacySession = Boolean(access_token && refresh_token);
  const hasTokenHash =
    typeof token_hash === "string" &&
    token_hash.length > 0 &&
    isEmailOtpType(type);
  const hasEmailOtp =
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    typeof token === "string" &&
    /^\d{6,8}$/.test(token) &&
    isEmailOtpType(type);

  if (!hasLegacySession && !hasTokenHash && !hasEmailOtp) {
    return json({ error: "missing_tokens" }, 400);
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true }, { status: 200 });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = hasTokenHash
    ? await supabase.auth.verifyOtp({ token_hash, type })
    : hasEmailOtp
      ? await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type })
      : await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return json({ error: error.message }, 401);
  }

  // Defense-in-depth: ensure cookies are scoped correctly (origin-based).
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}
