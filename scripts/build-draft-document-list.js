#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildSelectionMatrix, countBy, priorityRank, recommendationRank } = require("./selection-matrix-core");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const draftDir = path.join(reportDir, "draft-document-list");

const meta = readJson("volume-meta");
const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");
const gapTracker = readJson("gap-tracker");
const countryDossiers = readJson("country-dossiers");
const laneOrder = new Map((meta.chapters || []).map((chapter, index) => [chapter.name, index + 1]));

const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });
const sourceRows = matrix
  .filter((row) => row.recommendation !== "Boundary handoff" && row.recommendation !== "Public-line/context check")
  .sort(documentSort)
  .map(cleanDraftRow);
const proposedRows = sourceRows.filter((row) => row.proposalStatus === "Proposed");
const conditionalRows = sourceRows.filter((row) => row.proposalStatus === "Conditional");
assignDraftNumbers(proposedRows, "D");
assignDraftNumbers(conditionalRows, "C");

const chapterGroups = buildChapterGroups();
const chapterGapRows = chapterGroups.flatMap((group) =>
  group.openGaps.map((gap) => ({
    lane: group.lane,
    priority: gap.priority,
    title: gap.title,
    evidence: gap.evidence,
    needed: gap.needed,
    nextActions: (gap.nextActions || []).join("; ")
  }))
);

const body = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    proposedCount: proposedRows.length,
    conditionalCount: conditionalRows.length,
    sourceNoteCount: sourceRows.filter((row) => row.frusSourceNote).length,
    missingSourceNoteCount: sourceRows.filter((row) => !row.frusSourceNote).length,
    sourceCopyBlockers: sourceRows.filter((row) => row.recommendation === "Source-copy search").length,
    declassificationBlockers: sourceRows.filter((row) => row.recommendation === "Declassification review").length,
    crossVolumeScreens: sourceRows.filter((row) => row.recommendation === "Cross-volume review").length,
    chapterCount: chapterGroups.length,
    byRecommendation: countBy(sourceRows.map((row) => row.recommendation)),
    byLane: countBy(sourceRows.map((row) => row.lane || "Unassigned"))
  },
  proposedRows,
  conditionalRows,
  chapterGroups
};

const previous = readOptionalJson(path.join(dataDir, "draft-document-list.json"));
const generatedAt = sameBody(previous, body) ? previous.generatedAt : new Date().toISOString();
const packet = { generatedAt, ...body };

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(draftDir, { recursive: true });

writeJsonPair("draft-document-list", "DRAFT_DOCUMENT_LIST", packet);
writeStableJson(path.join(reportDir, "draft-document-list-build.json"), {
  proposedCount: packet.summary.proposedCount,
  conditionalCount: packet.summary.conditionalCount,
  sourceNoteCount: packet.summary.sourceNoteCount,
  missingSourceNoteCount: packet.summary.missingSourceNoteCount,
  sourceCopyBlockers: packet.summary.sourceCopyBlockers,
  declassificationBlockers: packet.summary.declassificationBlockers,
  crossVolumeScreens: packet.summary.crossVolumeScreens,
  chapterCount: packet.summary.chapterCount,
  csvFiles: [
    "reports/draft-document-list/proposed-documents.csv",
    "reports/draft-document-list/conditional-documents.csv",
    "reports/draft-document-list/chapter-gaps.csv"
  ]
});
writeMarkdown(path.join(reportDir, "draft-document-list.md"), packet);
writeCsv(path.join(draftDir, "proposed-documents.csv"), proposedRows.map(draftCsvRow), draftColumns());
writeCsv(path.join(draftDir, "conditional-documents.csv"), conditionalRows.map(draftCsvRow), draftColumns());
writeCsv(path.join(draftDir, "chapter-gaps.csv"), chapterGapRows, ["lane", "priority", "title", "evidence", "needed", "nextActions"]);

if (packet.summary.missingSourceNoteCount) {
  console.error(`Draft document list has ${packet.summary.missingSourceNoteCount} rows without FRUS source notes.`);
  process.exit(1);
}

console.log(`Wrote draft document list: ${proposedRows.length} proposed rows, ${conditionalRows.length} conditional rows.`);

