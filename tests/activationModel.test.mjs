import assert from "node:assert/strict";
import test from "node:test";

import { buildActivationModel } from "../lib/activation/model.ts";

const emptyInput = {
  walletCount: 0,
  incomeCategoryCount: 0,
  expenseCategoryCount: 0,
  transactionCount: 0,
  budgetCount: 0,
  recurringRuleCount: 0,
};

test("activation begins with the wallet milestone", () => {
  const model = buildActivationModel(emptyInput);
  assert.equal(model.progressPercent, 0);
  assert.equal(model.coreReady, false);
  assert.equal(model.fullyActivated, false);
  assert.equal(model.nextStep?.id, "wallet");
});

test("categories require both income and expense classification", () => {
  const model = buildActivationModel({
    ...emptyInput,
    walletCount: 1,
    incomeCategoryCount: 2,
  });
  assert.equal(model.steps.find((step) => step.id === "categories")?.complete, false);
  assert.equal(model.nextStep?.id, "categories");
});

test("the core ledger activates after wallet, taxonomy, and activity", () => {
  const model = buildActivationModel({
    ...emptyInput,
    walletCount: 1,
    incomeCategoryCount: 1,
    expenseCategoryCount: 1,
    transactionCount: 1,
  });
  assert.equal(model.coreReady, true);
  assert.equal(model.fullyActivated, false);
  assert.equal(model.nextStep?.id, "budget");
  assert.equal(model.progressPercent, 60);
});

test("planning and automation complete full activation", () => {
  const model = buildActivationModel({
    walletCount: 2,
    incomeCategoryCount: 1,
    expenseCategoryCount: 4,
    transactionCount: 8,
    budgetCount: 2,
    recurringRuleCount: 1,
  });
  assert.equal(model.coreReady, true);
  assert.equal(model.fullyActivated, true);
  assert.equal(model.nextStep, null);
  assert.equal(model.progressPercent, 100);
});

test("invalid counts cannot create false progress", () => {
  const model = buildActivationModel({
    ...emptyInput,
    walletCount: Number.NaN,
    transactionCount: -3,
  });
  assert.equal(model.completedCount, 0);
});
