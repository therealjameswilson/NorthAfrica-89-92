#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const assemblyDir = path.join(reportDir, "publication-assembly");

const meta = readJson("volume-meta");
const readiness = readJson("document-readiness-packet");
const stubs = readJson("document-stubs-packet");
const annotationLeads = readJson("annotation-leads-packet");
const diaryControls = readJson("diary-control-packet");

const laneOrder = new Map((meta.chapters || []).map((chapter, index) => [chapter.name, chapter.number || index + 1]));
const chapterByLane = new Map((meta.chapters || []).map((chapter, index) => [chapter.name, { ...chapter, number: chapter.number || index + 1 }]));
const stubByDraft = new Map((stubs.rows || []).map((row) => [String(row.draftNumber || ""), row]));
const annotationByDraft = new Map((annotationLeads.rows || []).map((row) => [String(row.draftNumber || ""), row]));
const diaryByDraft = new Map((diaryControls.rows || []).map((row) => [String(row.draftNumber || ""), row]).filter(([draftNumber]) => draftNumber));

const rows = (readiness.rows || []).map(assemblyRow).sort(assemblySort);
assignAssemblyNumbers(rows);
const proposedRows = rows.filter((row) => row.proposalStatus === "Proposed");
assignProposedNumbers(proposedRows);
const conditionalRows = rows.filter((row) => row.proposalStatus === "Conditional");
const readyToNumberRows = rows.filter((row) => row.assemblyStatus === "Ready to number");
const authorityRows = rows.filter((row) => row.assemblyStatus === "Number after authority check");
const blockerRows = rows.filter((row) => row.blockerType);
const chapterGroups = buildChapterGroups(rows);
const tocRows = proposedRows.map(tocRow);

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    assemblyRows: rows.length,
    proposedRows: proposedRows.length,
    conditionalRows: conditionalRows.length,
    readyToNumberRows: readyToNumberRows.length,
    authorityCheckRows: authorityRows.length,
    blockerRows: blockerRows.length,
    chapterCount: chapterGroups.length,
    sourceNoteRows: rows.filter((row) => row.frusSourceNote).length,
    diaryControlledRows: rows.filter((row) => row.diaryControlNumber).length,
    directPublicLeadRows: rows.filter((row) => row.publicLeadStatus === "Direct").length,
    publicLineGapRows: rows.filter((row) => row.publicLeadStatus === "Gap").length,
    csvFiles: [
      "reports/publication-assembly/all-publication-assembly.csv",
      "reports/publication-assembly/proposed-toc.csv",
      "reports/publication-assembly/ready-to-number.csv",
      "reports/publication-assembly/authority-checks.csv",
      "reports/publication-assembly/assembly-blockers.csv",
      "reports/publication-assembly/chapter-toc.csv"
    ]
  },
  readyToNumberRows,
  authorityRows,
  blockerRows,
  proposedRows,
  conditionalRows,
  tocRows,
  chapterGroups,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "publication-assembly-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(assemblyDir, { recursive: true });