function cleanDraftRow(row) {
  const proposalStatus = proposedRecommendations().includes(row.recommendation) ? "Proposed" : "Conditional";
  return compact({
    id: row.id,
    draftNumber: "",
    proposalStatus,
    editorialStatus: editorialStatus(row),
    recommendation: row.recommendation,
    priority: row.priority,
    recordType: row.recordType,
    lane: row.lane,
    country: row.country,
    date: row.date,
    sortDate: row.sortDate,
    dateText: row.dateText,
    title: row.title,
    participants: row.participants || [],
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    pageCount: row.pageCount || 0,
    basis: row.basis,
    decisionNeeded: decisionNeeded(row),
    frusSourceNote: row.frusSourceNote,
    sourceNote: row.sourceNote,
    diaryReferences: (row.diaryReferences || []).map((reference) =>
      compact({
        kind: reference.kind,
        title: reference.title,
        naid: reference.naid,
        catalogUrl: reference.catalogUrl,
        sourceNote: reference.sourceNote
      })
    ),
    diaryCrossReferenceNote: row.diaryCrossReferenceNote
  });
}

function proposedRecommendations() {
  return ["Candidate core document", "Policy anchor candidate"];
}

function editorialStatus(row) {
  if (row.recommendation === "Candidate core document") return "Proposed core document";
  if (row.recommendation === "Policy anchor candidate") return "Proposed policy anchor";
  if (row.recommendation === "Source-copy search") return "Conditional: source-copy search";
  if (row.recommendation === "Declassification review") return "Conditional: declassification review";
  if (row.recommendation === "Cross-volume review") return "Conditional: cross-volume ownership";
  return "Conditional";
}

function decisionNeeded(row) {
  if (row.recommendation === "Candidate core document") return "Read for substance, assign final document number, and decide full text versus excerpt.";
  if (row.recommendation === "Policy anchor candidate") return "Open file, identify citable memoranda or briefing papers, and decide document/excerpt scope.";
  if (row.recommendation === "Source-copy search") return "Find duplicate source copy or confirm no memorandum exists before selection.";
  if (row.recommendation === "Declassification review") return "Review redactions and withdrawal evidence before selection or MDR/referral.";
  if (row.recommendation === "Cross-volume review") return "Assign owning volume and retain only Africa-specific substance for Volume XX.";
  return row.nextAction || "";
}

function assignDraftNumbers(rows, prefix) {
  rows.forEach((row, index) => {
    row.draftNumber = `${prefix}-${String(index + 1).padStart(3, "0")}`;
  });
}

function buildChapterGroups() {
  const lanes = (meta.chapters || []).map((chapter) => chapter.name);
  return lanes.map((lane) => {
    const proposed = proposedRows.filter((row) => row.lane === lane);
    const conditional = conditionalRows.filter((row) => row.lane === lane);
    const openGaps = gapTracker.filter((gap) => gap.lane === lane || gap.lane === "All lanes").sort(gapSort).map(cleanGap).slice(0, 5);
    const countryDossierRows = (countryDossiers.dossiers || []).filter((dossier) => (dossier.lanes || []).includes(lane));
    const missingCountries = countryDossierRows
      .filter((dossier) => dossier.chronologyRows === 0 || /Missing-source|No chronology|Source-base gap/.test(dossier.coverageStatus || ""))
      .map((dossier) =>
        compact({
          country: dossier.country,
          coverageStatus: dossier.coverageStatus,
          chronologyRows: dossier.chronologyRows,
          runbookQueryCount: dossier.runbookQueryCount,
          gapCount: dossier.gapCount,
          nextAction: dossier.nextActions?.[0] || ""
        })
      )
      .slice(0, 8);

    return {
      lane,
      proposedCount: proposed.length,
      conditionalCount: conditional.length,
      sourceCopyBlockers: conditional.filter((row) => row.recommendation === "Source-copy search").length,
      declassificationBlockers: conditional.filter((row) => row.recommendation === "Declassification review").length,
      crossVolumeScreens: conditional.filter((row) => row.recommendation === "Cross-volume review").length,
      proposedRows: proposed.slice(0, 8),
      conditionalRows: conditional.slice(0, 8),
      missingCountries,
      openGaps
    };
  });
}

function cleanGap(gap) {
  return compact({
    id: gap.id,
    priority: gap.priority,
    status: gap.status,
    lane: gap.lane,
    title: gap.title,
    evidence: gap.evidence,
    needed: gap.needed,
    nextActions: gap.nextActions || []
  });
}

function draftCsvRow(row) {
  return {
    draftNumber: row.draftNumber,
    proposalStatus: row.proposalStatus,
    editorialStatus: row.editorialStatus,
    recommendation: row.recommendation,
    priority: row.priority,
    lane: row.lane,
    country: row.country || "",
    date: row.date,
    dateText: row.dateText,
    recordType: row.recordType,
    title: row.title,
    participants: (row.participants || []).join("; "),
    releaseStatus: row.releaseStatus || "",
    naid: row.naid || "",
    catalogUrl: row.catalogUrl || "",
    pdfUrl: row.pdfUrl || "",
    pageCount: row.pageCount || 0,
    decisionNeeded: row.decisionNeeded,
    basis: row.basis,
    frusSourceNote: row.frusSourceNote,
    diaryReferences: formatDiaryReferences(row)
  };
}

