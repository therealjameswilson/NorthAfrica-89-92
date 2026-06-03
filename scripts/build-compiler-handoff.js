#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const LIVE_URL = "https://therealjameswilson.github.io/NorthAfrica-89-92/";
const OFFICIAL_URL = "https://history.state.gov/historicaldocuments/frus1989-92v20";
const VOLUME_TITLE = "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa";

const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");
const gapTracker = readJson("gap-tracker");
const sourcePools = readJson("source-pools");
const sourceCopyLedger = readJson("source-copy-ledger");
const sourceNotePacket = readJson("source-note-packet");
const researchRunbook = readJson("research-runbook");
const countryDossiers = readJson("country-dossiers");
const draftDocumentList = readJson("draft-document-list");
const publicationAssembly = readJson("publication-assembly-packet");
const documentReadiness = readJson("document-readiness-packet");
const blockerResolution = readJson("blocker-resolution-packet");
const documentStubs = readJson("document-stubs-packet");
const diaryControl = readJson("diary-control-packet");
const annotationLeads = readJson("annotation-leads-packet");
const decisionWorksheets = readJson("decision-worksheets");
const personsAuthority = readJson("persons-authority-packet");

const liveSections = [
  section("records", "Declassified Document Chronology", "Start here with dated Bush Library/NARA memcons, telcons, and release controls.", records.length),
  section("publication-assembly", "Publication Assembly", "Provisional TOC, numbering queue, chapter order, and holds before final placement.", publicationAssembly.summary?.assemblyRows),
  section("country-dossiers", "Country Dossiers", "Country-by-country desks with source gaps, query leads, and chronology coverage.", countryDossiers.summary?.dossierCount),
  section("draft-documents", "Draft Document List", "Proposed and conditional document rows grouped by chapter and selection posture.", draftDocumentList.summary?.proposedCount + draftDocumentList.summary?.conditionalCount),
  section("document-readiness", "Document Readiness", "Ready rows, authority-check rows, and blocked rows with source controls.", documentReadiness.summary?.documentCount),
  section("blocker-resolution", "Blocker Resolution", "Source-copy, declassification, and cross-volume action queues.", blockerResolution.summary?.blockerCount),
  section("document-stubs", "Compiler Stubs", "Per-document Markdown working files with source notes, diary controls, and decision fields.", documentStubs.summary?.stubCount),
  section("compiler-handoff", "Compiler Handoff", "One-screen start order, packets, links, and refresh commands.", null),
  section("diary-controls", "Daily Diary / Backup Controls", "Meeting and call controls for time, location, attendees, call status, and scheduling context.", diaryControl.summary?.controlRows),
  section("annotation-leads", "Annotation Leads", "Public-line, persons authority, diary, blocker, and source-note drafting checks.", annotationLeads.summary?.documentCount),
  section("compiler-brief", "Compiler Brief", "Queue-level overview for selection, source, and gap work.", null),
  section("source-note-packet", "Source Note Packet", "FRUS-style source notes, provenance rows, and diary/backup controls.", sourceNotePacket.summary?.sourceRows),
  section("research-runbook", "Research Runbook", "Gap-driven searches and archival routes.", researchRunbook.summary?.queryCount),
  section("decision-worksheets", "Decision Worksheets", "Editable CSV workbooks for selection and review decisions.", decisionWorksheets.summary?.worksheetCount),
  section("selection-matrix", "Selection Matrix", "Recommendation, risk, priority, and next action rows.", decisionWorksheets.summary?.selectionDecisionRows),
  section("workbench", "Compiler Desk", "Selection and boundary cockpit metrics.", null),
  section("gap-tracker", "Gap Tracker", "Unresolved source, authority, boundary, and coverage gaps.", gapTracker.length),
  section("source-pools", "Source Pools", "Next harvest queues and source pool priorities.", sourcePools.length),
  section("source-copy-ledger", "Source-Copy Ledger", "Markers, partials, and duplicate-copy leads.", sourceCopyLedger.length),
  section("chapters", "Research Lanes", "Geographic working structure for the volume.", null),
  section("policy-files", "Policy Files", "NSC, NSR, and NSD policy anchor files.", policyFiles.length),
  section("public-references", "Public Papers", "Public-line context checks and citations.", publicReferences.length),
  section("boundary", "Boundary Control", "Southern Africa and Somalia rows for adjacent-volume handoff.", boundaryRecords.length),
  section("sources", "Source Base", "Refresh and verification anchors.", null)
];

