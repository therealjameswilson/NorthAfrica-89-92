#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const annotationReportDir = path.join(reportDir, "annotation-leads");

const readiness = readJson("document-readiness-packet");
const publicReferences = readJson("public-references");
const personsAuthority = readJson("persons-authority-packet");
const diaryControls = readJson("diary-control-packet");
const blockers = readJson("blocker-resolution-packet");
const stubs = readJson("document-stubs-packet");

const authorityByDraft = buildAuthorityByDraft(personsAuthority.persons || []);
const diaryByNaid = new Map((diaryControls.rows || []).map((row) => [String(row.naid || ""), row]));
const blockerByNaid = new Map((blockers.rows || []).map((row) => [String(row.naid || ""), row]));
const stubByDraft = new Map((stubs.rows || []).map((row) => [String(row.draftNumber || ""), row]));

const rows = (readiness.rows || []).map(annotationRow).sort(rowSort);
const publicLinkRows = rows.flatMap((row) => row.publicLeads.map((lead) => publicLinkRow(row, lead)));
const noPublicLeadRows = rows.filter((row) => !row.publicLeadCount);
const directPublicLeadRows = rows.filter((row) => row.directPublicLeadCount > 0);
const contextOnlyRows = rows.filter((row) => row.publicLeadCount > 0 && row.directPublicLeadCount === 0);
const authorityRows = rows.filter((row) => row.authorityReviewCount > 0);
const blockerRows = rows.filter((row) => row.blockerType);
const readyRows = rows.filter((row) => row.annotationStatus === "Ready annotation lead");
const uniquePublicReferenceCount = new Set(publicLinkRows.map((row) => row.publicReferenceId)).size;

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    documentCount: rows.length,
    publicReferencePoolCount: publicReferences.length,
    documentsWithPublicLeads: rows.filter((row) => row.publicLeadCount > 0).length,
    documentsWithDirectPublicLeads: directPublicLeadRows.length,
    contextOnlyPublicLeadRows: contextOnlyRows.length,
    documentsWithoutPublicLeads: noPublicLeadRows.length,
    publicReferenceLinkCount: publicLinkRows.length,
    uniquePublicReferenceCount,
    readyAnnotationRows: readyRows.length,
    authorityReviewRows: authorityRows.length,
    blockerRows: blockerRows.length,
    diaryControlledRows: rows.filter((row) => row.diaryControlNumber).length,
    sourceNoteRows: rows.filter((row) => row.frusSourceNote).length,
    csvFiles: [
      "reports/annotation-leads/all-annotation-leads.csv",
      "reports/annotation-leads/direct-public-leads.csv",
      "reports/annotation-leads/context-only-public-leads.csv",
      "reports/annotation-leads/public-line-links.csv",
      "reports/annotation-leads/no-public-line-leads.csv",
      "reports/annotation-leads/authority-annotation-leads.csv",
      "reports/annotation-leads/blocker-annotation-leads.csv"
    ]
  },
  readyRows,
  directPublicLeadRows,
  contextOnlyRows,
  noPublicLeadRows,
  authorityRows,
  blockerRows,
  publicLinkRows,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "annotation-leads-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(annotationReportDir, { recursive: true });
