import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { ledger_id?: unknown } | null;
  if (typeof body?.ledger_id !== "string") return NextResponse.json({ error: "Ledger ID is required." }, { status: 400 });
  const { error } = await supabase.rpc("set_active_ledger", { p_ledger_id: body.ledger_id });
  const response = error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ message: "Active ledger changed." });
  applyPrivateNoStore(response.headers);
  return response;
}
