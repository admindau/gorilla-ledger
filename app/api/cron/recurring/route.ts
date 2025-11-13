// app/api/cron/recurring/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type Frequency = "daily" | "weekly" | "monthly";

function addInterval(
  date: Date,
  frequency: Frequency,
  interval: number
): Date {
  const d = new Date(date);

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * interval);
      break;
    case "monthly":
      // naive but good enough: month + interval, keep day if possible
      const targetMonth = d.getMonth() + interval;
      d.setMonth(targetMonth);
      break;
  }

  return d;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Fetch due recurring rules
  const { data: rules, error: rulesError } = await supabaseAdminClient
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString())
    .or("end_date.is.null, end_date.gte." + now.toISOString().slice(0, 10)); // end_date null OR >= today

  if (rulesError) {
    console.error("Error loading recurring rules:", rulesError);
    return NextResponse.json(
      { error: "Failed to load rules" },
      { status: 500 }
    );
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({ processed: 0, created: 0 });
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const rule of rules) {
    const occurrenceDate = new Date(rule.next_run_at);

    // 2. Insert the matching transaction
    const { error: insertError } = await supabaseAdminClient
      .from("transactions")
      .insert({
        user_id: rule.user_id,
        wallet_id: rule.wallet_id,
        category_id: rule.category_id,
        type: rule.type,
        amount_minor: rule.amount_minor,
        currency_code: rule.currency_code,
        occurred_at: occurrenceDate.toISOString(),
        description:
          rule.description ??
          `Recurring ${rule.type === "income" ? "income" : "expense"}`,
      });

    if (insertError) {
      console.error("Error inserting transaction for rule", rule.id, insertError);
      continue;
    }

    createdCount += 1;

    // 3. Advance next_run_at
    const nextRun = addInterval(
      occurrenceDate,
      rule.frequency as Frequency,
      rule.interval || 1
    );

    const { error: updateError } = await supabaseAdminClient
      .from("recurring_rules")
      .update({ next_run_at: nextRun.toISOString() })
      .eq("id", rule.id);

    if (updateError) {
      console.error("Error updating next_run_at for rule", rule.id, updateError);
      continue;
    }

    updatedCount += 1;
  }

  return NextResponse.json({
    processed: rules.length,
    created: createdCount,
    updated: updatedCount,
  });
}

// Optional: allow GET for quick manual testing in browser if you want.
export async function GET(req: NextRequest) {
  return POST(req);
}
