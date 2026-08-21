import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { user_id?: unknown } | null;
  if (typeof body?.user_id !== "string") return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
  const { error } = await supabase.rpc("remove_ledger_member", { p_user_id: body.user_id });
  const response = error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ message: "Family member removed." });
  applyPrivateNoStore(response.headers);
  return response;
}

