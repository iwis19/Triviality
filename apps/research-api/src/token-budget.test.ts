import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenBudgetForRequest } from "./token-budget.js";

test("per-run budgets override the configured default", () => {
  assert.equal(tokenBudgetForRequest(120000, "60000"), 120000);
  assert.equal(tokenBudgetForRequest(undefined, "90000"), 90000);
  assert.equal(tokenBudgetForRequest(undefined, ""), 60000);
  assert.equal(tokenBudgetForRequest(10000), 10000);
  assert.equal(tokenBudgetForRequest(1000000), 1000000);
});

test("invalid budgets are rejected before creating or queuing a job", () => {
  for (const value of [null, "120000", true, 0, -1, 9999, 1000001, 60000.5, NaN, Infinity]) {
    assert.throws(() => tokenBudgetForRequest(value), /tokenBudget must be an integer/);
  }
  assert.throws(() => tokenBudgetForRequest(undefined, "invalid"));
});