writeJsonPair("annotation-leads-packet", "ANNOTATION_LEADS_PACKET", packet);
fs.writeFileSync(path.join(annotationReportDir, "all-annotation-leads.csv"), toCsv(packet.rows.map(annotationCsvRow), annotationColumns()));
fs.writeFileSync(path.join(annotationReportDir, "direct-public-leads.csv"), toCsv(packet.directPublicLeadRows.map(annotationCsvRow), annotationColumns()));
fs.writeFileSync(path.join(annotationReportDir, "context-only-public-leads.csv"), toCsv(packet.contextOnlyRows.map(annotationCsvRow), annotationColumns()));
fs.writeFileSync(path.join(annotationReportDir, "public-line-links.csv"), toCsv(packet.publicLinkRows, publicLinkColumns()));
fs.writeFileSync(path.join(annotationReportDir, "no-public-line-leads.csv"), toCsv(packet.noPublicLeadRows.map(annotationCsvRow), annotationColumns()));
fs.writeFileSync(path.join(annotationReportDir, "authority-annotation-leads.csv"), toCsv(packet.authorityRows.map(annotationCsvRow), annotationColumns()));
fs.writeFileSync(path.join(annotationReportDir, "blocker-annotation-leads.csv"), toCsv(packet.blockerRows.map(annotationCsvRow), annotationColumns()));
writeMarkdown(path.join(reportDir, "annotation-leads-packet.md"), packet);
writeStableJson(path.join(reportDir, "annotation-leads-packet-build.json"), {
  documentCount: packet.summary.documentCount,
  publicReferencePoolCount: packet.summary.publicReferencePoolCount,
  documentsWithPublicLeads: packet.summary.documentsWithPublicLeads,
  documentsWithDirectPublicLeads: packet.summary.documentsWithDirectPublicLeads,
  contextOnlyPublicLeadRows: packet.summary.contextOnlyPublicLeadRows,
  documentsWithoutPublicLeads: packet.summary.documentsWithoutPublicLeads,
  publicReferenceLinkCount: packet.summary.publicReferenceLinkCount,
  uniquePublicReferenceCount: packet.summary.uniquePublicReferenceCount,
  readyAnnotationRows: packet.summary.readyAnnotationRows,
  authorityReviewRows: packet.summary.authorityReviewRows,
  blockerRows: packet.summary.blockerRows,
  diaryControlledRows: packet.summary.diaryControlledRows,
  sourceNoteRows: packet.summary.sourceNoteRows,
  markdown: "reports/annotation-leads-packet.md",
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote annotation leads: ${packet.summary.documentCount} documents, ${packet.summary.publicReferenceLinkCount} public-line links, ${packet.summary.documentsWithoutPublicLeads} public-line gaps.`
);

function annotationRow(row) {
  const publicLeads = publicReferences
    .map((reference) => publicLead(row, reference))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || Math.abs(a.daysFromDocument) - Math.abs(b.daysFromDocument) || a.title.localeCompare(b.title))
    .slice(0, 5);
  const authorityLinks = authorityByDraft.get(String(row.draftNumber || "")) || [];
  const authorityReviewLinks = authorityLinks.filter((link) => link.needsReview === "Yes");
  const diaryControl = diaryByNaid.get(String(row.naid || "")) || null;
  const blocker = blockerByNaid.get(String(row.naid || "")) || null;
  const stub = stubByDraft.get(String(row.draftNumber || "")) || null;
  const directPublicLeadCount = publicLeads.filter((lead) => lead.leadType === "Direct").length;
  const annotationStatus = statusFor(row, publicLeads, authorityReviewLinks, blocker);
  return {
    id: row.id,
    draftNumber: row.draftNumber || "",
    annotationStatus,
    proposalStatus: row.proposalStatus || "",
    recommendation: row.recommendation || "",
    priority: row.priority || "",
    readinessStatus: row.readinessStatus || "",
    lane: row.lane || "",
    country: row.country || "",
    date: row.date || "",
    sortDate: row.sortDate || row.date || "",
    dateText: row.dateText || "",
    recordType: row.recordType || "",
    title: row.title || "",
    participants: row.participants || [],
    releaseStatus: row.releaseStatus || "",
    naid: row.naid || "",
    catalogUrl: row.catalogUrl || "",
    pdfUrl: row.pdfUrl || "",
    pageCount: row.pageCount || "",
    stubPath: stub?.stubPath || "",
    publicLeadCount: publicLeads.length,
    directPublicLeadCount,
    contextPublicLeadCount: publicLeads.length - directPublicLeadCount,
    publicLeads,
    authorityReviewCount: authorityReviewLinks.length,
    authorityReviewEntries: authorityReviewLinks.map((link) => link.entry).sort(),
    authorityMatchedCount: authorityLinks.filter((link) => link.needsReview !== "Yes").length,
    diaryControlNumber: diaryControl?.controlNumber || "",
    diaryReferenceCount: diaryControl?.diaryReferenceCount || row.diaryReferenceCount || 0,
    diaryReferenceNaids: diaryControl?.diaryReferenceNaids || (row.diaryReferences || []).map((reference) => reference.naid),
    diaryVerificationTargets: diaryControl?.verificationTargets || [],
    blockerType: blocker?.resolutionType || "",
    blockerAction: blocker?.nextAction || blocker?.handoffNote || "",
    frusSourceNote: row.frusSourceNote || "",
    nextAction: nextActionFor(row, publicLeads, authorityReviewLinks, blocker),
    annotationChecklist: checklistFor(row, publicLeads, authorityReviewLinks, diaryControl, blocker)
  };
}

function publicLead(row, reference) {
  const rowTerms = termsForRow(row);
  const referenceHaystack = normalize(
    [reference.title, reference.chapter, reference.documentType, reference.citation, reference.sourceNote, ...(reference.matchedTerms || [])].join(" ")
  );
  const countryTerm = normalize(row.country || "");
  const countryMatch = countryTerm && referenceHaystack.includes(countryTerm);
  const participantMatches = rowTerms.participants.filter((term) => referenceHaystack.includes(term));
  const laneMatch = normalize(reference.chapter || "") === normalize(row.lane || "");
  const daysFromDocument = daysBetween(row.date, reference.date);
  const nearDate = Number.isFinite(daysFromDocument) && Math.abs(daysFromDocument) <= 30;
  const broadDate = Number.isFinite(daysFromDocument) && Math.abs(daysFromDocument) <= 120;
  const score =
    (countryMatch ? 50 : 0) +
    (participantMatches.length ? 35 : 0) +
    (laneMatch ? 15 : 0) +
    (nearDate ? 15 : broadDate ? 6 : 0) +
    (reference.govinfoUrl || reference.pdfUrl ? 2 : 0);

  if (!countryMatch && !participantMatches.length && !(laneMatch && broadDate) && !nearDate) return null;

  const relation = [
    countryMatch ? "country" : "",
    participantMatches.length ? "participant" : "",
    laneMatch ? "lane" : "",
    nearDate ? "near-date" : broadDate ? "same-season" : ""
  ]
    .filter(Boolean)
    .join("; ");

  return {
    id: reference.id || "",
    title: reference.title || "",
    date: reference.date || "",
    dateText: reference.dateText || reference.date || "",
    documentType: reference.documentType || "",
    chapter: reference.chapter || "",
    relation,
    leadType: countryMatch || participantMatches.length ? "Direct" : "Context",
    matchedTerms: reference.matchedTerms || [],
    participantMatches,
    daysFromDocument: Number.isFinite(daysFromDocument) ? daysFromDocument : "",
    score,
    govinfoUrl: reference.govinfoUrl || "",
    pdfUrl: reference.pdfUrl || "",
    pageRange: reference.pageRange || "",
    frusSourceNote: reference.frusSourceNote || reference.sourceNote || reference.citation || ""
  };
}

function termsForRow(row) {
  return {
    country: normalize(row.country || ""),
    participants: (row.participants || [])
      .flatMap((participant) => participantTerms(participant))
      .map(normalize)
      .filter((term) => term.length > 3 && !["george", "bush", "president", "minister", "foreign", "secretary"].includes(term))
  };
}

function participantTerms(name) {
  return String(name || "")
    .replace(/\b(George|H|W|President|Prime|Minister|King|Secretary|Foreign|Dr|General|Sir|II|III|IV)\b/gi, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

function statusFor(row, publicLeads, authorityReviewLinks, blocker) {
  if (blocker) return "Blocked annotation lead";
  if (authorityReviewLinks.length) return "Authority-check annotation lead";
  if (publicLeads.some((lead) => lead.leadType === "Direct")) return "Ready annotation lead";
  if (publicLeads.length) return "Context-only annotation lead";
  return "Public-line gap";
}

function nextActionFor(row, publicLeads, authorityReviewLinks, blocker) {
  if (blocker?.resolutionType === "Cross-volume ownership") return "Resolve owning volume before drafting annotations; preserve public-line and diary context for handoff if excluded.";
  if (blocker?.resolutionType === "Source-copy search") return "Find or rule out duplicate source copy before drafting final annotation or chronology-only note.";
  if (blocker?.resolutionType === "Declassification review") return "Resolve declassification limits and use public-line leads only for context until text is cleared.";
  if (authorityReviewLinks.length) return "Resolve persons authority entries before final annotation text.";
  if (publicLeads.some((lead) => lead.leadType === "Direct")) return "Compare direct public-line lead(s) against the private document and draft annotation/cross-reference notes.";
  if (publicLeads.length) return "Use context-only public references as background and run a targeted public-line search by country, counterpart, date, and policy terms.";
  return "Run a targeted Public Papers/GovInfo search by country, counterpart, date, and policy terms before final annotation review.";
}

function checklistFor(row, publicLeads, authorityReviewLinks, diaryControl, blocker) {
  const hasDirectLead = publicLeads.some((lead) => lead.leadType === "Direct");
  return [
    hasDirectLead
      ? "Compare direct Public Papers lead(s) against private document substance."
      : publicLeads.length
        ? "Treat current Public Papers lead(s) as context and run a targeted public-line search."
        : "Search Public Papers/GovInfo for a public-line lead.",
    diaryControl ? "Verify diary/backup time, location, attendees, call status, and scheduling context." : "Confirm diary/backup control coverage.",
    authorityReviewLinks.length ? "Resolve persons authority review entries." : "Confirm persons list forms after reading the text.",
    blocker ? `Resolve ${blocker.resolutionType}.` : "Decide full text, excerpt, editorial note, or exclusion.",
    "Carry the FRUS source note into the final document stub."
  ];
}

function buildAuthorityByDraft(persons) {
  const links = new Map();
  for (const person of persons) {
    for (const link of person.documentLinks || []) {
      if (link.context !== "Draft" || !link.draftNumber) continue;
      if (!links.has(link.draftNumber)) links.set(link.draftNumber, []);
      links.get(link.draftNumber).push({
        personId: person.id,
        entry: person.entry || "",
        name: person.name || "",
        needsReview: link.needsReview || (person.needsReview ? "Yes" : "No"),
        reviewPriority: person.reviewPriority || "",
        reviewReason: person.reviewReason || "",
        nextAction: person.nextAction || ""
      });
    }
  }
  for (const [draftNumber, draftLinks] of links.entries()) {
    links.set(draftNumber, uniqueBy(draftLinks, (link) => link.personId).sort((a, b) => a.entry.localeCompare(b.entry)));
  }
  return links;
}

function publicLinkRow(row, lead) {
  return {
    draftNumber: row.draftNumber,
    annotationStatus: row.annotationStatus,
    date: row.date,
    dateText: row.dateText,
    lane: row.lane,
    country: row.country,
    title: row.title,
    naid: row.naid,
    publicReferenceId: lead.id,
    publicReferenceTitle: lead.title,
    publicReferenceDate: lead.date,
    publicReferenceType: lead.documentType,
    leadType: lead.leadType,
    relation: lead.relation,
    score: lead.score,
    daysFromDocument: lead.daysFromDocument,
    matchedTerms: lead.matchedTerms.join("; "),
    participantMatches: lead.participantMatches.join("; "),
    publicUrl: lead.pdfUrl || lead.govinfoUrl,
    publicSourceNote: lead.frusSourceNote,
    privateSourceNote: row.frusSourceNote
  };
}

function annotationCsvRow(row) {
  return {
    draftNumber: row.draftNumber,
    annotationStatus: row.annotationStatus,
    proposalStatus: row.proposalStatus,
    recommendation: row.recommendation,
    priority: row.priority,
    readinessStatus: row.readinessStatus,
    lane: row.lane,
    country: row.country,
    date: row.date,
    dateText: row.dateText,
    recordType: row.recordType,
    title: row.title,
    participants: row.participants.join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    stubPath: row.stubPath,
    publicLeadCount: row.publicLeadCount,
    directPublicLeadCount: row.directPublicLeadCount,
    contextPublicLeadCount: row.contextPublicLeadCount,
    firstPublicLead: row.publicLeads[0]?.title || "",
    firstPublicLeadType: row.publicLeads[0]?.leadType || "",
    firstPublicLeadDate: row.publicLeads[0]?.date || "",
    firstPublicLeadRelation: row.publicLeads[0]?.relation || "",
    firstPublicLeadUrl: row.publicLeads[0]?.pdfUrl || row.publicLeads[0]?.govinfoUrl || "",
    authorityReviewCount: row.authorityReviewCount,
    authorityReviewEntries: row.authorityReviewEntries.join("; "),
    diaryControlNumber: row.diaryControlNumber,
    diaryReferenceCount: row.diaryReferenceCount,
    diaryReferenceNaids: row.diaryReferenceNaids.join("; "),
    blockerType: row.blockerType,
    nextAction: row.nextAction,
    annotationChecklist: row.annotationChecklist.join("; "),
    frusSourceNote: row.frusSourceNote
  };
}

function annotationColumns() {
  return [
    "draftNumber",
    "annotationStatus",
    "proposalStatus",
    "recommendation",
    "priority",
    "readinessStatus",
    "lane",
    "country",
    "date",
    "dateText",
    "recordType",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "catalogUrl",
    "pdfUrl",
    "stubPath",
    "publicLeadCount",
    "directPublicLeadCount",
    "contextPublicLeadCount",
    "firstPublicLead",
    "firstPublicLeadType",
    "firstPublicLeadDate",
    "firstPublicLeadRelation",
    "firstPublicLeadUrl",
    "authorityReviewCount",
    "authorityReviewEntries",
    "diaryControlNumber",
    "diaryReferenceCount",
    "diaryReferenceNaids",
    "blockerType",
    "nextAction",
    "annotationChecklist",
    "frusSourceNote"
  ];
}

function publicLinkColumns() {
  return [
    "draftNumber",
    "annotationStatus",
    "date",
    "dateText",
    "lane",
    "country",
    "title",
    "naid",
    "publicReferenceId",
    "publicReferenceTitle",
    "publicReferenceDate",
    "publicReferenceType",
    "leadType",
    "relation",
    "score",
    "daysFromDocument",
    "matchedTerms",
    "participantMatches",
    "publicUrl",
    "publicSourceNote",
    "privateSourceNote"
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Annotation Leads",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}#annotation-leads`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Draft documents: ${packet.summary.documentCount}`,
    `- Documents with public-line leads: ${packet.summary.documentsWithPublicLeads}`,
    `- Documents with direct public-line leads: ${packet.summary.documentsWithDirectPublicLeads}`,
    `- Context-only public-line rows: ${packet.summary.contextOnlyPublicLeadRows}`,
    `- Documents without current public-line leads: ${packet.summary.documentsWithoutPublicLeads}`,
    `- Public-line links: ${packet.summary.publicReferenceLinkCount}`,
    `- Unique public references linked: ${packet.summary.uniquePublicReferenceCount}`,
    `- Authority-review rows: ${packet.summary.authorityReviewRows}`,
    `- Blocker rows: ${packet.summary.blockerRows}`,
    "",
    "## CSV Worklists",
    "",
    ...packet.summary.csvFiles.map((file) => `- [${file}](${file.replace(/^reports\//, "")})`),
    "",
    "## Ready Annotation Leads",
    "",
    ...packet.readyRows.slice(0, 20).map(markdownRow),
    "",
    "## Context-Only Public-Line Leads",
    "",
    ...packet.contextOnlyRows.slice(0, 30).map(markdownRow),
    "",
    "## Public-Line Gaps",
    "",
    ...packet.noPublicLeadRows.slice(0, 30).map(markdownRow),
    "",
    "## Authority / Blocker Annotation Checks",
    "",
    ...uniqueBy(packet.authorityRows.concat(packet.blockerRows), (row) => row.draftNumber).slice(0, 30).map(markdownRow)
  ];
  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function markdownRow(row) {
  const href = row.stubPath || row.catalogUrl || "";
  const firstLead = row.publicLeads[0] ? ` Public lead: ${row.publicLeads[0].title}.` : "";
  return `- [${row.draftNumber} - ${row.title}](${href.replace(/^reports\//, "")}) - ${row.dateText}; ${row.country}; ${row.annotationStatus}.${firstLead}`;
}

function rowSort(a, b) {
  return (a.sortDate || "").localeCompare(b.sortDate || "") || a.draftNumber.localeCompare(b.draftNumber);
}

function daysBetween(a, b) {
  if (!a || !b) return NaN;
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return NaN;
  return Math.round((second - first) / 86400000);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueBy(values, getter) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = getter(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}

function writeStableJson(filePath, body) {
  const previous = readOptionalJson(filePath);
  const report = {
    generatedAt: sameBody(previous, body) ? previous.generatedAt : new Date().toISOString(),
    ...body
  };
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

function sameBody(previous, nextBody) {
  if (!previous) return false;
  const { generatedAt, ...previousBody } = previous;
  return JSON.stringify(previousBody) === JSON.stringify(nextBody);
}

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
