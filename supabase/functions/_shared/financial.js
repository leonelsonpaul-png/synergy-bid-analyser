export function calculateFinancialEligibility(financials = [], rules = {}, verifiedEvidenceIds = []) {
  const validEvidence = new Set(verifiedEvidenceIds);
  const yearsRequired = Math.max(1, Math.min(5, Number(rules.turnover_years_required) || 3));
  const verifiedFinancials = financials.filter((item) =>
    item.verification_status === "verified" && Boolean(item.evidence_document_id) && validEvidence.has(item.evidence_document_id)
  ).sort((a, b) => String(b.financial_year).localeCompare(String(a.financial_year)));
  const selected = verifiedFinancials.slice(0, yearsRequired);
  const average = selected.length === yearsRequired
    ? selected.reduce((sum, item) => sum + Number(item.turnover_inr || 0), 0) / yearsRequired
    : null;
  const minAverage = rules.required_average_turnover_inr == null ? null : Number(rules.required_average_turnover_inr);
  const minSingle = rules.required_single_year_turnover_inr == null ? null : Number(rules.required_single_year_turnover_inr);
  const checks = [];
  let status = "not_applicable";
  if (minAverage != null || minSingle != null) {
    if (selected.length < yearsRequired) {
      status = "insufficient_evidence";
      checks.push(`Need ${yearsRequired} verified turnover years; only ${selected.length} qualifying verified records are linked to evidence.`);
    } else {
      const averagePass = minAverage == null || average >= minAverage;
      const singlePass = minSingle == null || selected.some((item) => Number(item.turnover_inr) >= minSingle);
      status = averagePass && singlePass ? "pass" : "fail";
      if (!averagePass) checks.push(`Verified average turnover ${average} is below required ${minAverage}.`);
      if (!singlePass) checks.push(`No verified year meets single-year turnover ${minSingle}.`);
    }
  }
  return { yearsRequired, selected, average, minAverage, minSingle, checks, status };
}