const packetLinks = [
  packet("Compiler handoff", "reports/compiler-handoff.md", "Use this as the first plain-text handoff for the volume.", null, ["reports/compiler-handoff-links.csv"], "#compiler-handoff"),
  packet("Publication assembly", "reports/publication-assembly-packet.md", "Use the provisional TOC and numbering queue after reviewing the chronology.", publicationAssembly.summary?.assemblyRows, publicationAssembly.summary?.csvFiles, "#publication-assembly"),
  packet("Document stubs", "reports/document-stubs-packet.md", "Open per-document working files and stub index before writing final document text.", documentStubs.summary?.stubCount, documentStubs.summary?.csvFiles, "#document-stubs"),
  packet("Daily Diary / Backup controls", "reports/diary-control-packet.md", "Verify meeting/call time, location, attendees, call status, and scheduling context from NAID 186322.", diaryControl.summary?.controlRows, diaryControl.summary?.csvFiles, "#diary-controls"),
  packet("Annotation leads", "reports/annotation-leads-packet.md", "Pair draft documents with public-line leads, persons authority flags, diary controls, blockers, and source notes.", annotationLeads.summary?.documentCount, annotationLeads.summary?.csvFiles, "#annotation-leads"),
  packet("Document readiness", "reports/document-readiness-packet.md", "Confirm first-pass ready rows, authority checks, and blockers.", documentReadiness.summary?.documentCount, documentReadiness.summary?.csvFiles, "#document-readiness"),
  packet("Blocker resolution", "reports/blocker-resolution-packet.md", "Work source-copy, declassification, and cross-volume queues.", blockerResolution.summary?.blockerCount, blockerResolution.summary?.csvFiles, "#blocker-resolution"),
  packet("Persons authority", "reports/persons-authority-packet.md", "Resolve persons list authority matches and review rows.", personsAuthority.summary?.personCount, personsAuthority.summary?.csvFiles, "persons.html#authority-packet"),
  packet("Source note packet", "reports/source-note-packet.md", "Copy FRUS-style source notes and check diary/backup controls.", sourceNotePacket.summary?.sourceRows, [], "#source-note-packet"),
  packet("Research runbook", "reports/research-runbook.md", "Run archival searches from critical and high-priority gap queries.", researchRunbook.summary?.queryCount, ["reports/research-runbook/all-gap-queries.csv", "reports/research-runbook/priority-gap-queries.csv"], "#research-runbook"),
  packet("Country dossiers", "reports/country-dossiers.md", "Review country coverage and targeted query leads.", countryDossiers.summary?.dossierCount, ["reports/country-dossiers/country-dossiers.csv", "reports/country-dossiers/country-searches.csv"], "#country-dossiers"),
  packet("Draft document list", "reports/draft-document-list.md", "Review proposed and conditional document lists by chapter.", draftDocumentList.summary?.proposedCount + draftDocumentList.summary?.conditionalCount, ["reports/draft-document-list/proposed-documents.csv", "reports/draft-document-list/conditional-documents.csv", "reports/draft-document-list/chapter-gaps.csv"], "#draft-documents"),
  packet("Decision worksheets", "reports/decision-worksheets.md", "Use CSV workbooks for compiler decision entry.", decisionWorksheets.summary?.worksheetCount, (decisionWorksheets.worksheets || []).map((worksheet) => worksheet.csvPath), "#decision-worksheets"),
  packet("Compiler brief", "reports/compiler-brief.md", "Read queue summaries and high-level selection posture.", null, [], "#compiler-brief"),
  packet("Gap audit", "reports/gap-audit.json", "Audit generated packet counts, source coverage, and section-order invariants.", null, [], "#gap-tracker")
];

