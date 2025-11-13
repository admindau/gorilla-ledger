"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid(),
  amount: z.number().positive(),
  first_run_date: z.string(),
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

  const supabase = supabaseServer();

  const { error } = await supabase.from("recurring_rules").insert({
    wallet_id: data.wallet_id,
    category_id: data.category_id,
    amount_minor: Math.round(data.amount * 100),
    currency_code: "USD",
    frequency: "monthly",
    interval: 1,
    day_of_month: Number(data.first_run_date.split("-")[2]),
    start_date: data.first_run_date,
    description: data.description,
    is_active: true,
  });

  if (error) {
    console.error(error);
    return { error: "Failed to create rule" };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function pauseRule(id: string) {
  const supabase = supabaseServer();
  await supabase.from("recurring_rules").update({ is_active: false }).eq("id", id);
  revalidatePath("/recurring");
}

export async function activateRule(id: string) {
  const supabase = supabaseServer();
  await supabase.from("recurring_rules").update({ is_active: true }).eq("id", id);
  revalidatePath("/recurring");
}

export async function deleteRule(id: string) {
  const supabase = supabaseServer();
  await supabase.from("recurring_rules").delete().eq("id", id);
  revalidatePath("/recurring");
}
