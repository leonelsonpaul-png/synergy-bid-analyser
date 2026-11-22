const STOP_WORDS = new Set(["about","above","after","against","along","also","and","any","are","as","at","be","been","before","being","bid","bidder","by","can","certificate","certificates","criteria","during","for","from","has","have","in","including","is","it","its","must","not","of","on","or","other","shall","should","same","similar","that","the","their","there","these","this","to","under","unless","with","within"]);

function tokens(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9₹]+/g, " ").split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}
function pageMatchScore(requirement, pageText) {
  const terms = [...new Set(tokens(requirement))];
  if (!terms.length) return 0;
  const text = String(pageText || "").toLowerCase();
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}
export function resolveClausePageReferences(clauses = [], documents = []) {
  return clauses.map((clause) => {
    const source = String(clause.source_document || "").toLowerCase();
    let candidates = documents.filter((doc) => source &&
      (source.includes(String(doc.filename || "").toLowerCase()) || String(doc.filename || "").toLowerCase().includes(source)));
    if (!candidates.length) candidates = documents.filter((doc) => Array.isArray(doc.pages) && doc.pages.length);
    const suppliedPage = Number(clause.page_number);
    const suppliedDoc = candidates.find((doc) => Array.isArray(doc.pages) &&
      doc.pages.some((page) => Number(page.page_number) === suppliedPage));
    if (suppliedDoc) {
      const page = suppliedDoc.pages.find((item) => Number(item.page_number) === suppliedPage);
      if (pageMatchScore(clause.requirement, page.text) >= 2) {
        return { ...clause, source_document: suppliedDoc.filename, page_number: suppliedPage };
      }
    }
    let best = null;
    for (const doc of candidates) for (const page of doc.pages || []) {
      const score = pageMatchScore(clause.requirement, page.text);
      if (!best || score > best.score) best = { doc, page, score };
    }
    if (best && best.score >= 2) {
      return { ...clause, source_document: best.doc.filename, page_number: Number(best.page.page_number) };
    }
    return { ...clause, page_number: null,
      gap_or_risk: [clause.gap_or_risk, "Source page could not be verified against extracted per-page text; check the original document."].filter(Boolean).join(" ") };
  });
}
function parseAmount(value) {
  if (!value) return null;
  const match = String(value).replace(/,/g, "").trim().toLowerCase().match(/(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|million)?/);
  if (!match) return null;
  const multiplier = match[2] === "crore" || match[2] === "cr" ? 10000000 :
    match[2] === "lakh" || match[2] === "lac" ? 100000 : match[2] === "million" ? 1000000 : 1;
  return Number(match[1]) * multiplier;
}
function amountAfterLabel(text, labels) {
  for (const label of labels) {
    const index = text.toLowerCase().indexOf(label.toLowerCase());
    if (index < 0) continue;
    const segment = text.slice(index + label.length, index + label.length + 140);
    const match = segment.match(/(?:INR|Rs\.?|₹)?\s*([0-9][0-9,]*(?:\.\d+)?\s*(?:crore|cr|lakh|lac|million)?)/i);
    if (match) return parseAmount(match[1]);
  }
  return null;
}
export function extractTenderMetadataFallback(documents = []) {
  const text = documents.map((doc) => doc.text || "").join("\n");
  const reference = text.match(/GEM\/\d{4}\/B\/\d+/i)?.[0] || null;
  const deadlineMatch = text.match(/Bid End Date\/Time[^\d]{0,80}(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{1,2}:\d{2})/i);
  let submissionDeadline = null;
  if (deadlineMatch) {
    const [day, month, year, hour, minute] = deadlineMatch[1].match(/\d+/g).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute) - (5 * 60 + 30) * 60 * 1000);
    if (!Number.isNaN(parsed.getTime())) submissionDeadline = parsed.toISOString();
  }
  const entityMatch = text.match(/Ministry\/State Name\s+([^\n\r]+)/i);
  const departmentMatch = text.match(/Department Name\s+([^\n\r]+)/i);
  const organisationMatch = text.match(/Organisation Name\s+([^\n\r]+)/i);
  const categoryMatch = text.match(/Item Category\s+([^\n\r]+)/i);
  return {
    reference,
    procuring_entity: [entityMatch?.[1], departmentMatch?.[1], organisationMatch?.[1]].filter(Boolean).join(" / ") || null,
    title: categoryMatch?.[1]?.trim() || null,
    bid_value_inr: amountAfterLabel(text, ["Estimated Bid Value", "Bid Value", "Total Bid Value"]),
    emd_inr: amountAfterLabel(text, ["Earnest Money Deposit (EMD)", "EMD Amount", "EMD"]),
    submission_deadline: submissionDeadline,
  };
}
export function detectMissingTenderAttachments(documents = []) {
  const text = documents.map((doc) => doc.text || "").join("\n").toLowerCase();
  const uploaded = documents.map((doc) => String(doc.document_type || "").toLowerCase());
  const missing = [];
  if (/boq detail document\s+view file|bill of quantity\s+view file/.test(text) && !uploaded.some((type) => type.includes("boq"))) {
    missing.push("BOQ attachment is referenced by the bid PDF but has not been uploaded.");
  }
  if (/specification document\s+view file/.test(text) && !uploaded.some((type) => type.includes("specification"))) {
    missing.push("Product technical specification attachment is referenced by the bid PDF but has not been uploaded.");
  }
  return missing;
}
