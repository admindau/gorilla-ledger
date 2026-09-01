// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

// Server-side client using the service role (bypasses RLS).
function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

let adminClient: ReturnType<typeof createAdminClient> | undefined;

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  adminClient ??= createAdminClient(supabaseUrl, serviceRoleKey);

  return adminClient;
}
