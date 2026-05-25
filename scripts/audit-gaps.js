#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const records = readJson("records.json");
const boundaryRecords = readJson("boundary-records.json");
const persons = readJson("persons.json");
const gapTracker = readJson("gap-tracker.json");
const sourceCopyLedger = readJson("source-copy-ledger.json");

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

const report = {
  generatedAt: new Date().toISOString(),
  personsCount: persons.length,
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

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, "gap-audit.json"), `${JSON.stringify(report, null, 2)}\n`);

const failures = [
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
  `Gap audit passed: ${persons.length} persons, ${sourceCopyLedger.length} source-copy ledger rows, ${report.personsNeedingAuthorityReview.length} authority-review entries.`
);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
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
