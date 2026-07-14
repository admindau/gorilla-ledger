import Link from "next/link";
import type { ActivationModel } from "@/lib/activation/model";

type ActivationGuideProps = {
  model: ActivationModel;
};

export function ActivationGuide({ model }: ActivationGuideProps) {
  if (model.fullyActivated) return null;

  const nextStep = model.nextStep;

  if (model.coreReady && nextStep) {
    return (
      <section className="gl-premium-card mb-7 p-5 sm:mb-8" aria-labelledby="activation-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/80">Ledger activated</p>
            <h2 id="activation-title" className="mt-2 text-lg font-semibold tracking-tight text-white">
              Next enhancement: {nextStep.label}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">{nextStep.description}</p>
          </div>
          <Link href={nextStep.href} className="gl-btn gl-btn-secondary gl-btn-md shrink-0">
            {nextStep.actionLabel}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="gl-premium-card mb-7 overflow-hidden p-5 sm:mb-8 sm:p-6" aria-labelledby="activation-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/80">
            Getting started
          </p>
          <h2 id="activation-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Activate your financial command center
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Complete the guided setup to turn empty screens into useful balances, activity, and financial signals.
          </p>
        </div>

        {nextStep ? (
          <Link href={nextStep.href} className="gl-btn gl-btn-primary gl-btn-md shrink-0">
            {nextStep.actionLabel}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4 text-xs text-gray-400">
          <span>{model.completedCount} of {model.totalCount} milestones complete</span>
          <span className="tabular-nums">{model.progressPercent}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Ledger activation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={model.progressPercent}
        >
          <div
            className="h-full rounded-full bg-emerald-300 transition-[width] duration-500"
            style={{ width: `${model.progressPercent}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 grid gap-3 lg:grid-cols-5">
        {model.steps.map((step) => {
          const current = nextStep?.id === step.id;
          return (
            <li
              key={step.id}
              className={[
                "rounded-2xl border p-4",
                step.complete
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : current
                    ? "border-white/25 bg-white/[0.06]"
                    : "border-white/10 bg-black/20",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                    step.complete
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                      : "border-white/15 text-gray-400",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {step.complete ? "✓" : model.steps.indexOf(step) + 1}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                  {step.core ? "Core" : "Enhance"}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-5 text-white">{step.label}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">{step.description}</p>
              {!step.complete ? (
                <Link href={step.href} className="mt-3 inline-flex text-xs font-medium text-gray-200 underline decoration-white/25 underline-offset-4 hover:text-white">
                  {step.actionLabel}
                </Link>
              ) : (
                <p className="mt-3 text-xs font-medium text-emerald-300">Complete</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
