import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialEligibility } from "../supabase/functions/_shared/financial.js";

const row = (year, turnover, status = "verified", evidence = "proof-id") => ({
  financial_year: year, turnover_inr: turnover, verification_status: status, evidence_document_id: evidence,
});

test("requires all requested verified years before passing average turnover", () => {
  const result = calculateFinancialEligibility([
    row("FY 2025-26", 55_00_00_000),
    row("FY 2024-25", 26_00_00_000),
    row("FY 2023-24", 7_00_00_000, "user_provided", null),
  ], { required_average_turnover_inr: 20_00_00_000, turnover_years_required: 3 }, ["proof-id"]);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.average, null);
  assert.match(result.checks[0], /only 2 qualifying verified records/);
});

test("calculates average using linked verified records only", () => {
  const result = calculateFinancialEligibility([
    row("FY 2025-26", 55_00_00_000),
    row("FY 2024-25", 26_00_00_000),
    row("FY 2023-24", 7_00_00_000),
    row("FY 2022-23", 99_00_00_000, "user_provided", null),
  ], { required_average_turnover_inr: 20_00_00_000, turnover_years_required: 3 }, ["proof-id"]);
  assert.equal(result.status, "pass");
  assert.equal(result.average, (55_00_00_000 + 26_00_00_000 + 7_00_00_000) / 3);
  assert.equal(result.selected.length, 3);
});

test("flags a verified turnover shortfall", () => {
  const result = calculateFinancialEligibility([
    row("FY 2025-26", 10_00_00_000),
    row("FY 2024-25", 12_00_00_000),
    row("FY 2023-24", 8_00_00_000),
  ], { required_average_turnover_inr: 15_00_00_000, turnover_years_required: 3 }, ["proof-id"]);
  assert.equal(result.status, "fail");
  assert.match(result.checks.join(" "), /below required/);
});

test("does not apply a turnover test when the tender specifies none", () => {
  const result = calculateFinancialEligibility([], {}, []);
  assert.equal(result.status, "not_applicable");
});

test("ignores turnover rows whose linked certificate is not verified", () => {
  const result = calculateFinancialEligibility([
    row("FY 2025-26", 55_00_00_000, "verified", "unverified-proof"),
    row("FY 2024-25", 26_00_00_000, "verified", "unverified-proof"),
    row("FY 2023-24", 7_00_00_000, "verified", "unverified-proof"),
  ], { required_average_turnover_inr: 20_00_00_000, turnover_years_required: 3 }, []);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.selected.length, 0);
});
