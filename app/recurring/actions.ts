"use server";

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { v4 as uuid } from "uuid";

// Validation schema
const RecurringRuleSchema = z.object({
  wallet_id: z.string(),
  category_id: z.string(),
  amount: z.coerce.number(),
  date: z.string(),
  description: z.string().optional().nullable(),
});

// Convert amount → amount_minor
function toMinor(amount: number) {
  return Math.round(amount * 100);
}

export async function createRecurringRule(formData: FormData) {
  const supabase = createServerActionClient();

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

  // Get user ID
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Fetch wallet to get its currency
  const { data: wallet } = await supabase
    .from("wallets")
    .select("currency_code")
    .eq("id", wallet_id)
    .single();

  if (!wallet) throw new Error("Invalid wallet");

  const currency_code = wallet.currency_code;

  // Compute first run date
  const firstRun = new Date(date);
  const dayOfMonth = firstRun.getUTCDate();

  // Insert recurring rule
  const { error } = await supabase.from("recurring_rules").insert({
    id: uuid(),
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

  revalidatePath("/recurring");
}
