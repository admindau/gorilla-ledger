export type ActivationStepId =
  | "wallet"
  | "categories"
  | "transaction"
  | "budget"
  | "recurring";

export type ActivationInput = {
  walletCount: number;
  incomeCategoryCount: number;
  expenseCategoryCount: number;
  transactionCount: number;
  budgetCount: number;
  recurringRuleCount: number;
};

export type ActivationStep = {
  id: ActivationStepId;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
  complete: boolean;
  core: boolean;
};

export type ActivationModel = {
  steps: ActivationStep[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  coreReady: boolean;
  fullyActivated: boolean;
  nextStep: ActivationStep | null;
};

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function buildActivationModel(input: ActivationInput): ActivationModel {
  const walletCount = safeCount(input.walletCount);
  const incomeCategoryCount = safeCount(input.incomeCategoryCount);
  const expenseCategoryCount = safeCount(input.expenseCategoryCount);
  const transactionCount = safeCount(input.transactionCount);
  const budgetCount = safeCount(input.budgetCount);
  const recurringRuleCount = safeCount(input.recurringRuleCount);

  const steps: ActivationStep[] = [
    {
      id: "wallet",
      label: "Establish your first wallet",
      description: "Create the financial position that transactions will flow through.",
      href: "/wallets",
      actionLabel: "Add wallet",
      complete: walletCount > 0,
      core: true,
    },
    {
      id: "categories",
      label: "Classify income and expenses",
      description: "Keep at least one active category for each side of your cash flow.",
      href: "/categories",
      actionLabel: "Set categories",
      complete: incomeCategoryCount > 0 && expenseCategoryCount > 0,
      core: true,
    },
    {
      id: "transaction",
      label: "Record real activity",
      description: "Add your first transaction to activate reporting and financial health signals.",
      href: "/transactions",
      actionLabel: "Add transaction",
      complete: transactionCount > 0,
      core: true,
    },
    {
      id: "budget",
      label: "Create a monthly guardrail",
      description: "Add a budget to unlock pressure alerts and budget-versus-actual tracking.",
      href: "/budgets",
      actionLabel: "Create budget",
      complete: budgetCount > 0,
      core: false,
    },
    {
      id: "recurring",
      label: "Automate a predictable flow",
      description: "Schedule a recurring income or expense to strengthen forecasts.",
      href: "/recurring",
      actionLabel: "Add recurring rule",
      complete: recurringRuleCount > 0,
      core: false,
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const coreSteps = steps.filter((step) => step.core);

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    progressPercent: Math.round((completedCount / steps.length) * 100),
    coreReady: coreSteps.every((step) => step.complete),
    fullyActivated: completedCount === steps.length,
    nextStep: steps.find((step) => !step.complete) ?? null,
  };
}
