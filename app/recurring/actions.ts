"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Form validation schema
const RecurringRuleSchema = z.object({
  wallet_id: z.string(),
  category_id: z.string(),
  amount: z.coerce.number(),
  date: z.string(),
  description: z.string().optional().nullable(),
});

function toMinor(amount: number) {
  return Math.round(amount * 100);
}

// Helper to create an authenticated Supabase client in a server action
function getSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: -1 });
        },
      },
    }
  );
}

export async function createRecurringRule(formData: FormData) {
  const supabase = getSupabaseServerClient();

  const parsed = RecurringRuleSchema.safeParse({
    wallet_id: formData.get("wallet_id"),
    category_id: formData.get("category_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    console.error("Validation failed:", parsed.error);
    throw new Error("Invalid inputs");
  }

  const { wallet_id, category_id, amount, date, description } = parsed.data;

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error:", userError);
    throw new Error("Not authenticated");
  }

  // Get wallet currency
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("currency_code")
    .eq("id", wallet_id)
    .single();

  if (walletError || !wallet) {
    console.error("Wallet lookup failed:", walletError);
    throw new Error("Invalid wallet");
  }

  const currency_code = wallet.currency_code;

  // Compute schedule fields
  const firstRun = new Date(date);
  const dayOfMonth = firstRun.getUTCDate();

  const { error } = await supabase.from("recurring_rules").insert({
    // id uses DB default gen_random_uuid()
    user_id: user.id,
    wallet_id,
    category_id,
    type: "expense",
    amount_minor: toMinor(amount),
    currency_code,
    frequency: "monthly",
    interval: 1,
    day_of_month: dayOfMonth,
    start_date: date,
    next_run_at: date,
    description: description || null,
    is_active: true,
  });

  if (error) {
    console.error("Recurring insert failed:", error);
    throw new Error("Insert failed");
  }

  // Refresh the /recurring UI
  revalidatePath("/recurring");
}
