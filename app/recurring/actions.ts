"use server";

import * as serverClient from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Reuse the existing Supabase server helper from lib/supabase/server
// (whatever its real exported name is – we just grab the first function).
function getSupabaseServer(): any {
  const mod: any = serverClient;

  for (const key of Object.keys(mod)) {
    const value = mod[key];
    if (typeof value === "function") {
      return value(); // call the existing helper (same one used by wallets/budgets/etc.)
    }
  }

  throw new Error(
    "No Supabase server helper export found in lib/supabase/server.ts"
  );
}

const schema = z.object({
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid(),
  amount: z.number().positive(),
  first_run_date: z.string(), // YYYY-MM-DD
  description: z.string().optional(),
});

export async function createRecurringRule(formData: FormData) {
  const parsed = schema.safeParse({
    wallet_id: formData.get("wallet_id"),
    category_id: formData.get("category_id"),
    amount: Number(formData.get("amount")),
    first_run_date: formData.get("first_run_date"),
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    console.error(parsed.error);
    return { error: "Invalid input" };
  }

  const data = parsed.data;

  const supabase = getSupabaseServer();

  const dayOfMonth = Number(data.first_run_date.split("-")[2]);

  const { error } = await supabase.from("recurring_rules").insert({
    wallet_id: data.wallet_id,
    category_id: data.category_id,
    amount_minor: Math.round(data.amount * 100),
    currency_code: "USD", // you can change this later to match wallet currency
    frequency: "monthly",
    interval: 1,
    day_of_month: dayOfMonth,
    start_date: data.first_run_date,
    description: data.description,
    is_active: true,
  });

  if (error) {
    console.error("createRecurringRule error", error);
    return { error: "Failed to create rule" };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function pauseRule(id: string) {
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("recurring_rules")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("pauseRule error", error);
    return { error: "Failed to pause rule" };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function activateRule(id: string) {
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("recurring_rules")
    .update({ is_active: true })
    .eq("id", id);

  if (error) {
    console.error("activateRule error", error);
    return { error: "Failed to activate rule" };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function deleteRule(id: string) {
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("recurring_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteRule error", error);
    return { error: "Failed to delete rule" };
  }

  revalidatePath("/recurring");
  return { success: true };
}
