import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Basic server-side Supabase client.
// In future we’ll wire in auth cookies / RLS-aware headers.
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        // Placeholder for auth header if/when we add it:
        // "X-Client-Info": "gorilla-ledger-server",
      },
    },
  });
}
