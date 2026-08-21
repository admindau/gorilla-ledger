import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to accept this invitation." }, { status: 401 });
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  }
  const { error } = await supabase.rpc("accept_ledger_invitation", { p_token: body.token });
  const response = error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ message: "You’ve joined the household ledger." });
  applyPrivateNoStore(response.headers);
  return response;
}

