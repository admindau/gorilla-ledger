"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// --- Supabase admin client (uses service role, no cookies needed) ---
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // you already use this for cron
  {
    auth: {
      persistSession: false,
    },
  }
);

// --- Validation schema for the recurring form ---
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
  // 1) Validate input
  const parsed = RecurringRuleSchema.safeParse({
    wallet_id: formData.get("wallet_id"),
    category_id: formData.get("category_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    console.error("Validation failed:", parsed.error.flatten());
    throw new Error("Invalid inputs");
  }

  const { wallet_id, category_id, amount, date, description } = parsed.data;

  // 2) Look up wallet to get user_id + currency_code
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from("wallets")
    .select("id, user_id, currency_code")
    .eq("id", wallet_id)
    .single();

  if (walletError || !wallet) {
    console.error("Wallet lookup failed:", walletError);
    throw new Error("Invalid wallet");
  }

  // 3) Compute schedule fields
  const firstRun = new Date(date);
  const dayOfMonth = firstRun.getUTCDate();

  // 4) Insert recurring rule
  const { error } = await supabaseAdmin.from("recurring_rules").insert({
    user_id: wallet.user_id,
    wallet_id: wallet_id,
    category_id,
    type: "expense",
    amount_minor: toMinor(amount),
    currency_code: wallet.currency_code,
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

  // 5) Refresh the /recurring page so the new rule appears
  revalidatePath("/recurring");
}
