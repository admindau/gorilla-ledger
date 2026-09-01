import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabase.rpc("get_family_access_overview");
  let body: unknown = data;
  if (!error && data && typeof data === "object" && "ledger" in data) {
    const overview = data as { ledger?: { id?: string } } & Record<string, unknown>;
    if (overview.ledger?.id) {
      const { data: activity } = await supabase
        .from("ledger_activity_events")
        .select("id, actor_user_id, event_type, entity_type, occurred_at")
        .eq("ledger_id", overview.ledger.id)
        .order("occurred_at", { ascending: false })
        .limit(25);
      body = { ...overview, activity: activity ?? [] };
    }
  }
  const response = error || !data
    ? NextResponse.json({ error: error?.message ?? "Unable to load family access." }, { status: 500 })
    : NextResponse.json(body);
  applyPrivateNoStore(response.headers);
  return response;
}
