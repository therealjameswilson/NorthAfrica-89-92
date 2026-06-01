#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const reportPath = path.join(reportDir, "gap-audit.json");
const selectionReportPath = path.join(reportDir, "selection-matrix-build.json");
const compilerBriefReportPath = path.join(reportDir, "compiler-brief-build.json");
const sourceNotePacketReportPath = path.join(reportDir, "source-note-packet-build.json");
const decisionWorksheetsReportPath = path.join(reportDir, "decision-worksheets-build.json");
const researchRunbookReportPath = path.join(reportDir, "research-runbook-build.json");
const countryDossiersReportPath = path.join(reportDir, "country-dossiers-build.json");
const draftDocumentListReportPath = path.join(reportDir, "draft-document-list-build.json");

const meta = readJson("volume-meta.json");
const records = readJson("records.json");
const boundaryRecords = readJson("boundary-records.json");
const policyFiles = readJson("policy-files.json");
const publicReferences = readJson("public-references.json");
const persons = readJson("persons.json");
const gapTracker = readJson("gap-tracker.json");
const sourceCopyLedger = readJson("source-copy-ledger.json");
const selectionReport = readOptionalJson(selectionReportPath) || {};
const compilerBriefReport = readOptionalJson(compilerBriefReportPath) || {};
const sourceNotePacketReport = readOptionalJson(sourceNotePacketReportPath) || {};
const decisionWorksheetsReport = readOptionalJson(decisionWorksheetsReportPath) || {};
const researchRunbookReport = readOptionalJson(researchRunbookReportPath) || {};
const countryDossiersReport = readOptionalJson(countryDossiersReportPath) || {};
const draftDocumentListReport = readOptionalJson(draftDocumentListReportPath) || {};

const GAP_PERSON_TERMS = [
  "Babangida",
  "Baker",
  "Bashir",
  "Ben Ali",
  "Bendjedid",
  "Buyoya",
  "Diouf",
  "Doe",
  "Filali",
  "Gaddafi",
  "Gadhafi",
  "Habyarimana",
  "Hassan II",
  "Mengistu",
  "Mobutu",
  "Moi",
  "Museveni",
  "Qaddafi",
  "Qadhafi",
  "Taylor"
];

const personHaystacks = persons.map((person) =>
  normalize([person.name, person.displayName, person.entry, ...(person.aliases || [])].join(" "))
);

const chronologyParticipants = uniqueSorted(records.flatMap((record) => record.participants || []));
const boundaryParticipants = uniqueSorted(boundaryRecords.flatMap((record) => record.participants || []));
const gapText = JSON.stringify(gapTracker);
const gapPersonTerms = GAP_PERSON_TERMS.filter((term) => gapText.includes(term));
const unresolvedTerms = ["Abdelhamid"].filter((term) => gapText.includes(term));
const expectedSelectionMatrixCount = records.length + boundaryRecords.length + policyFiles.length + publicReferences.length;
const expectedSourceNotePacketCount = records.length + boundaryRecords.length + policyFiles.length;
const expectedCriticalGapCount = gapTracker.filter((gap) => gap.priority === "Critical").length;
const expectedCountryDossierCount = new Set((meta.chapters || []).flatMap((chapter) => chapter.countries || [])).size;
const expectedDraftProposedCount = (selectionReport.byRecommendation?.["Candidate core document"] || 0) + (selectionReport.byRecommendation?.["Policy anchor candidate"] || 0);
const expectedDraftConditionalCount =
  (selectionReport.byRecommendation?.["Source-copy search"] || 0) +
  (selectionReport.byRecommendation?.["Declassification review"] || 0) +
  (selectionReport.byRecommendation?.["Cross-volume review"] || 0);

