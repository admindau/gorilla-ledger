import { createServerSupabaseClient } from "./server";

export async function getSession() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}