const csvFiles = uniqueSorted(packetLinks.flatMap((item) => item.csvFiles || []));
const reportFiles = uniqueSorted(packetLinks.map((item) => item.href).filter((href) => href.startsWith("reports/")));
const readyForReadRows = documentReadiness.summary?.readyForReadCount || 0;
const readyWithAuthorityCheckRows = documentReadiness.summary?.readyWithAuthorityCheckCount || 0;
const blockerRows = blockerResolution.summary?.blockerCount || 0;

const refreshCommands = [
  "node scripts/harvest-volume20.js",
  "node scripts/build-diary-cross-references.js",
  "SOURCE_NOTE_SCAN_PDFS=1 node scripts/build-frus-source-notes.js",
  "node scripts/build-selection-matrix.js",
  "node scripts/build-compiler-brief.js",
  "node scripts/build-source-note-packet.js",
  "node scripts/build-decision-worksheets.js",
  "node scripts/build-research-runbook.js",
  "node scripts/build-country-dossiers.js",
  "node scripts/build-draft-document-list.js",
  "node scripts/build-document-readiness-packet.js",
  "node scripts/build-blocker-resolution-packet.js",
  "node scripts/build-document-stubs.js",
  "node scripts/build-diary-control-packet.js",
  "node scripts/build-annotation-leads-packet.js",
  "node scripts/build-publication-assembly-packet.js",
  "node scripts/build-gap-tracker.js",
  "BUSH_NAMES_DOCX=... node scripts/build-persons-list.js",
  "node scripts/build-persons-authority-packet.js",
  "node scripts/build-compiler-handoff.js",
  "npm run check",
  "npm run audit"
];

const summary = {
  chronologyRows: records.length,
  boundaryRows: boundaryRecords.length,
  policyFiles: policyFiles.length,
  publicReferences: publicReferences.length,
  proposedDocuments: draftDocumentList.summary?.proposedCount || 0,
  conditionalDocuments: draftDocumentList.summary?.conditionalCount || 0,
  assemblyRows: publicationAssembly.summary?.assemblyRows || 0,
  assemblyReadyToNumberRows: publicationAssembly.summary?.readyToNumberRows || 0,
  assemblyAuthorityRows: publicationAssembly.summary?.authorityCheckRows || 0,
  assemblyBlockerRows: publicationAssembly.summary?.blockerRows || 0,
  readinessRows: documentReadiness.summary?.documentCount || 0,
  readyForReadRows,
  readyWithAuthorityCheckRows,
  readyRows: readyForReadRows + readyWithAuthorityCheckRows,
  blockerRows,
  sourceCopyBlockers: blockerResolution.summary?.sourceCopyCount || 0,
  declassificationBlockers: blockerResolution.summary?.declassificationCount || 0,
  crossVolumeBlockers: blockerResolution.summary?.crossVolumeCount || 0,
  documentStubs: documentStubs.summary?.stubCount || 0,
  diaryControlRows: diaryControl.summary?.controlRows || 0,
  diaryControlMatchedRows: diaryControl.summary?.matchedRows || 0,
  diaryReferenceFiles: diaryControl.summary?.uniqueDiaryReferenceCount || 0,
  annotationRows: annotationLeads.summary?.documentCount || 0,
  directAnnotationRows: annotationLeads.summary?.documentsWithDirectPublicLeads || 0,
  contextOnlyAnnotationRows: annotationLeads.summary?.contextOnlyPublicLeadRows || 0,
  publicLineGapRows: annotationLeads.summary?.documentsWithoutPublicLeads || 0,
  sourceNoteRows: sourceNotePacket.summary?.sourceRows || 0,
  missingFrusSourceNotes: sourceNotePacket.summary?.missingFrusSourceNoteRows || 0,
  diaryMatchedRows: sourceNotePacket.summary?.diaryMatchedRows || 0,
  countryDossiers: countryDossiers.summary?.dossierCount || 0,
  runbookQueries: researchRunbook.summary?.queryCount || 0,
  decisionWorksheets: decisionWorksheets.summary?.worksheetCount || 0,
  personsRows: personsAuthority.summary?.personCount || 0,
  authorityReviewRows: personsAuthority.summary?.reviewCount || 0,
  authorityDocxEntries: personsAuthority.authority?.entryCount || 0,
  sectionCount: liveSections.length,
  packetCount: packetLinks.length,
  reportCount: reportFiles.length,
  csvCount: csvFiles.length
};

