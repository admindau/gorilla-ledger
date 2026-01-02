import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const url = new URL("/auth/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
