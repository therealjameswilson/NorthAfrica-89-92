#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildSelectionMatrix, countBy, priorityRank, recommendationRank } = require("./selection-matrix-core");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const worksheetDir = path.join(reportDir, "worksheets");

const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");
const persons = readJson("persons");
const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });
const authorityRows = persons.filter((person) => person.needsReview).sort((a, b) => (a.sortKey || a.name).localeCompare(b.sortKey || b.name));

const worksheetSpecs = [
  {
    id: "all-selection-decisions",
    title: "All Selection Decisions",
    description: "Every chronology, policy, boundary, and public-line row with blank compiler decision fields.",
    rows: matrix,
    kind: "selection"
  },
  {
    id: "core-selection-decisions",
    title: "Core Selection Decisions",
    description: "Candidate core documents and policy anchors for read/select/excerpt decisions.",
    rows: matrix.filter((row) => ["Candidate core document", "Policy anchor candidate"].includes(row.recommendation)),
    kind: "selection"
  },
  {
    id: "source-copy-searches",
    title: "Source-Copy Searches",
    description: "No-memorandum and missing-source rows requiring duplicate-copy searches or confirmation.",
    rows: matrix.filter((row) => row.recommendation === "Source-copy search"),
    kind: "selection"
  },
  {
    id: "declassification-review",
    title: "Declassification Review",
    description: "Partial and restricted releases requiring withdrawal-sheet, MDR/referral, or duplicate-copy decisions.",
    rows: matrix.filter((row) => row.recommendation === "Declassification review"),
    kind: "selection"
  },
  {
    id: "cross-volume-boundary",
    title: "Cross-Volume and Boundary Decisions",
    description: "Egypt, Gulf, Arab-Israeli, terrorism, Southern Africa, and Somalia ownership/handoff rows.",
    rows: matrix.filter((row) => ["Cross-volume review", "Boundary handoff"].includes(row.recommendation)),
    kind: "selection"
  },
  {
    id: "public-line-context",
    title: "Public-Line Context Decisions",
    description: "Public Papers rows for pairing public posture with private source candidates.",
    rows: matrix.filter((row) => row.recommendation === "Public-line/context check"),
    kind: "selection"
  },
  {
    id: "persons-authority-review",
    title: "Persons Authority Review",
    description: "Names that still need authority-form confirmation before a published persons list.",
    rows: authorityRows,
    kind: "authority"
  }
];

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(worksheetDir, { recursive: true });

const worksheets = worksheetSpecs.map((spec) => buildWorksheet(spec));
const body = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    worksheetCount: worksheets.length,
    selectionDecisionRows: matrix.length,
    authorityReviewRows: authorityRows.length,
    worksheetRows: worksheets.reduce((sum, worksheet) => sum + worksheet.count, 0),
    byRecommendation: countBy(matrix.map((row) => row.recommendation)),
    byPriority: countBy(matrix.map((row) => row.priority))
  },
  worksheets
};
const previous = readOptionalJson(path.join(dataDir, "decision-worksheets.json"));
const generatedAt = sameBody(previous, body) ? previous.generatedAt : new Date().toISOString();
const packet = { generatedAt, ...body };

writeJsonPair("decision-worksheets", "DECISION_WORKSHEETS", packet);
writeStableJson(path.join(reportDir, "decision-worksheets-build.json"), {
  worksheetCount: packet.summary.worksheetCount,
  selectionDecisionRows: packet.summary.selectionDecisionRows,
  authorityReviewRows: packet.summary.authorityReviewRows,
  worksheetRows: packet.summary.worksheetRows,
  csvFiles: packet.worksheets.map((worksheet) => worksheet.csvPath)
});
writeMarkdown(path.join(reportDir, "decision-worksheets.md"), packet);

console.log(
  `Wrote ${packet.summary.worksheetCount} decision worksheets: ${packet.summary.selectionDecisionRows} selection rows, ${packet.summary.authorityReviewRows} authority rows.`
);

function buildWorksheet(spec) {
  const rows = spec.kind === "authority" ? spec.rows.map(authorityWorksheetRow) : spec.rows.sort(rowSort).map(selectionWorksheetRow);
  const csvPath = `reports/worksheets/${spec.id}.csv`;
  fs.writeFileSync(path.join(repoRoot, csvPath), toCsv(rows, columnsFor(spec.kind)));
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    kind: spec.kind,
    count: rows.length,
    csvPath,
    previewRows: rows.slice(0, 5)
  };
}

