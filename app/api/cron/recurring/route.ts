// app/api/cron/recurring/route.ts

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { advanceRecurringDate } from "@/lib/recurring/forecast";
import { isMissingLedgerMetadata } from "@/lib/supabase/schemaCompatibility";

/**
 * Match your recurring_rules schema.
 */
type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  amount_minor: number;
  currency_code: string;
  type: string;
  description: string | null;

  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number | null;
  day_of_month: number | null;
  day_of_week: number | null;

  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD

  next_run_at: string; // timestamptz
  is_active: boolean;
  last_run_at: string | null;
  total_runs: number;

  created_at: string;
  updated_at: string;
};

type Frequency = RecurringRule["frequency"];
type RunLogStatus = "success" | "failed" | "skipped";

export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getCronSecretFromHeaders(req: NextRequest): string | null {
  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("X-CRON-SECRET") ||
    req.headers.get("authorization") ||
    req.headers.get("Authorization");

  if (!h) return null;
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return h.trim();
}

function isAuthorizedCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = getCronSecretFromHeaders(req);
  if (!provided) return false;
  return constantTimeEquals(provided, expected);
}

function advanceNextRunAt(
  currentIso: string,
  frequency: Frequency,
  interval: number | null,
  dayOfMonth: number | null
): string {
  return advanceRecurringDate(
    new Date(currentIso),
    frequency,
    interval,
    dayOfMonth
  ).toISOString();
}

async function writeRunLog(input: {
  ruleId: string;
  userId: string;
  transactionId?: string | null;
  status: RunLogStatus;
  details?: string | null;
}) {
  const { error } = await supabaseAdminClient.from("recurring_run_logs").insert({
    rule_id: input.ruleId,
    user_id: input.userId,
    transaction_id: input.transactionId ?? null,
    status: input.status,
    details: input.details ?? null,
  });

  if (error) {
    // Logging must never break the cron worker itself.
    console.error(
      `[cron/recurring] Failed to write run log for rule ${input.ruleId}:`,
      error
    );
  }
}

