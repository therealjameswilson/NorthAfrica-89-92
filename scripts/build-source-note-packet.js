#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildSelectionMatrix, countBy, priorityRank, recommendationRank } = require("./selection-matrix-core");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");
const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });
const sourceRows = matrix
  .filter((item) => item.recommendation !== "Public-line/context check")
  .sort(rowSort)
  .map(cleanRow);
const rowsMissingFrusSourceNote = sourceRows.filter((row) => !row.frusSourceNote);

const groupSpecs = [
  {
    recommendation: "Candidate core document",
    title: "Candidate Core Documents",
    description: "Likely Volume XX selections that should receive first-pass reading and excerpt decisions."
  },
  {
    recommendation: "Policy anchor candidate",
    title: "Policy Anchor Candidates",
    description: "NSC, NSR, and NSD policy-file anchors that can organize chapters and source-pool searches."
  },
  {
    recommendation: "Source-copy search",
    title: "Source-Copy Search Packet",
    description: "No-memorandum markers and missing-source rows for duplicate-copy searches and confirmation."
  },
  {
    recommendation: "Declassification review",
    title: "Declassification Review Packet",
    description: "Partial or restricted rows for withdrawal-sheet review, MDR/referral, and duplicate-copy checks."
  },
  {
    recommendation: "Cross-volume review",
    title: "Cross-Volume Review Packet",
    description: "Egypt, Gulf, Arab-Israeli, and terrorism overlap rows that need ownership decisions before selection."
  },
  {
    recommendation: "Boundary handoff",
    title: "Boundary Handoff Packet",
    description: "Southern Africa, Somalia, and other adjacent-volume rows retained for handoff control."
  }
];

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    sourceRows: sourceRows.length,
    frusSourceNoteRows: sourceRows.filter((row) => row.frusSourceNote).length,
    diaryMatchedRows: sourceRows.filter((row) => row.diaryReferences?.length).length,
    sourceCopySearchRows: sourceRows.filter((row) => row.recommendation === "Source-copy search").length,
    declassificationReviewRows: sourceRows.filter((row) => row.recommendation === "Declassification review").length,
    boundaryRows: sourceRows.filter((row) => row.recommendation === "Boundary handoff").length,
    missingFrusSourceNoteRows: rowsMissingFrusSourceNote.length,
    byRecommendation: countBy(sourceRows.map((row) => row.recommendation)),
    byPriority: countBy(sourceRows.map((row) => row.priority)),
    byRecordType: countBy(sourceRows.map((row) => row.recordType))
  },
  groups: groupSpecs.map((spec) => {
    const rows = sourceRows.filter((row) => row.recommendation === spec.recommendation);
    return {
      id: slug(spec.title),
      recommendation: spec.recommendation,
      title: spec.title,
      description: spec.description,
      count: rows.length,
      sourceNoteText: rows.map((row) => row.frusSourceNote || row.sourceNote || "").filter(Boolean).join("\n\n"),
      rows
    };
  })
};

const previousPacket = readOptionalJson(path.join(dataDir, "source-note-packet.json"));
const generatedAt = sameBody(previousPacket, packetBody) ? previousPacket.generatedAt : new Date().toISOString();
const packet = { generatedAt, ...packetBody };

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
writeJsonPair("source-note-packet", "SOURCE_NOTE_PACKET", packet);
writeStableJson(path.join(reportDir, "source-note-packet-build.json"), {
  sourceRows: packet.summary.sourceRows,
  frusSourceNoteRows: packet.summary.frusSourceNoteRows,
  diaryMatchedRows: packet.summary.diaryMatchedRows,
  groupCount: packet.groups.length,
  missingFrusSourceNoteRows: packet.summary.missingFrusSourceNoteRows,
  byRecommendation: packet.summary.byRecommendation
});
writeMarkdown(path.join(reportDir, "source-note-packet.md"), packet);

if (rowsMissingFrusSourceNote.length) {
  console.error(`Missing FRUS source notes for ${rowsMissingFrusSourceNote.length} packet rows.`);
  process.exit(1);
}

console.log(`Wrote source-note packet: ${sourceRows.length} source rows, ${packet.groups.length} groups.`);

function cleanRow(item) {
  return compact({
    id: item.id,
    compilerNumber: item.compilerNumber,
    recommendation: item.recommendation,
    priority: item.priority,
    recordType: item.recordType,
    lane: item.lane,
    country: item.country,
    date: item.date,
    sortDate: item.sortDate,
    dateText: item.dateText,
    title: item.title,
    participants: item.participants || [],
    releaseStatus: item.releaseStatus,
    naid: item.naid,
    catalogUrl: item.catalogUrl,
    pdfUrl: item.pdfUrl,
    flags: item.flags || [],
    basis: item.basis,
    nextAction: item.nextAction,
    frusSourceNote: item.frusSourceNote,
    sourceNote: item.sourceNote,
    diaryReferences: (item.diaryReferences || []).map((reference) =>
      compact({
        kind: reference.kind,
        title: reference.title,
        naid: reference.naid,
        catalogUrl: reference.catalogUrl,
        sourceNote: reference.sourceNote
      })
    ),
    diaryCrossReferenceNote: item.diaryCrossReferenceNote
  });
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
    "# FRUS Volume XX Source Note Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Source rows: ${packet.summary.sourceRows}`,
    `- FRUS source notes: ${packet.summary.frusSourceNoteRows}`,
    `- Diary/backup matches: ${packet.summary.diaryMatchedRows}`,
    `- Source-copy search rows: ${packet.summary.sourceCopySearchRows}`,
    `- Declassification review rows: ${packet.summary.declassificationReviewRows}`,
    `- Boundary rows: ${packet.summary.boundaryRows}`,
    "",
    "## Queue Counts",
    "",
    ...packet.groups.map((group) => `- ${group.title}: ${group.count}`)
  ];

  for (const group of packet.groups) {
    lines.push("", `## ${group.title}`, "", group.description, "");
    for (const row of group.rows) {
      lines.push(
        `### ${row.compilerNumber || "n/a"} - ${row.dateText || row.date || "Undated"} - ${row.title}`,
        "",
        `- Recommendation: ${row.recommendation}`,
        `- Priority: ${row.priority}`,
        `- Lane: ${row.lane || "n/a"}`,
        `- Country: ${row.country || "n/a"}`,
        `- Record type: ${row.recordType || "n/a"}`,
        `- Release status: ${row.releaseStatus || "n/a"}`,
        `- NAID: ${row.naid || "n/a"}`,
        `- Catalog: ${row.catalogUrl || "n/a"}`,
        `- PDF: ${row.pdfUrl || "n/a"}`,
        `- Basis: ${row.basis || "n/a"}`,
        `- Next action: ${row.nextAction || "n/a"}`,
        `- FRUS source note: ${row.frusSourceNote}`,
        `- Catalog provenance: ${row.sourceNote || "n/a"}`
      );
      if (row.diaryReferences?.length) {
        lines.push(
          "- Diary/backup control:",
          ...row.diaryReferences.map(
            (reference) => `  - ${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`
          )
        );
      }
      lines.push("");
    }
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
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

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return entry !== "" && entry !== null && entry !== undefined;
    })
  );
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
