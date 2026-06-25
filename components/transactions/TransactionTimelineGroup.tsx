import type { ReactNode } from "react";

type TransactionTimelineGroupProps = {
  label: string;
  count: number;
  children: ReactNode;
};

export function TransactionTimelineGroup({
  label,
  count,
  children,
}: TransactionTimelineGroupProps) {
  return (
    <section className="relative pl-5">
      <div className="absolute left-0 top-1.5 bottom-0 w-px bg-gradient-to-b from-white/25 via-white/10 to-transparent" />
      <div className="mb-3 flex items-center gap-3">
        <span className="absolute left-[-5px] h-2.5 w-2.5 rounded-full border border-white/30 bg-black shadow-[0_0_0_4px_rgba(255,255,255,0.04)]" />
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
            {label}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {count} {count === 1 ? "transaction" : "transactions"}
          </p>
        </div>
      </div>
      <div className="space-y-3 pb-5">{children}</div>
    </section>
  );
}
