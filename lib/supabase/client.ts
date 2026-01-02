"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * NOTE:
 * We intentionally avoid importing a typed `Database` here so builds don't fail
 * if '@/types/supabase' isn't present or path aliases change.
 * If you have Database types, you can re-add generics later.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // This throws early in dev if env vars are missing.
  // In prod, Vercel will have them if configured properly.
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * Singleton browser client.
 * - Works across client components
 * - Prevents re-instantiation issues
 */
export const supabaseBrowserClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Compatibility export for code that expects a factory function.
 * Your SessionGuard imports this.
 */
export function createBrowserSupabaseClient() {
  return supabaseBrowserClient;
}