async function handler(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseAdminClient;

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10);

  const { data: rules, error: rulesError } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true });

  if (rulesError) {
    console.error("[cron/recurring] Failed to load rules:", rulesError);
    return NextResponse.json(
      { error: "Failed to load recurring rules" },
      { status: 500 }
    );
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json(
      {
        date: todayStr,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: "No recurring rules due at this time",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const rule of rules as RecurringRule[]) {
    processedCount += 1;

    if (rule.start_date && todayStr < rule.start_date) {
      skippedCount += 1;
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "skipped",
        details: `Rule skipped because start date ${rule.start_date} is in the future.`,
      });
      continue;
    }

    if (rule.end_date && todayStr > rule.end_date) {
      skippedCount += 1;
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "skipped",
        details: `Rule skipped because end date ${rule.end_date} has passed.`,
      });
      continue;
    }

    let currentRunAt = new Date(rule.next_run_at).toISOString();
    let lastProcessedRunAt: string | null = null;
    let runsHandledForRule = 0;
    let ruleHadFailure = false;

    // Safety guard: backfill enough missed periods for real outages while avoiding
    // runaway loops if a rule has bad scheduling data.
    const maxBackfillRunsPerRule = 60;

    while (new Date(currentRunAt).getTime() <= now.getTime()) {
      if (runsHandledForRule >= maxBackfillRunsPerRule) {
        failedCount += 1;
        ruleHadFailure = true;
        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          status: "failed",
          details: `Backfill stopped after ${maxBackfillRunsPerRule} runs to prevent an unsafe cron loop. Current scheduled run: ${currentRunAt}.`,
        });
        break;
      }

      const dueAtIso = new Date(currentRunAt).toISOString();
      const dueDateStr = dueAtIso.slice(0, 10);

      if (rule.start_date && dueDateStr < rule.start_date) {
        skippedCount += 1;
        runsHandledForRule += 1;
        lastProcessedRunAt = dueAtIso;

        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          status: "skipped",
          details: `Scheduled run ${dueAtIso} skipped because it is before start date ${rule.start_date}.`,
        });

        currentRunAt = advanceNextRunAt(
          currentRunAt,
          rule.frequency,
          rule.interval,
          rule.day_of_month
        );
        continue;
      }

      if (rule.end_date && dueDateStr > rule.end_date) {
        skippedCount += 1;
        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          status: "skipped",
          details: `Backfill stopped at ${dueAtIso} because end date ${rule.end_date} has passed.`,
        });
        break;
      }

      const enhancedExistingResult = await supabase
        .from("transactions")
        .select("id")
        .eq("recurring_rule_id", rule.id)
        .eq("scheduled_for", dueAtIso)
        .maybeSingle();

      let metadataAvailable = !isMissingLedgerMetadata(enhancedExistingResult.error);
      let existingTx = enhancedExistingResult.data;
      let exErr = enhancedExistingResult.error;

      if (!metadataAvailable) {
        let legacyQuery = supabase
          .from("transactions")
          .select("id")
          .eq("user_id", rule.user_id)
          .eq("wallet_id", rule.wallet_id)
          .eq("amount_minor", rule.amount_minor)
          .eq("currency_code", rule.currency_code)
          .eq("type", rule.type)
          .eq("occurred_at", dueAtIso);
        legacyQuery = rule.category_id
          ? legacyQuery.eq("category_id", rule.category_id)
          : legacyQuery.is("category_id", null);
        const legacyExistingResult = await legacyQuery.maybeSingle();
        existingTx = legacyExistingResult.data;
        exErr = legacyExistingResult.error;
      }

      if (exErr) {
        failedCount += 1;
        ruleHadFailure = true;
        console.error(
          `[cron/recurring] Idempotency check failed for rule ${rule.id} at ${dueAtIso}:`,
          exErr
        );
        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          status: "failed",
          details: `Idempotency check failed for scheduled run ${dueAtIso}: ${exErr.message}`,
        });
        break;
      }

      let transactionId: string | null = existingTx?.id ?? null;

      if (existingTx?.id) {
        skippedCount += 1;
        await writeRunLog({
          ruleId: rule.id,
          userId: rule.user_id,
          transactionId,
          status: "skipped",
          details: `Transaction already existed for scheduled run ${dueAtIso}. Rule advanced without creating a duplicate.`,
        });
      } else {
        const baseTransaction = {
          user_id: rule.user_id,
          wallet_id: rule.wallet_id,
          category_id: rule.category_id,
          amount_minor: rule.amount_minor,
          currency_code: rule.currency_code,
          type: rule.type,
          description: rule.description,
          occurred_at: dueAtIso,
        };
        let insertResult = await supabase
          .from("transactions")
          .insert({
            ...baseTransaction,
            recurring_rule_id: rule.id,
            scheduled_for: dueAtIso,
            transaction_kind: "operational",
          })
          .select("id")
          .single();

        if (isMissingLedgerMetadata(insertResult.error)) {
          metadataAvailable = false;
          insertResult = await supabase
            .from("transactions")
            .insert(baseTransaction)
            .select("id")
            .single();
        }

        const { data: insertedTx, error: insertError } = insertResult;

        if (metadataAvailable && insertError?.code === "23505") {
          const { data: concurrentTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("recurring_rule_id", rule.id)
            .eq("scheduled_for", dueAtIso)
            .maybeSingle();
          transactionId = concurrentTx?.id ?? null;
          skippedCount += 1;
          await writeRunLog({
            ruleId: rule.id,
            userId: rule.user_id,
            transactionId,
            status: "skipped",
            details: `A concurrent worker already created scheduled run ${dueAtIso}.`,
          });
        } else if (insertError) {
          failedCount += 1;
          ruleHadFailure = true;
          console.error(
            `[cron/recurring] Failed to create tx for rule ${rule.id} at ${dueAtIso}:`,
            insertError
          );
          await writeRunLog({
            ruleId: rule.id,
            userId: rule.user_id,
            status: "failed",
            details: `Transaction insert failed for scheduled run ${dueAtIso}: ${insertError.message}`,
          });
          break;
        } else {
          transactionId = insertedTx?.id ?? null;
          createdCount += 1;

          await writeRunLog({
            ruleId: rule.id,
            userId: rule.user_id,
            transactionId,
            status: "success",
            details: `Backfilled recurring transaction for scheduled run ${dueAtIso}.`,
          });
        }
      }

      runsHandledForRule += 1;
      lastProcessedRunAt = dueAtIso;
      currentRunAt = advanceNextRunAt(
        currentRunAt,
        rule.frequency,
        rule.interval,
        rule.day_of_month
      );
    }

    if (runsHandledForRule === 0) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("recurring_rules")
      .update({
        next_run_at: currentRunAt,
        last_run_at: lastProcessedRunAt,
        total_runs: (rule.total_runs ?? 0) + runsHandledForRule,
      })
      .eq("id", rule.id);

    if (updateError) {
      failedCount += 1;
      console.error(
        `[cron/recurring] Failed to update next_run_at for rule ${rule.id}:`,
        updateError
      );
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "failed",
        details: `Rule update failed after ${runsHandledForRule} handled run(s): ${updateError.message}`,
      });
      continue;
    }

    updatedCount += 1;

    if (runsHandledForRule > 1 && !ruleHadFailure) {
      await writeRunLog({
        ruleId: rule.id,
        userId: rule.user_id,
        status: "success",
        details: `Backfill completed. ${runsHandledForRule} scheduled run(s) handled. Next run: ${currentRunAt}.`,
      });
    }
  }

  return NextResponse.json(
    {
      date: todayStr,
      processed: processedCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
