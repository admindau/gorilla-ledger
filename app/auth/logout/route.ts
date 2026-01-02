import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const res = NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));

  // Prevent caching of the redirect response.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}
