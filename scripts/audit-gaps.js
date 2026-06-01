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
  `Gap audit passed: ${persons.length} persons, ${report.selectionMatrixCount} selection rows, ${report.compilerBriefQueueCount} compiler brief queues, ${report.sourceNotePacketCount} source-note packet rows, ${sourceCopyLedger.length} source-copy ledger rows, ${report.personsNeedingAuthorityReview.length} authority-review entries.`
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
