import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/http/sameOrigin";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });

  const res = NextResponse.redirect(
    new URL("/auth/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
  );

  // Prevent caching of the redirect response.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}