const startHere = [
  start(1, "Open the declassified chronology first", "#records", `${summary.chronologyRows} chronology rows are sorted by date and filterable by lane, country, release posture, and document availability.`),
  start(2, "Assemble provisional TOC", "#publication-assembly", `${summary.assemblyRows} rows are ordered by chapter, with ${summary.assemblyReadyToNumberRows} ready to number and ${summary.assemblyBlockerRows} holds separated.`),
  start(3, "Open the document stubs", "#document-stubs", `${summary.documentStubs} Markdown stubs carry FRUS-style source notes, diary/backup controls, authority flags, and blank compiler fields.`),
  start(4, "Clear readiness queues", "#document-readiness", `${summary.readyForReadRows} ready rows, ${summary.readyWithAuthorityCheckRows} authority-check rows, and ${summary.blockerRows} blockers are separated for review.`),
  start(5, "Resolve blockers by type", "#blocker-resolution", `${summary.sourceCopyBlockers} source-copy searches, ${summary.declassificationBlockers} declassification reviews, and ${summary.crossVolumeBlockers} cross-volume screens are itemized.`),
  start(6, "Check persons authority", "persons.html#authority-packet", `${summary.personsRows} persons are matched against ${summary.authorityDocxEntries} Bush names-list entries, with ${summary.authorityReviewRows} review rows.`),
  start(7, "Confirm Daily Diary / Backup controls", "#diary-controls", `${summary.diaryControlRows} meeting/call controls are matched to ${summary.diaryReferenceFiles} unique NAID 186322 diary/backup file units.`),
  start(8, "Open annotation leads", "#annotation-leads", `${summary.annotationRows} draft rows carry public-line, authority, diary, blocker, and source-note drafting checks.`),
  start(9, "Use source notes while drafting", "#source-note-packet", `${summary.sourceNoteRows} FRUS-style source-note rows are available, with ${summary.missingFrusSourceNotes} missing notes in the generated packet.`)
];

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: VOLUME_TITLE,
    url: OFFICIAL_URL,
    livePageUrl: LIVE_URL
  },
  summary,
  startHere,
  liveSections,
  packetLinks,
  csvFiles,
  reportFiles,
  refreshCommands,
  verificationCommands: ["npm run check", "npm run audit"],
  copyText: ""
};
packetBody.copyText = buildCopyText(packetBody);

const previous = readOptionalJson(path.join(dataDir, "compiler-handoff-packet.json"));
const packetData = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(reportDir, { recursive: true });
writeJsonPair("compiler-handoff-packet", "COMPILER_HANDOFF_PACKET", packetData);
fs.writeFileSync(path.join(reportDir, "compiler-handoff-links.csv"), toCsv(linkRows(packetData), ["label", "type", "href", "count", "use"]));
writeMarkdown(path.join(reportDir, "compiler-handoff.md"), packetData);
writeStableJson(path.join(reportDir, "compiler-handoff-build.json"), {
  chronologyRows: packetData.summary.chronologyRows,
  documentStubs: packetData.summary.documentStubs,
  assemblyRows: packetData.summary.assemblyRows,
  assemblyReadyToNumberRows: packetData.summary.assemblyReadyToNumberRows,
  assemblyAuthorityRows: packetData.summary.assemblyAuthorityRows,
  assemblyBlockerRows: packetData.summary.assemblyBlockerRows,
  diaryControlRows: packetData.summary.diaryControlRows,
  diaryReferenceFiles: packetData.summary.diaryReferenceFiles,
  annotationRows: packetData.summary.annotationRows,
  directAnnotationRows: packetData.summary.directAnnotationRows,
  contextOnlyAnnotationRows: packetData.summary.contextOnlyAnnotationRows,
  publicLineGapRows: packetData.summary.publicLineGapRows,
  readyForReadRows: packetData.summary.readyForReadRows,
  readyWithAuthorityCheckRows: packetData.summary.readyWithAuthorityCheckRows,
  blockerRows: packetData.summary.blockerRows,
  authorityReviewRows: packetData.summary.authorityReviewRows,
  sourceNoteRows: packetData.summary.sourceNoteRows,
  sectionCount: packetData.summary.sectionCount,
  packetCount: packetData.summary.packetCount,
  reportCount: packetData.summary.reportCount,
  csvCount: packetData.summary.csvCount,
  liveSectionIds: packetData.liveSections.map((item) => item.id),
  refreshCommandCount: packetData.refreshCommands.length,
  refreshCommands: packetData.refreshCommands,
  markdown: "reports/compiler-handoff.md",
  linksCsv: "reports/compiler-handoff-links.csv"
});

