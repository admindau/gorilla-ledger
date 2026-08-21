import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateNoStore } from "@/lib/http/privateCache";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabase.rpc("get_family_access_overview");
  const response = error || !data
    ? NextResponse.json({ error: error?.message ?? "Unable to load family access." }, { status: 500 })
    : NextResponse.json(data);
  applyPrivateNoStore(response.headers);
  return response;
}

