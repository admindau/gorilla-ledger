import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";
import { hasTrustedMutationOrigin } from "@/lib/http/sameOrigin";

export async function DELETE(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { user_id?: unknown } | null;
  if (typeof body?.user_id !== "string") return NextResponse.json({ error: "Member ID is required." }, { status: 400 });
  const { error } = await supabase.rpc("remove_ledger_member", { p_user_id: body.user_id });
  if (error) console.error("[family-members] Unable to remove member.", { code: error.code });
  const response = error
    ? NextResponse.json({ error: "Unable to remove this family member. Try again." }, { status: 400 })
    : NextResponse.json({ message: "Family member removed." });
  applyPrivateNoStore(response.headers);
  return response;
}
