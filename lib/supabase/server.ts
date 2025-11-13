// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Later we'll use cookies for auth, but for now this is a basic server client.
export function createServerSupabaseClient() {
  // In future we’ll wire auth cookies; for now we just return a simple client.
  // This is still using the anon key (safe on server).
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        // This is a placeholder; we’ll adjust when we add auth cookies.
      },
    },
  });
}