function selectionWorksheetRow(row) {
  return {
    decisionStatus: "",
    finalDecision: "",
    owningVolume: suggestedOwner(row),
    selectionNumber: "",
    excerptDecision: "",
    sourceCopyStatus: row.recommendation === "Source-copy search" ? "Needs source-copy search" : "",
    declassificationStatus: row.recommendation === "Declassification review" ? "Needs declassification review" : "",
    authorityStatus: "",
    compilerNotes: "",
    recommendation: row.recommendation,
    priority: row.priority,
    compilerNumber: row.compilerNumber || "",
    date: row.date || "",
    dateText: row.dateText || "",
    lane: row.lane || "",
    country: row.country || "",
    recordType: row.recordType || "",
    title: row.title || "",
    participants: (row.participants || []).join("; "),
    releaseStatus: row.releaseStatus || "",
    naid: row.naid || "",
    catalogUrl: row.catalogUrl || "",
    pdfUrl: row.pdfUrl || "",
    flags: (row.flags || []).join("; "),
    basis: row.basis || "",
    nextAction: row.nextAction || "",
    frusSourceNote: row.frusSourceNote || "",
    catalogProvenance: row.sourceNote || "",
    diaryReferences: formatDiaryReferences(row)
  };
}

function authorityWorksheetRow(person) {
  return {
    decisionStatus: "",
    finalAuthorityForm: person.displayName || person.name || "",
    finalEntry: person.entry || "",
    authoritySource: "",
    compilerNotes: "",
    name: person.name || "",
    displayName: person.displayName || "",
    description: person.description || "",
    scopes: (person.scopes || []).join("; "),
    places: (person.places || []).join("; "),
    aliases: (person.aliases || []).join("; "),
    currentEntry: person.entry || "",
    currentAuthorityStatus: person.authorityStatus || "",
    reviewReason: person.reviewReason || "",
    source: person.source || ""
  };
}

function columnsFor(kind) {
  if (kind === "authority") {
    return [
      "decisionStatus",
      "finalAuthorityForm",
      "finalEntry",
      "authoritySource",
      "compilerNotes",
      "name",
      "displayName",
      "description",
      "scopes",
      "places",
      "aliases",
      "currentEntry",
      "currentAuthorityStatus",
      "reviewReason",
      "source"
    ];
  }
  return [
    "decisionStatus",
    "finalDecision",
    "owningVolume",
    "selectionNumber",
    "excerptDecision",
    "sourceCopyStatus",
    "declassificationStatus",
    "authorityStatus",
    "compilerNotes",
    "recommendation",
    "priority",
    "compilerNumber",
    "date",
    "dateText",
    "lane",
    "country",
    "recordType",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "catalogUrl",
    "pdfUrl",
    "flags",
    "basis",
    "nextAction",
    "frusSourceNote",
    "catalogProvenance",
    "diaryReferences"
  ];
}

function suggestedOwner(row) {
  if (row.recommendation === "Boundary handoff") return "Adjacent volume";
  if (row.recommendation === "Cross-volume review") return "Needs ownership decision";
  if (row.recommendation === "Public-line/context check") return "Context only";
  return "Volume XX";
}

function formatDiaryReferences(row) {
  return (row.diaryReferences || [])
    .map((reference) => `${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`)
    .join("; ");
}

function rowSort(a, b) {
  return (
    recommendationRank(a.recommendation) - recommendationRank(b.recommendation) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    (a.lane || "").localeCompare(b.lane || "") ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Decision Worksheets",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Worksheets",
    "",
    ...packet.worksheets.flatMap((worksheet) => [
      `- ${worksheet.title}: ${worksheet.count} rows`,
      `  - ${worksheet.description}`,
      `  - CSV: ${reportRelativePath(worksheet.csvPath)}`
    ]),
    ""
  ];

  for (const worksheet of packet.worksheets) {
    lines.push(`## ${worksheet.title}`, "", worksheet.description, "", `CSV: ${reportRelativePath(worksheet.csvPath)}`, "");
    for (const row of worksheet.previewRows) {
      lines.push(`- ${row.title || row.name}: ${row.nextAction || row.reviewReason || row.description || "Review."}`);
    }
    lines.push("");
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function reportRelativePath(filePath) {
  return filePath.replace(/^reports\//, "");
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

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
