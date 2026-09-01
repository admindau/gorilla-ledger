"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * NOTE:
 * We intentionally avoid importing a typed `Database` here so builds don't fail
 * if '@/types/supabase' isn't present or path aliases change.
 * If you have Database types, you can re-add generics later.
 */

function getBrowserConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) return { supabaseUrl, supabaseAnonKey };

  if (typeof window === "undefined") {
    return {
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseAnonKey: "build-time-placeholder",
    };
  }

  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const { supabaseUrl, supabaseAnonKey } = getBrowserConfig();

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