function draftColumns() {
  return [
    "draftNumber",
    "proposalStatus",
    "editorialStatus",
    "recommendation",
    "priority",
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
    "pageCount",
    "decisionNeeded",
    "basis",
    "frusSourceNote",
    "diaryReferences"
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Draft Document List",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Proposed rows: ${packet.summary.proposedCount}`,
    `- Conditional rows: ${packet.summary.conditionalCount}`,
    `- FRUS source notes: ${packet.summary.sourceNoteCount}`,
    `- Missing source notes: ${packet.summary.missingSourceNoteCount}`,
    `- Source-copy blockers: ${packet.summary.sourceCopyBlockers}`,
    `- Declassification blockers: ${packet.summary.declassificationBlockers}`,
    `- Cross-volume screens: ${packet.summary.crossVolumeScreens}`,
    "",
    "## CSV Outputs",
    "",
    "- draft-document-list/proposed-documents.csv",
    "- draft-document-list/conditional-documents.csv",
    "- draft-document-list/chapter-gaps.csv",
    "",
    "## Proposed Documents",
    ""
  ];

  for (const row of packet.proposedRows) lines.push(...markdownRow(row));
  lines.push("## Conditional Documents", "");
  for (const row of packet.conditionalRows) lines.push(...markdownRow(row));
  lines.push("## Chapter Boards", "");
  for (const group of packet.chapterGroups) {
    lines.push(
      `### ${group.lane}`,
      "",
      `- Proposed rows: ${group.proposedCount}`,
      `- Conditional rows: ${group.conditionalCount}`,
      `- Source-copy blockers: ${group.sourceCopyBlockers}`,
      `- Declassification blockers: ${group.declassificationBlockers}`,
      `- Cross-volume screens: ${group.crossVolumeScreens}`
    );
    if (group.missingCountries.length) {
      lines.push("- Missing/weak country coverage:");
      for (const country of group.missingCountries) {
        lines.push(`  - ${country.country}: ${country.coverageStatus}; ${country.runbookQueryCount || 0} query rows`);
      }
    }
    if (group.openGaps.length) {
      lines.push("- Open gaps:");
      for (const gap of group.openGaps) lines.push(`  - ${gap.priority}: ${gap.title}`);
    }
    lines.push("");
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function markdownRow(row) {
  const lines = [
    `### ${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`,
    "",
    `- Editorial status: ${row.editorialStatus}`,
    `- Recommendation: ${row.recommendation}`,
    `- Lane: ${row.lane || "n/a"}`,
    `- Country: ${row.country || "n/a"}`,
    `- Record type: ${row.recordType || "n/a"}`,
    `- Release status: ${row.releaseStatus || "n/a"}`,
    `- NAID: ${row.naid || "n/a"}`,
    `- Catalog: ${row.catalogUrl || "n/a"}`,
    `- PDF: ${row.pdfUrl || "n/a"}`,
    `- Decision needed: ${row.decisionNeeded}`,
    `- Basis: ${row.basis}`,
    `- FRUS source note: ${row.frusSourceNote}`
  ];
  if (row.diaryReferences?.length) {
    lines.push(
      "- Diary/backup control:",
      ...row.diaryReferences.map((reference) => `  - ${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`)
    );
  }
  lines.push("");
  return lines;
}

function documentSort(a, b) {
  return (
    proposalRank(a.recommendation) - proposalRank(b.recommendation) ||
    laneRank(a.lane) - laneRank(b.lane) ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    recommendationRank(a.recommendation) - recommendationRank(b.recommendation) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function proposalRank(recommendation) {
  return (
    {
      "Candidate core document": 1,
      "Policy anchor candidate": 2,
      "Source-copy search": 3,
      "Declassification review": 4,
      "Cross-volume review": 5
    }[recommendation] || 99
  );
}

function gapSort(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || laneRank(a.lane) - laneRank(b.lane) || (a.title || "").localeCompare(b.title || "");
}

function laneRank(lane) {
  return laneOrder.get(lane) || 99;
}

function formatDiaryReferences(row) {
  return (row.diaryReferences || []).map((reference) => `${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`).join("; ");
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

function writeCsv(filePath, rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n");
  fs.writeFileSync(filePath, `${header}\n${body}\n`);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameBody(previous, nextBody) {
  if (!previous) return false;
  const { generatedAt, ...previousBody } = previous;
  return JSON.stringify(previousBody) === JSON.stringify(nextBody);
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return entry !== "" && entry !== null && entry !== undefined;
    })
  );
}