writeJsonPair("publication-assembly-packet", "PUBLICATION_ASSEMBLY_PACKET", packet);
fs.writeFileSync(path.join(assemblyDir, "all-publication-assembly.csv"), toCsv(packet.rows.map(assemblyCsvRow), assemblyColumns()));
fs.writeFileSync(path.join(assemblyDir, "proposed-toc.csv"), toCsv(packet.tocRows, tocColumns()));
fs.writeFileSync(path.join(assemblyDir, "ready-to-number.csv"), toCsv(packet.readyToNumberRows.map(assemblyCsvRow), assemblyColumns()));
fs.writeFileSync(path.join(assemblyDir, "authority-checks.csv"), toCsv(packet.authorityRows.map(assemblyCsvRow), assemblyColumns()));
fs.writeFileSync(path.join(assemblyDir, "assembly-blockers.csv"), toCsv(packet.blockerRows.map(assemblyCsvRow), assemblyColumns()));
fs.writeFileSync(path.join(assemblyDir, "chapter-toc.csv"), toCsv(packet.chapterGroups.flatMap((group) => group.tocRows), tocColumns()));
writeMarkdown(path.join(reportDir, "publication-assembly-packet.md"), packet);
writeStableJson(path.join(reportDir, "publication-assembly-packet-build.json"), {
  assemblyRows: packet.summary.assemblyRows,
  proposedRows: packet.summary.proposedRows,
  conditionalRows: packet.summary.conditionalRows,
  readyToNumberRows: packet.summary.readyToNumberRows,
  authorityCheckRows: packet.summary.authorityCheckRows,
  blockerRows: packet.summary.blockerRows,
  chapterCount: packet.summary.chapterCount,
  sourceNoteRows: packet.summary.sourceNoteRows,
  diaryControlledRows: packet.summary.diaryControlledRows,
  directPublicLeadRows: packet.summary.directPublicLeadRows,
  publicLineGapRows: packet.summary.publicLineGapRows,
  markdown: "reports/publication-assembly-packet.md",
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote publication assembly: ${packet.summary.assemblyRows} rows, ${packet.summary.proposedRows} proposed, ${packet.summary.readyToNumberRows} ready to number.`
);

function assemblyRow(row) {
  const stub = stubByDraft.get(String(row.draftNumber || "")) || null;
  const annotation = annotationByDraft.get(String(row.draftNumber || "")) || null;
  const diary = diaryByDraft.get(String(row.draftNumber || "")) || null;
  const primaryPublicLead = primaryLead(annotation?.publicLeads || []);
  const chapter = chapterByLane.get(row.lane || "") || { number: 99, name: row.lane || "Unassigned", description: "" };
  const blockerType = annotation?.blockerType || firstBlocker(row.blockers || []);
  const assemblyStatus = statusFor(row, blockerType);
  return {
    id: row.id,
    assemblyNumber: "",
    provisionalTocNumber: "",
    tocLine: "",
    draftNumber: row.draftNumber || "",
    proposalStatus: row.proposalStatus || "",
    assemblyStatus,
    readinessStatus: row.readinessStatus || "",
    recommendation: row.recommendation || "",
    priority: row.priority || "",
    chapterNumber: chapter.number,
    chapter: chapter.name,
    chapterDescription: chapter.description || "",
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
    stubPath: stub?.stubPath || annotation?.stubPath || "",
    sourceNotePresent: Boolean(row.frusSourceNote || stub?.frusSourceNote || annotation?.frusSourceNote),
    frusSourceNote: row.frusSourceNote || stub?.frusSourceNote || annotation?.frusSourceNote || "",
    catalogProvenance: row.catalogProvenance || stub?.catalogProvenance || "",
    diaryControlNumber: diary?.controlNumber || annotation?.diaryControlNumber || "",
    diaryReferenceCount: diary?.diaryReferenceCount || annotation?.diaryReferenceCount || row.diaryReferenceCount || 0,
    diaryReferenceNaids: diary?.diaryReferenceNaids || annotation?.diaryReferenceNaids || (row.diaryReferences || []).map((reference) => reference.naid),
    diaryVerificationTargets: diary?.verificationTargets || annotation?.diaryVerificationTargets || [],
    publicLeadStatus: publicLeadStatus(annotation, primaryPublicLead),
    publicLeadCount: annotation?.publicLeadCount || 0,
    directPublicLeadCount: annotation?.directPublicLeadCount || 0,
    contextPublicLeadCount: annotation?.contextPublicLeadCount || 0,
    primaryPublicLead,
    annotationStatus: annotation?.annotationStatus || "",
    annotationChecklist: annotation?.annotationChecklist || [],
    authorityReviewCount: row.authorityReviewCount || annotation?.authorityReviewCount || 0,
    authorityReviewEntries: row.authorityReviewEntries || annotation?.authorityReviewEntries || [],
    blockerType,
    blockerAction: annotation?.blockerAction || row.nextAction || "",
    nextAction: nextActionFor(row, assemblyStatus, blockerType, annotation),
    decisionNeeded: row.decisionNeeded || "",
    basis: row.basis || ""
  };
}

function assignAssemblyNumbers(orderedRows) {
  orderedRows.forEach((row, index) => {
    row.assemblyNumber = `A-${String(index + 1).padStart(3, "0")}`;
  });
}

function assignProposedNumbers(orderedRows) {
  orderedRows.forEach((row, index) => {
    row.provisionalTocNumber = `P-${String(index + 1).padStart(3, "0")}`;
    row.tocLine = `${row.provisionalTocNumber}. ${row.title}${row.dateText ? `, ${row.dateText}` : ""}`;
  });
}

function buildChapterGroups(orderedRows) {
  return (meta.chapters || []).map((chapter, index) => {
    const chapterRows = orderedRows.filter((row) => row.chapter === chapter.name);
    const chapterProposed = chapterRows.filter((row) => row.proposalStatus === "Proposed");
    return {
      chapterNumber: chapter.number || index + 1,
      chapter: chapter.name,
      description: chapter.description || "",
      rowCount: chapterRows.length,
      proposedCount: chapterProposed.length,
      conditionalCount: chapterRows.filter((row) => row.proposalStatus === "Conditional").length,
      readyToNumberCount: chapterRows.filter((row) => row.assemblyStatus === "Ready to number").length,
      authorityCheckCount: chapterRows.filter((row) => row.assemblyStatus === "Number after authority check").length,
      blockerCount: chapterRows.filter((row) => row.blockerType).length,
      directPublicLeadCount: chapterRows.filter((row) => row.publicLeadStatus === "Direct").length,
      publicLineGapCount: chapterRows.filter((row) => row.publicLeadStatus === "Gap").length,
      tocRows: chapterProposed.map(tocRow),
      rows: chapterRows
    };
  });
}

function tocRow(row) {
  return {
    provisionalTocNumber: row.provisionalTocNumber,
    assemblyNumber: row.assemblyNumber,
    chapterNumber: row.chapterNumber,
    chapter: row.chapter,
    draftNumber: row.draftNumber,
    assemblyStatus: row.assemblyStatus,
    date: row.date,
    dateText: row.dateText,
    country: row.country,
    recordType: row.recordType,
    title: row.title,
    participants: (row.participants || []).join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    stubPath: row.stubPath,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    publicLeadStatus: row.publicLeadStatus,
    primaryPublicLeadTitle: row.primaryPublicLead?.title || "",
    sourceNotePresent: row.sourceNotePresent ? "Yes" : "No",
    diaryControlNumber: row.diaryControlNumber,
    nextAction: row.nextAction
  };
}

function assemblyCsvRow(row) {
  return {
    assemblyNumber: row.assemblyNumber,
    provisionalTocNumber: row.provisionalTocNumber,
    chapterNumber: row.chapterNumber,
    chapter: row.chapter,
    draftNumber: row.draftNumber,
    proposalStatus: row.proposalStatus,
    assemblyStatus: row.assemblyStatus,
    readinessStatus: row.readinessStatus,
    recommendation: row.recommendation,
    priority: row.priority,
    date: row.date,
    dateText: row.dateText,
    country: row.country,
    recordType: row.recordType,
    title: row.title,
    participants: (row.participants || []).join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    pageCount: row.pageCount,
    stubPath: row.stubPath,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    sourceNotePresent: row.sourceNotePresent ? "Yes" : "No",
    diaryControlNumber: row.diaryControlNumber,
    diaryReferenceCount: row.diaryReferenceCount,
    diaryReferenceNaids: (row.diaryReferenceNaids || []).join("; "),
    publicLeadStatus: row.publicLeadStatus,
    publicLeadCount: row.publicLeadCount,
    directPublicLeadCount: row.directPublicLeadCount,
    contextPublicLeadCount: row.contextPublicLeadCount,
    primaryPublicLeadTitle: row.primaryPublicLead?.title || "",
    primaryPublicLeadDate: row.primaryPublicLead?.dateText || row.primaryPublicLead?.date || "",
    primaryPublicLeadUrl: row.primaryPublicLead?.pdfUrl || row.primaryPublicLead?.govinfoUrl || "",
    authorityReviewCount: row.authorityReviewCount,
    authorityReviewEntries: (row.authorityReviewEntries || []).join("; "),
    blockerType: row.blockerType,
    nextAction: row.nextAction,
    decisionNeeded: row.decisionNeeded,
    basis: row.basis,
    frusSourceNote: row.frusSourceNote
  };
}

function assemblyColumns() {
  return [
    "assemblyNumber",
    "provisionalTocNumber",
    "chapterNumber",
    "chapter",
    "draftNumber",
    "proposalStatus",
    "assemblyStatus",
    "readinessStatus",
    "recommendation",
    "priority",
    "date",
    "dateText",
    "country",
    "recordType",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "pageCount",
    "stubPath",
    "catalogUrl",
    "pdfUrl",
    "sourceNotePresent",
    "diaryControlNumber",
    "diaryReferenceCount",
    "diaryReferenceNaids",
    "publicLeadStatus",
    "publicLeadCount",
    "directPublicLeadCount",
    "contextPublicLeadCount",
    "primaryPublicLeadTitle",
    "primaryPublicLeadDate",
    "primaryPublicLeadUrl",
    "authorityReviewCount",
    "authorityReviewEntries",
    "blockerType",
    "nextAction",
    "decisionNeeded",
    "basis",
    "frusSourceNote"
  ];
}

function tocColumns() {
  return [
    "provisionalTocNumber",
    "assemblyNumber",
    "chapterNumber",
    "chapter",
    "draftNumber",
    "assemblyStatus",
    "date",
    "dateText",
    "country",
    "recordType",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "stubPath",
    "catalogUrl",
    "pdfUrl",
    "publicLeadStatus",
    "primaryPublicLeadTitle",
    "sourceNotePresent",
    "diaryControlNumber",
    "nextAction"
  ];
}

function statusFor(row, blockerType) {
  if (blockerType) return `Hold: ${blockerType}`;
  if (row.readinessStatus === "Ready with authority check") return "Number after authority check";
  if (row.readinessStatus === "Ready for first-pass read") return "Ready to number";
  return row.readinessStatus || "Review before numbering";
}

function nextActionFor(row, assemblyStatus, blockerType, annotation) {
  if (assemblyStatus === "Ready to number") return "Assign provisional FRUS document number, read for substance, and decide full text versus excerpt.";
  if (assemblyStatus === "Number after authority check") return "Confirm persons-list authority form, then assign provisional FRUS document number.";
  if (blockerType === "Cross-volume ownership") return "Resolve owning volume before placing in the final Volume XX table of contents.";
  if (blockerType === "Source-copy search") return "Find or rule out duplicate source copy before final placement.";
  if (blockerType === "Declassification review") return "Resolve redaction/withdrawal issues before final placement.";
  return annotation?.nextAction || row.nextAction || row.decisionNeeded || "Review before final placement.";
}

function primaryLead(publicLeads) {
  return publicLeads.find((lead) => lead.leadType === "Direct") || publicLeads[0] || null;
}

function publicLeadStatus(annotation, primaryPublicLead) {
  if (!annotation || !primaryPublicLead) return "Gap";
  if (primaryPublicLead.leadType === "Direct") return "Direct";
  return "Context";
}

function firstBlocker(blockers) {
  return blockers.find((blocker) => blocker && blocker !== "Persons authority check") || "";
}

function assemblySort(a, b) {
  return (
    (laneOrder.get(a.chapter) || 99) - (laneOrder.get(b.chapter) || 99) ||
    String(a.sortDate || a.date || "").localeCompare(String(b.sortDate || b.date || "")) ||
    proposalRank(a.proposalStatus) - proposalRank(b.proposalStatus) ||
    String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function proposalRank(status) {
  if (status === "Proposed") return 1;
  if (status === "Conditional") return 2;
  return 9;
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# Publication Assembly Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    "",
    "Use this after the declassified chronology to assign provisional document numbers, review the draft table of contents, and decide which blocker rows can enter the final Volume XX assembly.",
    "",
    "## Summary",
    "",
    `- Assembly rows: ${packet.summary.assemblyRows}`,
    `- Proposed table-of-contents rows: ${packet.summary.proposedRows}`,
    `- Conditional/hold rows: ${packet.summary.conditionalRows}`,
    `- Ready to number: ${packet.summary.readyToNumberRows}`,
    `- Authority checks before numbering: ${packet.summary.authorityCheckRows}`,
    `- Blockers before assembly: ${packet.summary.blockerRows}`,
    `- Direct public-line leads: ${packet.summary.directPublicLeadRows}`,
    `- Public-line gaps: ${packet.summary.publicLineGapRows}`,
    "",
    "## CSV Files",
    "",
    ...packet.summary.csvFiles.map((file) => `- [${file}](${file.replace(/^reports\//, "")})`),
    "",
    "## Ready To Number",
    "",
    ...packet.readyToNumberRows.map((row) => `- ${row.assemblyNumber} / ${row.draftNumber}: ${row.title} (${row.dateText || row.date}) - ${row.nextAction}`),
    "",
    "## Proposed Table Of Contents",
    "",
    ...packet.chapterGroups.flatMap((group) => [
      `### Chapter ${group.chapterNumber}. ${group.chapter}`,
      "",
      ...(group.tocRows.length
        ? group.tocRows.map((row) => `- ${row.provisionalTocNumber}: ${row.title} (${row.dateText || row.date}) - ${row.assemblyStatus}`)
        : ["- No proposed rows yet."]),
      ""
    ]),
    "## Authority Checks",
    "",
    ...(packet.authorityRows.length
      ? packet.authorityRows.map((row) => `- ${row.assemblyNumber} / ${row.draftNumber}: ${row.title} - ${row.authorityReviewEntries.join("; ")}`)
      : ["- No authority checks before numbering."]),
    "",
    "## Assembly Blockers",
    "",
    ...packet.blockerRows.map((row) => `- ${row.assemblyNumber} / ${row.draftNumber}: ${row.blockerType} - ${row.title} (${row.dateText || row.date}) - ${row.nextAction}`)
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonPair(name, globalName, body) {
  writeStableJson(path.join(dataDir, `${name}.json`), body);
  fs.writeFileSync(path.join(dataDir, `${name}.js`), `window.${globalName} = ${JSON.stringify(body, null, 2)};\n`);
}

function writeStableJson(filePath, body) {
  fs.writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`);
}

function sameBody(previous, body) {
  if (!previous) return false;
  const { generatedAt, ...previousBody } = previous;
  return JSON.stringify(previousBody) === JSON.stringify(body);
}

function toCsv(rowsForCsv, columns) {
  return `${columns.join(",")}\n${rowsForCsv.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n")}\n`;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
