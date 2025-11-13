"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Validation schema for the form
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

export async function createRecurringRule(formData: FormData) {
  const supabase = supabaseServerClient();

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
    // id will use DB default gen_random_uuid()
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

  // Refresh the /recurring page data
  revalidatePath("/recurring");
}
