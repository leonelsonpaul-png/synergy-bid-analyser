import test from "node:test";
import assert from "node:assert/strict";
import { resolveClausePageReferences, extractTenderMetadataFallback, detectMissingTenderAttachments } from "../supabase/functions/_shared/source_validation.js";

const pages = [
  { page_number: 1, text: "Bid Number GEM/2026/B/8212520 Bid End Date/Time 23-11-2026 18:00 Ministry/State Name Ministry Of Earth Sciences" },
  { page_number: 5, text: "minimum average annual financial turnover of the bidder during the last three financial years should be INR 700000" },
  { page_number: 10, text: "OEM Turn Over Criteria minimum average annual financial turnover of the OEM INR 5000000" },
];

test("corrects an AI page citation outside the physical PDF page range", () => {
  const [clause] = resolveClausePageReferences([
    { source_document: "GeM-Bidding-10094929.pdf", page_number: 25, requirement: "minimum average annual financial turnover of the bidder during the last three financial years INR 700000" },
  ], [{ filename: "GeM-Bidding-10094929.pdf", pages }]);
  assert.equal(clause.page_number, 5);
});

test("removes page citations that cannot be verified against extracted page text", () => {
  const [clause] = resolveClausePageReferences([
    { source_document: "GeM-Bidding-10094929.pdf", page_number: 8, requirement: "mandatory ISO 9001 certification" },
  ], [{ filename: "GeM-Bidding-10094929.pdf", pages }]);
  assert.equal(clause.page_number, null);
  assert.match(clause.gap_or_risk, /could not be verified/);
});

test("extracts GeM reference and deadline as fallback tender metadata", () => {
  const result = extractTenderMetadataFallback([{ text: "Bid Number GEM/2026/B/8212520\nBid End Date/Time 23-11-2026 18:00\nMinistry/State Name Ministry Of Earth Sciences\nDepartment Name India Meteorological Department (IMD)" }]);
  assert.equal(result.reference, "GEM/2026/B/8212520");
  assert.equal(result.submission_deadline, "2026-11-23T18:00:00.000Z");
  assert.match(result.procuring_entity, /Ministry Of Earth Sciences/);
});

test("detects referenced but missing BOQ and specification attachments", () => {
  const missing = detectMissingTenderAttachments([{ document_type: "Tender document", text: "Specification Document View File\nBOQ Detail Document View File" }]);
  assert.equal(missing.length, 2);
  assert.match(missing.join(" "), /BOQ/);
  assert.match(missing.join(" "), /technical specification/);
});
