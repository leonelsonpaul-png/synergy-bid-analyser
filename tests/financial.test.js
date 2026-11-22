import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialEligibility } from "../supabase/functions/_shared/financial.js";
import { determineVerdict, collectMissingEvidence, restoreTenderAfterFailure } from "../supabase/functions/_shared/analysis_rules.js";

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

test("single-year threshold passes with one verified year when average is not required", () => {
  const result = calculateFinancialEligibility([row("FY 2025-26", 30_00_00_000)], { required_single_year_turnover_inr: 20_00_00_000, turnover_years_required: 3 }, ["proof-id"]);
  assert.equal(result.status, "pass");
  assert.equal(result.selected.length, 1);
});

test("single-year threshold reports insufficient evidence when no verified year exists", () => {
  const result = calculateFinancialEligibility([row("FY 2025-26", 30_00_00_000, "user_provided", null)], { required_single_year_turnover_inr: 20_00_00_000, turnover_years_required: 3 }, []);
  assert.equal(result.status, "insufficient_evidence");
});

test("checks average and single-year thresholds together", () => {
  const result = calculateFinancialEligibility([
    row("FY 2025-26", 25_00_00_000), row("FY 2024-25", 15_00_00_000), row("FY 2023-24", 10_00_00_000),
  ], { required_average_turnover_inr: 18_00_00_000, required_single_year_turnover_inr: 24_00_00_000, turnover_years_required: 3 }, ["proof-id"]);
  assert.equal(result.status, "pass");
  assert.equal(result.average, 50_00_00_000 / 3);
});

test("verdict prioritises mandatory failure over other unknowns", () => {
  assert.equal(determineVerdict([
    { requirement_type: "mandatory", status: "missing_evidence" },
    { requirement_type: "mandatory", status: "fail" },
  ]), "not_eligible");
});

test("verdict remains insufficient when mandatory proof is missing", () => {
  assert.equal(determineVerdict([{ requirement_type: "mandatory", status: "missing_evidence" }]), "insufficient_evidence");
  assert.equal(determineVerdict([], "insufficient_evidence"), "insufficient_evidence");
});

test("missing evidence is deduplicated and empty values are removed", () => {
  assert.deepEqual(collectMissingEvidence(["GST certificate", "GST certificate", ""], ["Audited turnover proof"]), ["GST certificate", "Audited turnover proof"]);
});

test("failed analysis restores the previous tender status and writes an audit event", async () => {
  const calls = [];
  const client = { from(table) { return {
    update(value) { calls.push({ table, operation: "update", value }); return { eq: async (column, value) => { calls.push({ column, value }); return { error: null }; } }; },
    insert(value) { calls.push({ table, operation: "insert", value }); return Promise.resolve({ error: null }); },
  }; } };
  await restoreTenderAfterFailure(client, "tender-1", "analysis_ready", "admin-1", new Error("OCR timeout"));
  assert.deepEqual(calls[0], { table: "tenders", operation: "update", value: { status: "analysis_ready" } });
  assert.equal(calls.some((call) => call.table === "audit_events" && call.value.event_type === "tender_analysis_failed"), true);
});

test("failed status recovery surfaces database update errors", async () => {
  const client = { from() { return { update() { return { eq: async () => ({ error: { message: "write denied" } }) }; } }; } };
  await assert.rejects(() => restoreTenderAfterFailure(client, "tender-1", "uploaded", "admin-1", "test"), /Restore tender status: write denied/);
});
