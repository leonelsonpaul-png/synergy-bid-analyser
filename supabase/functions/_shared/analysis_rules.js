export function determineVerdict(clauses = [], financialStatus = "not_applicable") {
  const mandatory = clauses.filter((clause) => clause.requirement_type === "mandatory" && clause.status !== "not_applicable");
  const statuses = mandatory.map((clause) => String(clause.status || "clarification_required").toLowerCase());
  if (statuses.includes("fail")) return "not_eligible";
  if (mandatory.length === 0) return "insufficient_evidence";
  if (statuses.some((status) => ["missing_evidence", "clarification_required"].includes(status)) || financialStatus === "insufficient_evidence") return "insufficient_evidence";
  if (statuses.includes("conditional")) return "eligible_with_conditions";
  return "eligible";
}

export function collectMissingEvidence(aiMissing = [], financialChecks = []) {
  return [...new Set([...aiMissing, ...financialChecks].map((item) => String(item || "").trim()).filter(Boolean))];
}

export async function restoreTenderAfterFailure(client, tenderId, previousStatus, actorId, cause) {
  const update = await client.from("tenders").update({ status: previousStatus }).eq("id", tenderId);
  if (update.error) throw new Error(`Restore tender status: ${update.error.message || String(update.error)}`);
  const audit = await client.from("audit_events").insert({
    actor_id: actorId,
    event_type: "tender_analysis_failed",
    entity_type: "tender",
    entity_id: tenderId,
    details: { restored_status: previousStatus, error: String(cause).slice(0, 2000) },
  });
  if (audit.error) throw new Error(`Record failed analysis: ${audit.error.message || String(audit.error)}`);
}