console.log(
  `Wrote compiler handoff: ${summary.sectionCount} sections, ${summary.packetCount} packets, ${summary.csvCount} CSV links, ${summary.documentStubs} stubs.`
);

function section(id, title, use, count) {
  return {
    id,
    title,
    href: `#${id}`,
    liveUrl: `${LIVE_URL}#${id}`,
    count: Number.isFinite(count) ? count : null,
    use
  };
}

function packet(title, href, use, count, csvFilesForPacket = [], anchor = "") {
  return {
    title,
    href,
    liveUrl: anchor ? absoluteUrl(anchor) : "",
    count: Number.isFinite(count) ? count : null,
    use,
    csvFiles: uniqueSorted(csvFilesForPacket.filter(Boolean))
  };
}

function start(step, title, href, detail) {
  return {
    step,
    title,
    href,
    liveUrl: absoluteUrl(href),
    detail
  };
}

function absoluteUrl(href) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith("persons.html")) return `${LIVE_URL}${href}`;
  if (href.startsWith("#")) return `${LIVE_URL}${href}`;
  return `${LIVE_URL}${href}`;
}

function buildCopyText(packet) {
  return [
    "# FRUS Volume XX Compiler Handoff",
    "",
    `Live chronology first: ${LIVE_URL}#records`,
    `Full live page: ${LIVE_URL}`,
    `Official volume: ${OFFICIAL_URL}`,
    "",
    "Current queues:",
    `- ${packet.summary.chronologyRows} chronology rows`,
    `- ${packet.summary.assemblyRows} publication assembly rows (${packet.summary.assemblyReadyToNumberRows} ready to number, ${packet.summary.assemblyAuthorityRows} authority-check, ${packet.summary.assemblyBlockerRows} holds)`,
    `- ${packet.summary.documentStubs} document stubs (${packet.summary.readyForReadRows} ready, ${packet.summary.readyWithAuthorityCheckRows} authority-check, ${packet.summary.blockerRows} blockers)`,
    `- ${packet.summary.diaryControlRows} Daily Diary/Backup controls matched to ${packet.summary.diaryReferenceFiles} file units`,
    `- ${packet.summary.annotationRows} annotation rows (${packet.summary.directAnnotationRows} direct public-line, ${packet.summary.contextOnlyAnnotationRows} context-only, ${packet.summary.publicLineGapRows} gaps)`,
    `- ${packet.summary.sourceNoteRows} FRUS-style source-note rows; ${packet.summary.missingFrusSourceNotes} missing notes`,
    `- ${packet.summary.personsRows} persons; ${packet.summary.authorityReviewRows} authority-review rows from the Bush names list`,
    `- ${packet.summary.runbookQueries} runbook queries and ${packet.summary.countryDossiers} country dossiers`,
    "",
    "Open next:",
    `- Handoff report: ${LIVE_URL}reports/compiler-handoff.md`,
    `- Publication assembly: ${LIVE_URL}reports/publication-assembly-packet.md`,
    `- Stub index: ${LIVE_URL}reports/document-stubs/document-stub-index.csv`,
    `- Diary controls: ${LIVE_URL}reports/diary-control-packet.md`,
    `- Annotation leads: ${LIVE_URL}reports/annotation-leads-packet.md`,
    `- Readiness packet: ${LIVE_URL}reports/document-readiness-packet.md`,
    `- Blocker packet: ${LIVE_URL}reports/blocker-resolution-packet.md`,
    `- Persons authority: ${LIVE_URL}persons.html#authority-packet`,
    "",
    "Refresh locally:",
    "node scripts/build-compiler-handoff.js",
    "npm run check",
    "npm run audit"
  ].join("\n");
}

