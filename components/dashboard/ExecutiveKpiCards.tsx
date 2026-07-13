"use client";

import type { ReactNode } from "react";

import type { DashboardInsightModel } from "@/lib/dashboard/intelligence";

type Props = {
  loading: boolean;
  walletsCount: number;
  model: DashboardInsightModel;
};

function formatMinor(minor: number) {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MoneyList({
  values,
  emptyLabel = "0.00",
  emphasizeNegative = false,
}: {
  values: Array<{ currencyCode: string; minor: number }>;
  emptyLabel?: string;
  emphasizeNegative?: boolean;
}) {
  if (values.length === 0) {
    return <div className="tabular-nums">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-1.5">
      {values.map(({ currencyCode, minor }) => (
        <div
          key={currencyCode}
          className={`flex min-w-0 items-baseline justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 tabular-nums ${
            emphasizeNegative && minor < 0 ? "text-gray-300" : ""
          }`}
        >
          <span className="min-w-0 break-all">{formatMinor(minor)}</span>
          <span className="shrink-0 text-xs text-gray-300">{currencyCode}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingLine({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`h-8 rounded-xl bg-gray-900 animate-pulse ${
        wide ? "w-40" : "w-28"
      }`}
    />
  );
}

function KpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <div className="gl-premium-card flex min-h-[9.75rem] min-w-0 flex-col rounded-[1.25rem] p-4 sm:p-5">
      <div className="text-[10px] text-gray-500 uppercase tracking-[0.18em] mb-3">
        {label}
      </div>
      <div className="text-xl font-semibold tracking-[-0.035em] tabular-nums leading-tight break-words text-white sm:text-[1.55rem]">
        {value}
      </div>
      <div className="mt-auto pt-3 text-xs leading-relaxed text-gray-500">{helper}</div>
    </div>
  );
}

export default function ExecutiveKpiCards({
  loading,
  walletsCount,
  model,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-3 min-[520px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="gl-premium-card rounded-[1.25rem] p-4">
            <div className="h-3 w-24 rounded bg-gray-900 animate-pulse mb-4" />
            <LoadingLine wide={index === 0} />
            <div className="h-3 w-3/4 rounded bg-gray-900 animate-pulse mt-4" />
          </div>
        ))}
      </div>
    );
  }

  const balanceValues = model.currencies.map((currency) => ({
    currencyCode: currency.currencyCode,
    minor: currency.balanceMinor,
  }));
  const incomeValues = model.currencies.map((currency) => ({
    currencyCode: currency.currencyCode,
    minor: currency.incomeMinor,
  }));
  const expenseValues = model.currencies.map((currency) => ({
    currencyCode: currency.currencyCode,
    minor: currency.expenseMinor,
  }));
  const netValues = model.currencies.map((currency) => ({
    currencyCode: currency.currencyCode,
    minor: currency.netMinor,
  }));
  const monthLabel = model.filters.period.label;

  return (
    <div className="grid gap-3 min-[520px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Total Balance"
        value={<MoneyList values={balanceValues} />}
        helper={`${walletsCount} ${walletsCount === 1 ? "wallet" : "wallets"} tracked. Transfers included.`}
      />
      <KpiCard
        label={`Income – ${monthLabel}`}
        value={<MoneyList values={incomeValues} />}
        helper="Income this month, excluding internal transfers."
      />
      <KpiCard
        label={`Expenses – ${monthLabel}`}
        value={<MoneyList values={expenseValues} />}
        helper="Expenses this month, excluding internal transfers."
      />
      <KpiCard
        label="Net Cash Flow"
        value={<MoneyList values={netValues} emphasizeNegative />}
        helper="Income minus expenses for the selected month."
      />
    </div>
  );
}