const reportBody = {
  personsCount: persons.length,
  selectionMatrixCount: selectionReport.selectionCount || 0,
  expectedSelectionMatrixCount,
  compilerBriefSelectionCount: compilerBriefReport.selectionCount || 0,
  compilerBriefQueueCount: compilerBriefReport.queueCount || 0,
  compilerBriefSourceNoteRows: compilerBriefReport.sourceNoteRows || 0,
  sourceNotePacketCount: sourceNotePacketReport.sourceRows || 0,
  expectedSourceNotePacketCount,
  sourceNotePacketFrusSourceNoteRows: sourceNotePacketReport.frusSourceNoteRows || 0,
  sourceNotePacketGroupCount: sourceNotePacketReport.groupCount || 0,
  sourceNotePacketMissingFrusSourceNoteRows: sourceNotePacketReport.missingFrusSourceNoteRows || 0,
  decisionWorksheetCount: decisionWorksheetsReport.worksheetCount || 0,
  decisionWorksheetSelectionRows: decisionWorksheetsReport.selectionDecisionRows || 0,
  decisionWorksheetAuthorityReviewRows: decisionWorksheetsReport.authorityReviewRows || 0,
  decisionWorksheetCsvFiles: decisionWorksheetsReport.csvFiles || [],
  researchRunbookGapCount: researchRunbookReport.gapCount || 0,
  expectedResearchRunbookGapCount: gapTracker.length,
  researchRunbookCriticalGapCount: researchRunbookReport.criticalGapCount || 0,
  expectedResearchRunbookCriticalGapCount: expectedCriticalGapCount,
  researchRunbookQueryCount: researchRunbookReport.queryCount || 0,
  researchRunbookStateDepartmentQueryCount: researchRunbookReport.stateDepartmentQueryCount || 0,
  researchRunbookCsvFiles: researchRunbookReport.csvFiles || [],
  countryDossierCount: countryDossiersReport.dossierCount || 0,
  expectedCountryDossierCount,
  countryDossierNoChronologyCount: countryDossiersReport.noChronologyCountries || 0,
  countryDossierQueryRows: countryDossiersReport.queryRows || 0,
  countryDossierCsvFiles: countryDossiersReport.csvFiles || [],
  draftDocumentProposedCount: draftDocumentListReport.proposedCount || 0,
  expectedDraftDocumentProposedCount: expectedDraftProposedCount,
  draftDocumentConditionalCount: draftDocumentListReport.conditionalCount || 0,
  expectedDraftDocumentConditionalCount: expectedDraftConditionalCount,
  draftDocumentMissingSourceNoteCount: draftDocumentListReport.missingSourceNoteCount || 0,
  draftDocumentChapterCount: draftDocumentListReport.chapterCount || 0,
  draftDocumentCsvFiles: draftDocumentListReport.csvFiles || [],
  selectionMatrixByRecommendation: selectionReport.byRecommendation || {},
  sourceCopyLedgerCount: sourceCopyLedger.length,
  sourceCopyLedgerByIssue: countBy(sourceCopyLedger.map((item) => item.issueType)),
  missingChronologyParticipants: chronologyParticipants.filter((name) => !included(name)),
  missingBoundaryParticipants: boundaryParticipants.filter((name) => !included(name)),
  missingGapPersonTerms: gapPersonTerms.filter((term) => !included(term)),
  unresolvedPersonTargets: unresolvedTerms,
  personsNeedingAuthorityReview: persons
    .filter((person) => person.needsReview)
    .map((person) => ({
      name: person.name,
      entry: person.entry,
      reviewReason: person.reviewReason,
      scopes: person.scopes,
      aliases: person.aliases || []
    }))
};
const previousReport = readOptionalJson(reportPath);
const report = {
  generatedAt: sameReportBody(previousReport, reportBody) ? previousReport.generatedAt : new Date().toISOString(),
  ...reportBody
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const failures = [
  ...(report.selectionMatrixCount === report.expectedSelectionMatrixCount
    ? []
    : [`selection matrix count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.selectionMatrixCount}`]),
  ...(report.compilerBriefSelectionCount === report.expectedSelectionMatrixCount
    ? []
    : [`compiler brief selection count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.compilerBriefSelectionCount}`]),
  ...(report.compilerBriefQueueCount >= 7 ? [] : [`compiler brief queue count too low: found ${report.compilerBriefQueueCount}`]),
  ...(report.compilerBriefSourceNoteRows === report.expectedSelectionMatrixCount
    ? []
    : [`compiler brief source-note coverage mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.compilerBriefSourceNoteRows}`]),
  ...(report.sourceNotePacketCount === report.expectedSourceNotePacketCount
    ? []
    : [`source-note packet count mismatch: expected ${report.expectedSourceNotePacketCount}, found ${report.sourceNotePacketCount}`]),
  ...(report.sourceNotePacketFrusSourceNoteRows === report.expectedSourceNotePacketCount
    ? []
    : [
        `source-note packet FRUS note coverage mismatch: expected ${report.expectedSourceNotePacketCount}, found ${report.sourceNotePacketFrusSourceNoteRows}`
      ]),
  ...(report.sourceNotePacketGroupCount >= 6 ? [] : [`source-note packet group count too low: found ${report.sourceNotePacketGroupCount}`]),
  ...(report.sourceNotePacketMissingFrusSourceNoteRows === 0
    ? []
    : [`source-note packet has missing FRUS source notes: ${report.sourceNotePacketMissingFrusSourceNoteRows}`]),
  ...(report.decisionWorksheetCount >= 7 ? [] : [`decision worksheet count too low: found ${report.decisionWorksheetCount}`]),
  ...(report.decisionWorksheetSelectionRows === report.expectedSelectionMatrixCount
    ? []
    : [`decision worksheet selection count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.decisionWorksheetSelectionRows}`]),
  ...(report.decisionWorksheetAuthorityReviewRows === report.personsNeedingAuthorityReview.length
    ? []
    : [
        `decision worksheet authority-review count mismatch: expected ${report.personsNeedingAuthorityReview.length}, found ${report.decisionWorksheetAuthorityReviewRows}`
      ]),
  ...report.decisionWorksheetCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing decision worksheet CSV: ${filePath}`),
  ...(report.researchRunbookGapCount === report.expectedResearchRunbookGapCount
    ? []
    : [`research runbook gap count mismatch: expected ${report.expectedResearchRunbookGapCount}, found ${report.researchRunbookGapCount}`]),
  ...(report.researchRunbookCriticalGapCount === report.expectedResearchRunbookCriticalGapCount
    ? []
    : [
        `research runbook critical-gap count mismatch: expected ${report.expectedResearchRunbookCriticalGapCount}, found ${report.researchRunbookCriticalGapCount}`
      ]),
  ...(report.researchRunbookQueryCount >= report.expectedResearchRunbookGapCount
    ? []
    : [`research runbook query count too low: found ${report.researchRunbookQueryCount}`]),
  ...(report.researchRunbookStateDepartmentQueryCount > 0
    ? []
    : ["research runbook is missing State Department query rows"]),
  ...report.researchRunbookCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing research runbook CSV: ${filePath}`),
  ...(report.countryDossierCount >= report.expectedCountryDossierCount
    ? []
    : [`country dossier count mismatch: expected at least ${report.expectedCountryDossierCount}, found ${report.countryDossierCount}`]),
  ...(report.countryDossierQueryRows >= report.countryDossierNoChronologyCount
    ? []
    : [`country dossier query count too low: found ${report.countryDossierQueryRows}`]),
  ...report.countryDossierCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing country dossier CSV: ${filePath}`),
  ...(report.draftDocumentProposedCount === report.expectedDraftDocumentProposedCount
    ? []
    : [
        `draft document proposed count mismatch: expected ${report.expectedDraftDocumentProposedCount}, found ${report.draftDocumentProposedCount}`
      ]),
  ...(report.draftDocumentConditionalCount === report.expectedDraftDocumentConditionalCount
    ? []
    : [
        `draft document conditional count mismatch: expected ${report.expectedDraftDocumentConditionalCount}, found ${report.draftDocumentConditionalCount}`
      ]),
  ...(report.draftDocumentMissingSourceNoteCount === 0
    ? []
    : [`draft document list has missing FRUS source notes: ${report.draftDocumentMissingSourceNoteCount}`]),
  ...(report.draftDocumentChapterCount === (meta.chapters || []).length
    ? []
    : [`draft document chapter count mismatch: expected ${(meta.chapters || []).length}, found ${report.draftDocumentChapterCount}`]),
  ...report.draftDocumentCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing draft document CSV: ${filePath}`),
  ...report.missingChronologyParticipants.map((name) => `missing chronology participant: ${name}`),
  ...report.missingBoundaryParticipants.map((name) => `missing boundary participant: ${name}`),
  ...report.missingGapPersonTerms.map((name) => `missing gap person term: ${name}`),
  ...report.unresolvedPersonTargets.map((name) => `unresolved person target: ${name}`)
];

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Gap audit passed: ${persons.length} persons, ${report.selectionMatrixCount} selection rows, ${report.compilerBriefQueueCount} compiler brief queues, ${report.sourceNotePacketCount} source-note packet rows, ${report.decisionWorksheetCount} decision worksheets, ${report.researchRunbookQueryCount} research runbook queries, ${report.countryDossierCount} country dossiers, ${report.draftDocumentProposedCount} draft proposed rows, ${sourceCopyLedger.length} source-copy ledger rows, ${report.personsNeedingAuthorityReview.length} authority-review entries.`
);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameReportBody(previousReport, nextBody) {
  if (!previousReport) return false;
  const { generatedAt, ...previousBody } = previousReport;
  return JSON.stringify(previousBody) === JSON.stringify(nextBody);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function included(name) {
  const tokens = normalize(name)
    .split(/\s+/)
    .filter((token) => token.length > 1);
  return tokens.length > 0 && tokens.every((token) => personHaystacks.some((haystack) => haystack.includes(token)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
