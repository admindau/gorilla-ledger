export type ExportWallet = {
  id: string;
  name: string;
  type: string;
  currency_code: string;
  starting_balance_minor: number;
  created_at: string;
  updated_at: string;
};

export type ExportCategory = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
};

export type ExportTransaction = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: string;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  description: string | null;
  created_at: string;
};

export type ExportBudget = {
  id: string;
  wallet_id: string | null;
  category_id: string;
  year: number;
  month: number;
  amount_minor: number;
  created_at: string;
  updated_at: string;
};

export type ExportRecurringRule = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: string;
  amount_minor: number;
  currency_code: string;
  frequency: string;
  interval: number;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  next_run_at: string;
  last_run_at: string | null;
  total_runs: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type LedgerExportInput = {
  wallets: ExportWallet[];
  categories: ExportCategory[];
  transactions: ExportTransaction[];
  budgets: ExportBudget[];
  recurringRules: ExportRecurringRule[];
};

export type LedgerExportDataset = {
  id: "wallets" | "categories" | "transactions" | "budgets" | "recurring";
  label: string;
  description: string;
  filename: string;
  rowCount: number;
  csv: string;
};

type CsvValue = string | number | boolean | null | undefined;

export function protectSpreadsheetText(value: string): string {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? protectSpreadsheetText(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(headers: string[], rows: CsvValue[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function decimalAmount(minor: number) {
  return Number((minor / 100).toFixed(2));
}

export function buildLedgerExports(input: LedgerExportInput): LedgerExportDataset[] {
  const walletById = Object.fromEntries(input.wallets.map((wallet) => [wallet.id, wallet] as const));
  const categoryById = Object.fromEntries(
    input.categories.map((category) => [category.id, category] as const)
  );

  const walletsCsv = buildCsv(
    ["Wallet ID", "Name", "Type", "Currency", "Starting Balance Minor", "Starting Balance", "Created At", "Updated At"],
    input.wallets.map((wallet) => [
      wallet.id,
      wallet.name,
      wallet.type,
      wallet.currency_code,
      wallet.starting_balance_minor,
      decimalAmount(wallet.starting_balance_minor),
      wallet.created_at,
      wallet.updated_at,
    ])
  );

  const categoriesCsv = buildCsv(
    ["Category ID", "Name", "Type", "Active", "Created At"],
    input.categories.map((category) => [
      category.id,
      category.name,
      category.type,
      category.is_active,
      category.created_at,
    ])
  );

  const transactionsCsv = buildCsv(
    ["Transaction ID", "Occurred At", "Type", "Description", "Wallet ID", "Wallet", "Category ID", "Category", "Currency", "Amount Minor", "Amount", "Created At"],
    input.transactions.map((transaction) => [
      transaction.id,
      transaction.occurred_at,
      transaction.type,
      transaction.description,
      transaction.wallet_id,
      walletById[transaction.wallet_id]?.name ?? "Unknown wallet",
      transaction.category_id,
      transaction.category_id
        ? categoryById[transaction.category_id]?.name ?? "Unknown category"
        : "Uncategorized",
      transaction.currency_code,
      transaction.amount_minor,
      decimalAmount(transaction.amount_minor),
      transaction.created_at,
    ])
  );

  const budgetsCsv = buildCsv(
    ["Budget ID", "Year", "Month", "Wallet ID", "Wallet", "Category ID", "Category", "Currency", "Amount Minor", "Amount", "Created At", "Updated At"],
    input.budgets.map((budget) => {
      const wallet = budget.wallet_id ? walletById[budget.wallet_id] : null;
      return [
        budget.id,
        budget.year,
        budget.month,
        budget.wallet_id,
        wallet?.name ?? "Unassigned",
        budget.category_id,
        categoryById[budget.category_id]?.name ?? "Unknown category",
        wallet?.currency_code ?? "Unassigned",
        budget.amount_minor,
        decimalAmount(budget.amount_minor),
        budget.created_at,
        budget.updated_at,
      ];
    })
  );

  const recurringCsv = buildCsv(
    ["Rule ID", "Active", "Type", "Description", "Wallet ID", "Wallet", "Category ID", "Category", "Currency", "Amount Minor", "Amount", "Frequency", "Interval", "Day Of Month", "Day Of Week", "Start Date", "End Date", "Next Run At", "Last Run At", "Total Runs", "Created At"],
    input.recurringRules.map((rule) => [
      rule.id,
      rule.is_active,
      rule.type,
      rule.description,
      rule.wallet_id,
      walletById[rule.wallet_id]?.name ?? "Unknown wallet",
      rule.category_id,
      rule.category_id ? categoryById[rule.category_id]?.name ?? "Unknown category" : "Uncategorized",
      rule.currency_code,
      rule.amount_minor,
      decimalAmount(rule.amount_minor),
      rule.frequency,
      rule.interval,
      rule.day_of_month,
      rule.day_of_week,
      rule.start_date,
      rule.end_date,
      rule.next_run_at,
      rule.last_run_at,
      rule.total_runs,
      rule.created_at,
    ])
  );

  return [
    { id: "transactions", label: "Transactions", description: "Complete activity history with wallet, category, amount, currency, and date context.", filename: "transactions.csv", rowCount: input.transactions.length, csv: transactionsCsv },
    { id: "wallets", label: "Wallets", description: "Asset definitions and opening positions, explicitly separated by currency.", filename: "wallets.csv", rowCount: input.wallets.length, csv: walletsCsv },
    { id: "categories", label: "Categories", description: "Active and disabled income and expense classifications.", filename: "categories.csv", rowCount: input.categories.length, csv: categoriesCsv },
    { id: "budgets", label: "Budgets", description: "Monthly planning limits with resolved wallet, category, and currency context.", filename: "budgets.csv", rowCount: input.budgets.length, csv: budgetsCsv },
    { id: "recurring", label: "Recurring Rules", description: "Automation schedules, run state, and upcoming execution details.", filename: "recurring-rules.csv", rowCount: input.recurringRules.length, csv: recurringCsv },
  ];
}
