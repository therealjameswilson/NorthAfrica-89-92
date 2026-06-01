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
const gapTracker = readJson("gap-tracker");
const sourcePools = readJson("source-pools");
const sourceCopyLedger = readJson("source-copy-ledger");

const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });
const recommendationCounts = countBy(matrix.map((item) => item.recommendation));
const priorityCounts = countBy(matrix.map((item) => item.priority));
const diaryMatchedRows = records.concat(boundaryRecords).filter((record) => record.diaryReferences?.length).length;
const sourceNoteRows = matrix.filter((item) => item.frusSourceNote || item.sourceNote).length;
const criticalGapCount = gapTracker.filter((gap) => gap.priority === "Critical").length;
const sourceCopySearchCount = recommendationCounts["Source-copy search"] || 0;
const declassificationReviewCount = recommendationCounts["Declassification review"] || 0;

const briefBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    chronologyRows: records.length,
    boundaryRows: boundaryRecords.length,
    policyFiles: policyFiles.length,
    publicReferences: publicReferences.length,
    selectionRows: matrix.length,
    sourceNoteRows,
    diaryMatchedRows,
    gapItems: gapTracker.length,
    criticalGaps: criticalGapCount,
    sourceCopyLedgerRows: sourceCopyLedger.length,
    sourceCopySearchRows: sourceCopySearchCount,
    declassificationReviewRows: declassificationReviewCount,
    byRecommendation: recommendationCounts,
    byPriority: priorityCounts
  },
  startHere: buildStartHere(),
  queues: buildQueues(),
  criticalGaps: gapTracker.filter((gap) => gap.priority === "Critical").map(cleanGap),
  activeSourcePools: sourcePools
    .filter((pool) => ["Active", "Missing", "Next"].includes(pool.priority))
    .sort(sourcePoolSort)
    .map(cleanSourcePool)
};

const previousBrief = readOptionalJson(path.join(dataDir, "compiler-brief.json"));
const generatedAt = sameBriefBody(previousBrief, briefBody) ? previousBrief.generatedAt : new Date().toISOString();
const compilerBrief = { generatedAt, ...briefBody };

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
writeJsonPair("compiler-brief", "COMPILER_BRIEF", compilerBrief);
writeStableJson(path.join(reportDir, "compiler-brief-build.json"), {
  selectionCount: matrix.length,
  queueCount: compilerBrief.queues.length,
  startHereCount: compilerBrief.startHere.length,
  criticalGapCount,
  sourceNoteRows,
  diaryMatchedRows,
  byRecommendation: recommendationCounts
});
writeMarkdown(path.join(reportDir, "compiler-brief.md"), compilerBrief);

console.log(
  `Wrote compiler brief: ${compilerBrief.startHere.length} start-here actions, ${compilerBrief.queues.length} queues, ${matrix.length} matrix rows.`
);

function buildStartHere() {
  return [
    {
      id: "read-core-candidates",
      metric: String(recommendationCounts["Candidate core document"] || 0),
      label: "core rows",
      title: "Read likely Volume XX document candidates",
      body: "Begin with non-boundary, non-Egypt-overlap conversation records that already have declassified source notes and most often diary/backup confirmation.",
      actionLabel: "Open core candidates",
      targetRecommendation: "Candidate core document"
    },
    {
      id: "resolve-source-copy-blockers",
      metric: String(sourceCopySearchCount + declassificationReviewCount),
      label: "blocker rows",
      title: "Resolve source-copy and declassification blockers",
      body: "Handle no-memorandum markers, partial releases, and restricted rows before making final selection or MDR/referral decisions.",
      actionLabel: "Open source-copy searches",
      targetRecommendation: "Source-copy search"
    },
    {
      id: "settle-egypt-boundaries",
      metric: String(recommendationCounts["Cross-volume review"] || 0),
      label: "overlap rows",
      title: "Settle Egypt, Gulf, Arab-Israeli, and terrorism ownership",
      body: "Tag each overlap row before selection so Africa-specific material remains in Volume XX and companion-volume material is handed off cleanly.",
      actionLabel: "Open cross-volume reviews",
      targetRecommendation: "Cross-volume review"
    },
    {
      id: "fill-source-base",
      metric: String(criticalGapCount),
      label: "critical gaps",
      title: "Fill the missing source base",
      body: "Move from presidential conversations into State Department files, NSC policy packets, Libya/Pan Am records, and the 1992 Africa policy review trail.",
      actionLabel: "Open gaps",
      targetHref: "#gap-tracker"
    },
    {
      id: "verify-diary-backup",
      metric: String(diaryMatchedRows),
      label: "diary matches",
      title: "Use diary and backup material as control evidence",
      body: "Use NAID 186322 date matches to verify time, location, attendee, and call-status evidence, while treating it as control material rather than minutes.",
      actionLabel: "Open source pool",
      targetHref: "#source-pools"
    }
  ];
}