function linkRows(packet) {
  return [
    ...packet.liveSections.map((item) => ({
      label: item.title,
      type: "Live section",
      href: item.liveUrl,
      count: item.count ?? "",
      use: item.use
    })),
    ...packet.packetLinks.map((item) => ({
      label: item.title,
      type: "Report packet",
      href: absoluteUrl(item.href),
      count: item.count ?? "",
      use: item.use
    })),
    ...packet.csvFiles.map((href) => ({
      label: path.basename(href),
      type: "CSV",
      href: absoluteUrl(href),
      count: "",
      use: "Download or edit this worksheet/report table."
    }))
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Compiler Handoff",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}`,
    `Start with the chronology: ${packet.volume.livePageUrl}#records`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Start Here",
    "",
    ...packet.startHere.map((item) => `${item.step}. [${item.title}](${item.liveUrl}) - ${item.detail}`),
    "",
    "## Current Counts",
    "",
    `- Chronology rows: ${packet.summary.chronologyRows}`,
    `- Proposed documents: ${packet.summary.proposedDocuments}`,
    `- Conditional documents: ${packet.summary.conditionalDocuments}`,
    `- Publication assembly rows: ${packet.summary.assemblyRows}`,
    `- Ready to number: ${packet.summary.assemblyReadyToNumberRows}`,
    `- Authority checks before numbering: ${packet.summary.assemblyAuthorityRows}`,
    `- Assembly holds: ${packet.summary.assemblyBlockerRows}`,
    `- Document stubs: ${packet.summary.documentStubs}`,
    `- Daily Diary/Backup control rows: ${packet.summary.diaryControlRows}`,
    `- Unique diary/backup file units: ${packet.summary.diaryReferenceFiles}`,
    `- Annotation rows: ${packet.summary.annotationRows}`,
    `- Direct public-line leads: ${packet.summary.directAnnotationRows}`,
    `- Context-only public-line rows: ${packet.summary.contextOnlyAnnotationRows}`,
    `- Public-line gaps: ${packet.summary.publicLineGapRows}`,
    `- Ready rows: ${packet.summary.readyForReadRows}`,
    `- Authority-check rows: ${packet.summary.readyWithAuthorityCheckRows}`,
    `- Blocker rows: ${packet.summary.blockerRows}`,
    `- Source-note rows: ${packet.summary.sourceNoteRows}`,
    `- Persons authority rows: ${packet.summary.personsRows}`,
    `- Authority-review rows: ${packet.summary.authorityReviewRows}`,
    `- Research runbook queries: ${packet.summary.runbookQueries}`,
    "",
    "## Live Sections",
    "",
    ...packet.liveSections.map((item) => `- [${item.title}](${item.liveUrl})${item.count === null ? "" : ` - ${item.count}`} - ${item.use}`),
    "",
    "## Report Packets",
    "",
    ...packet.packetLinks.map((item) => `- [${item.title}](${absoluteUrl(item.href)})${item.count === null ? "" : ` - ${item.count}`} - ${item.use}`),
    "",
    "## CSV Files",
    "",
    ...packet.csvFiles.map((href) => `- [${href}](${absoluteUrl(href)})`),
    "",
    "## Refresh Commands",
    "",
    "```sh",
    ...packet.refreshCommands,
    "```",
    "",
    "## Copy Handoff Text",
    "",
    "```text",
    packet.copyText,
    "```"
  ];
  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
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
