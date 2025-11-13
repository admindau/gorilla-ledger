"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Create a new recurring rule
export async function createRecurringRule(formData: FormData) {
  const walletId = formData.get("walletId")?.toString() || "";
  const categoryComposite = formData.get("categoryId")?.toString() || "";
  const amountStr = formData.get("amount")?.toString() || "";
  const firstRunDate = formData.get("firstRunDate")?.toString() || "";
  const description = formData.get("description")?.toString() || "";

  if (!walletId || !categoryComposite || !amountStr || !firstRunDate) {
    return { success: false, error: "Missing required fields." };
  }

  const amountNumber = Number(amountStr);
  if (!Number.isFinite(amountNumber)) {
    return { success: false, error: "Invalid amount." };
  }

  const amountMinor = Math.round(amountNumber * 100);

  // We encode category info as: id|type|currency (e.g. "uuid|expense|USD")
  const [categoryIdRaw, typeRaw, currencyRaw] = categoryComposite.split("|");

  const categoryId = categoryIdRaw || null;
  const type = typeRaw === "income" ? "income" : "expense";
  const currencyCode = currencyRaw || "USD";

  const firstDate = new Date(firstRunDate);
  if (Number.isNaN(firstDate.getTime())) {
    return { success: false, error: "Invalid first run date." };
  }

  const dayOfMonth = firstDate.getUTCDate();

  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("recurring_rules").insert({
    wallet_id: walletId,
    category_id: categoryId,
    type,
    amount_minor: amountMinor,
    currency_code: currencyCode,
    frequency: "monthly",
    interval: 1,
    day_of_month: dayOfMonth,
    start_date: firstRunDate,
    next_run_at: firstRunDate,
    description,
    is_active: true,
  });

  if (error) {
    console.error("Failed to create recurring rule", error);
    return { success: false, error: "Database error while creating rule." };
  }

  await revalidatePath("/recurring");
  return { success: true };
}

// Pause a rule
export async function pauseRecurringRule(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return { success: false, error: "Missing rule id." };

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("recurring_rules")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Failed to pause recurring rule", error);
    return { success: false, error: "Database error while pausing rule." };
  }

  await revalidatePath("/recurring");
  return { success: true };
}

// Activate a rule
export async function activateRecurringRule(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return { success: false, error: "Missing rule id." };

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("recurring_rules")
    .update({ is_active: true })
    .eq("id", id);

  if (error) {
    console.error("Failed to activate recurring rule", error);
    return { success: false, error: "Database error while activating rule." };
  }

  await revalidatePath("/recurring");
  return { success: true };
}

// Delete a rule
export async function deleteRecurringRule(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return { success: false, error: "Missing rule id." };

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("recurring_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete recurring rule", error);
    return { success: false, error: "Database error while deleting rule." };
  }

  await revalidatePath("/recurring");
  return { success: true };
}