function buildQueues() {
  const specs = [
    {
      id: "candidate-core",
      recommendation: "Candidate core document",
      title: "First Reading Queue",
      description: "Likely Volume XX document candidates with the cleanest geographic fit.",
      limit: 10
    },
    {
      id: "policy-anchors",
      recommendation: "Policy anchor candidate",
      title: "Policy Backbone",
      description: "NSC, NSR, and NSD file anchors that can organize chapters and source-pool searches.",
      limit: 8
    },
    {
      id: "source-copy-searches",
      recommendation: "Source-copy search",
      title: "Source-Copy Searches",
      description: "No-memorandum markers and missing-source rows that need duplicate-copy searches or confirmation.",
      limit: 10
    },
    {
      id: "declassification-reviews",
      recommendation: "Declassification review",
      title: "Declassification Worklist",
      description: "Partial or restricted rows that may require withdrawal-sheet review, MDR/referral, or cleaner duplicate copies.",
      limit: 10
    },
    {
      id: "cross-volume-reviews",
      recommendation: "Cross-volume review",
      title: "Cross-Volume Ownership",
      description: "Egypt, Persian Gulf, Arab-Israeli, and terrorism overlap records to resolve before final selection.",
      limit: 10
    },
    {
      id: "boundary-handoffs",
      recommendation: "Boundary handoff",
      title: "Adjacent-Volume Handoffs",
      description: "Southern Africa, Somalia, and other boundary rows retained as control evidence.",
      limit: 8
    },
    {
      id: "public-line-context",
      recommendation: "Public-line/context check",
      title: "Public-Line Checks",
      description: "Public Papers references that pair public posture with private source-document candidates.",
      limit: 8
    }
  ];

  return specs.map((spec) => {
    const rows = matrix
      .filter((item) => item.recommendation === spec.recommendation)
      .sort(rowSort)
      .map(cleanRow);
    return {
      id: spec.id,
      recommendation: spec.recommendation,
      title: spec.title,
      description: spec.description,
      count: rows.length,
      rows: rows.slice(0, spec.limit)
    };
  });
}

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

function cleanGap(gap) {
  return {
    id: gap.id,
    priority: gap.priority,
    lane: gap.lane,
    title: gap.title,
    evidence: gap.evidence,
    needed: gap.needed,
    nextActions: gap.nextActions || [],
    targetTerms: gap.targetTerms || [],
    sourcePools: gap.sourcePools || []
  };
}

function cleanSourcePool(pool) {
  return {
    id: pool.id,
    priority: pool.priority,
    lane: pool.lane,
    title: pool.title,
    url: pool.url,
    coverage: pool.coverage,
    nextUse: pool.nextUse
  };
}

function rowSort(a, b) {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    recommendationRank(a.recommendation) - recommendationRank(b.recommendation) ||
    (a.lane || "").localeCompare(b.lane || "") ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function sourcePoolSort(a, b) {
  return sourcePoolRank(a.priority) - sourcePoolRank(b.priority) || (a.lane || "").localeCompare(b.lane || "") || a.title.localeCompare(b.title);
}

function sourcePoolRank(priority) {
  return ({ Missing: 1, Active: 2, Next: 3 }[priority] || 99);
}

function writeMarkdown(filePath, brief) {
  const lines = [
    "# FRUS Volume XX Compiler Brief",
    "",
    `Generated: ${brief.generatedAt}`,
    `Live page: ${brief.volume.livePageUrl}`,
    `Official volume: ${brief.volume.url}`,
    "",
    "## Start Here",
    "",
    ...brief.startHere.flatMap((item) => [
      `- ${item.metric} ${item.label}: ${item.title}`,
      `  - ${item.body}`,
      `  - Action: ${item.targetRecommendation || item.targetHref || item.actionLabel}`
    ]),
    "",
    "## Queue Counts",
    "",
    ...brief.queues.map((queue) => `- ${queue.title}: ${queue.count} (${queue.recommendation})`),
    "",
    "## Critical Gaps",
    "",
    ...brief.criticalGaps.flatMap((gap) => [
      `### ${gap.title}`,
      "",
      `- Lane: ${gap.lane}`,
      `- Evidence: ${gap.evidence}`,
      `- Needed: ${gap.needed}`,
      `- Next actions: ${(gap.nextActions || []).join("; ")}`,
      ""
    ])
  ];

  for (const queue of brief.queues) {
    lines.push(`## ${queue.title}`, "", queue.description, "");
    for (const row of queue.rows) {
      lines.push(
        `### ${row.dateText || row.date || "Undated"} - ${row.title}`,
        "",
        `- Recommendation: ${row.recommendation}`,
        `- Priority: ${row.priority}`,
        `- Lane: ${row.lane || "Context"}`,
        `- Compiler ID: ${row.compilerNumber || "n/a"}`,
        `- NAID: ${row.naid || "n/a"}`,
        `- Catalog: ${row.catalogUrl || "n/a"}`,
        `- PDF: ${row.pdfUrl || "n/a"}`,
        `- Next action: ${row.nextAction || "Review."}`,
        `- FRUS source note: ${row.frusSourceNote || row.sourceNote || "No source note available."}`
      );
      if (row.diaryReferences?.length) {
        lines.push(`- Diary/backup references: ${row.diaryReferences.map((reference) => `${reference.kind} ${reference.naid}`).join("; ")}`);
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
    generatedAt: sameReportBody(previous, body) ? previous.generatedAt : new Date().toISOString(),
    ...body
  };
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

function sameBriefBody(previousBrief, nextBody) {
  if (!previousBrief) return false;
  const { generatedAt, ...previousBody } = previousBrief;
  return JSON.stringify(previousBody) === JSON.stringify(nextBody);
}

function sameReportBody(previousReport, nextBody) {
  if (!previousReport) return false;
  const { generatedAt, ...previousBody } = previousReport;
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

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
