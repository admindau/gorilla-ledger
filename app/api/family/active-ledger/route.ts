import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";
import { hasTrustedMutationOrigin } from "@/lib/http/sameOrigin";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { ledger_id?: unknown } | null;
  if (typeof body?.ledger_id !== "string") return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
  const { error } = await supabase.rpc("set_active_ledger", { p_ledger_id: body.ledger_id });
  if (error) console.error("[active-ledger] Unable to switch ledger.", { code: error.code });
  const response = error
    ? NextResponse.json({ error: "Unable to switch ledgers. Refresh and try again." }, { status: 400 })
    : NextResponse.json({ message: "Active ledger changed." });
  applyPrivateNoStore(response.headers);
  return response;
}
