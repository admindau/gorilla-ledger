"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { DataLoadAlert } from "@/components/ui/DataLoadAlert";
import Skeleton from "@/components/ui/Skeleton";
import TrustIndicator from "@/components/ui/TrustIndicator";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { isMissingLedgerMetadata } from "@/lib/supabase/schemaCompatibility";
import {
  buildLedgerExports,
  type ExportBudget,
  type ExportCategory,
  type ExportRecurringRule,
  type ExportTransaction,
  type ExportWallet,
  type LedgerExportInput,
} from "@/lib/export/ledgerExport";

const EXPORT_PAGE_SIZE = 1000;

async function loadPagedTable(table: string, columns: string) {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await supabaseBrowserClient
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1);

    if (error) return { data: [], error: error.message };
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return { data: rows, error: null };
  }
}

async function loadTransactionsForExport() {
  const enhanced = await loadPagedTable(
    "transactions",
    "id,wallet_id,category_id,type,amount_minor,currency_code,occurred_at,occurred_at_precision,occurred_timezone,description,created_at,transaction_kind,transfer_id,recurring_rule_id,scheduled_for"
  );
  if (!enhanced.error || !isMissingLedgerMetadata({ message: enhanced.error })) return enhanced;
  return loadPagedTable(
    "transactions",
    "id,wallet_id,category_id,type,amount_minor,currency_code,occurred_at,description,created_at"
  );
}

export default function ExportCenterPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [ledgerData, setLedgerData] = useState<LedgerExportInput | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadExportData() {
      setLoading(true);
      setLoadError(false);

      try {
        const [userResult, wallets, categories, transactions, budgets, recurringRules] = await Promise.all([
          supabaseBrowserClient.auth.getUser(),
          loadPagedTable("wallets", "id,name,type,currency_code,starting_balance_minor,created_at,updated_at"),
          loadPagedTable("categories", "id,name,type,is_active,created_at"),
          loadTransactionsForExport(),
          loadPagedTable("budgets", "id,wallet_id,category_id,year,month,amount_minor,created_at,updated_at"),
          loadPagedTable("recurring_rules", "id,wallet_id,category_id,type,amount_minor,currency_code,frequency,interval,day_of_month,day_of_week,start_date,end_date,next_run_at,last_run_at,total_runs,description,is_active,created_at"),
        ]);

        if (cancelled) return;
        const sourceError = [wallets, categories, transactions, budgets, recurringRules].find(
          (result) => result.error
        )?.error;

        if (userResult.error || !userResult.data.user || sourceError) {
          console.error("Unable to prepare ledger exports:", {
            userError: userResult.error,
            sourceError,
          });
          setLedgerData(null);
          setLoadError(true);
          setLoading(false);
          return;
        }

        setLedgerData({
          wallets: wallets.data as ExportWallet[],
          categories: categories.data as ExportCategory[],
          transactions: transactions.data as ExportTransaction[],
          budgets: budgets.data as ExportBudget[],
          recurringRules: recurringRules.data as ExportRecurringRule[],
        });
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error("Export Center initialization failed:", error);
        setLedgerData(null);
        setLoadError(true);
        setLoading(false);
      }
    }

    void loadExportData();
    return () => {
      cancelled = true;
    };
  }, [loadVersion]);

  const datasets = useMemo(
    () => (ledgerData ? buildLedgerExports(ledgerData) : []),
    [ledgerData]
  );
  const totalRows = datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0);

  function downloadDataset(filename: string, csv: string) {
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gorilla-ledger-${filename}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (loadError && !loading) {
    return (
      <div className="gl-page-migrated">
        <PageShell className="max-w-5xl">
          <PageHeader
            eyebrow="Data Portability"
            title="Export Center"
            description="Take a complete, currency-explicit copy of your Gorilla Ledger records for analysis, reporting, or safekeeping."
          />
          <DataLoadAlert
            title="Exports are temporarily unavailable"
            message="We could not verify every ledger dataset, so export files have not been generated. Your records remain safely stored and unchanged."
            onRetry={() => setLoadVersion((value) => value + 1)}
          />
        </PageShell>
      </div>
    );
  }

  return (
    <div className="gl-page-migrated">
      <PageShell className="max-w-5xl">
        <PageHeader
          eyebrow="Data Portability"
          title="Export Center"
          description="Take a complete, currency-explicit copy of your Gorilla Ledger records for analysis, reporting, or safekeeping."
        />

        <Card variant="premium" className="p-5 sm:p-6" aria-busy={loading}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Export trust layer</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Private, local downloads</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                Files are generated in your browser from authenticated, RLS-protected records. Exporting does not send your ledger to another service.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TrustIndicator status="success" label="Authenticated Data" />
              <TrustIndicator status="success" label="Currency Explicit" />
              <TrustIndicator status="info" label="CSV Format" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="gl-inner-card p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Datasets</p>
              {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-2xl font-semibold">{datasets.length}</p>}
            </div>
            <div className="gl-inner-card p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Exportable Records</p>
              {loading ? <Skeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 text-2xl font-semibold tabular-nums">{totalRows.toLocaleString()}</p>}
            </div>
            <div className="gl-inner-card p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Processing</p>
              <p className="mt-2 text-2xl font-semibold">Local</p>
            </div>
          </div>
        </Card>

        <section className="mt-8" aria-labelledby="export-datasets-title">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">Available datasets</p>
            <h2 id="export-datasets-title" className="mt-2 text-xl font-semibold">Choose what to export</h2>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full" rounded="2xl" />
              ))}
            </div>
          ) : loadError ? (
            <p className="text-sm text-gray-500">Export datasets are unavailable.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {datasets.map((dataset) => (
                <Card key={dataset.id} variant="premium" className="flex min-h-48 flex-col p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{dataset.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-400">{dataset.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs tabular-nums text-gray-300">
                      {dataset.rowCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                    <span className="text-xs text-gray-500">{dataset.filename}</span>
                    <button
                      type="button"
                      className="gl-btn gl-btn-secondary gl-btn-sm"
                      onClick={() => downloadDataset(dataset.filename, dataset.csv)}
                      disabled={dataset.rowCount === 0}
                    >
                      Export CSV
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </PageShell>
    </div>
  );
}
