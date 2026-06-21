"use client";

import type { ReactNode } from "react";

type MoneyEntry = readonly [string, number];

type Props = {
  loading: boolean;
  walletsCount: number;
  totalsByCurrency: Record<string, number>;
  incomeEntries: MoneyEntry[];
  expenseEntries: MoneyEntry[];
  netEntries: MoneyEntry[];
  monthLabel: string;
};

function formatMinor(minor: number) {
  return (minor / 100).toFixed(2);
}

function MoneyList({
  entries,
  emptyLabel = "0.00",
  emphasizeNegative = false,
}: {
  entries: MoneyEntry[];
  emptyLabel?: string;
  emphasizeNegative?: boolean;
}) {
  if (entries.length === 0) {
    return <div className="tabular-nums">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-1">
      {entries.map(([currency, minor]) => {
        const isNegative = minor < 0;
        return (
          <div
            key={currency}
            className={`tabular-nums ${
              emphasizeNegative && isNegative ? "text-gray-300" : ""
            }`}
          >
            {formatMinor(minor)}{" "}
            <span className="text-sm text-gray-300">{currency}</span>
          </div>
        );
      })}
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
    <div className="border border-gray-800 bg-black/40 rounded-2xl p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] min-w-0">
      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums leading-tight break-words">
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-2 leading-relaxed">{helper}</div>
    </div>
  );
}

export default function ExecutiveKpiCards({
  loading,
  walletsCount,
  totalsByCurrency,
  incomeEntries,
  expenseEntries,
  netEntries,
  monthLabel,
}: Props) {
  const balanceEntries = Object.entries(totalsByCurrency).sort();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border border-gray-800 bg-black/40 rounded-2xl p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
          >
            <div className="h-3 w-24 rounded bg-gray-900 animate-pulse mb-4" />
            <LoadingLine wide={index === 0} />
            <div className="h-3 w-3/4 rounded bg-gray-900 animate-pulse mt-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Balance"
        value={<MoneyList entries={balanceEntries} />}
        helper={`${walletsCount} ${
          walletsCount === 1 ? "wallet" : "wallets"
        } tracked. Transfers included.`}
      />

      <KpiCard
        label={`Income – ${monthLabel}`}
        value={<MoneyList entries={incomeEntries} />}
        helper="Income this month, excluding internal transfers."
      />

      <KpiCard
        label={`Expenses – ${monthLabel}`}
        value={<MoneyList entries={expenseEntries} />}
        helper="Expenses this month, excluding internal transfers."
      />

      <KpiCard
        label="Net Cash Flow"
        value={<MoneyList entries={netEntries} emphasizeNegative />}
        helper="Income minus expenses for the selected month."
      />
    </div>
  );
}
