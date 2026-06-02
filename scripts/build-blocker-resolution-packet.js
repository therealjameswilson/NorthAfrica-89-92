#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const blockerDir = path.join(reportDir, "blocker-resolution");

const readiness = readJson("document-readiness-packet");
const researchRunbook = readJson("research-runbook");
const sourcePools = readJson("source-pools");

const allQueries = (researchRunbook.gaps || []).flatMap((gap) => gap.queries || []);
const sourcePoolById = new Map(sourcePools.map((pool) => [pool.id, pool]));
const comparatorVolumes = [
  {
    id: "frus1989-92v14",
    title: "Volume XIV, Arab-Israeli Dispute",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v14",
    use: "Screen Egypt and regional diplomacy for Arab-Israeli ownership."
  },
  {
    id: "frus1989-92v11",
    title: "Volume XI, Persian Gulf Crisis, 1989-1990",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v11",
    use: "Comparator for early Gulf crisis overlap."
  },
  {
    id: "frus1989-92v12",
    title: "Volume XII, Persian Gulf Crisis, 1990-1991",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v12",
    use: "Comparator for August 1990-March 1991 Gulf crisis overlap."
  },
  {
    id: "frus1989-92v13",
    title: "Volume XIII, Persian Gulf Crisis, 1991-1992",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v13",
    use: "Comparator for postwar Gulf diplomacy and UN sanctions overlap."
  },
  {
    id: "frus1989-92v28",
    title: "Volume XXVIII, Counternarcotics; Counterterrorism",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v28",
    use: "Comparator for terrorism, Pan Am 103, Libya sanctions, and S/CT ownership."
  }
];

const rows = (readiness.blockerRows || []).map(resolutionRow).sort(rowSort);
const sourceCopyRows = rows.filter((row) => row.resolutionType === "Source-copy search");
const declassificationRows = rows.filter((row) => row.resolutionType === "Declassification review");
const crossVolumeRows = rows.filter((row) => row.resolutionType === "Cross-volume ownership");

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    blockerCount: rows.length,
    sourceCopyCount: sourceCopyRows.length,
    declassificationCount: declassificationRows.length,
    crossVolumeCount: crossVolumeRows.length,
    diaryControlledCount: rows.filter((row) => row.diaryReferenceCount > 0).length,
    frusSourceNoteCount: rows.filter((row) => row.frusSourceNote).length,
    queryLinkedCount: rows.filter((row) => row.queryRows.length > 0).length,
    comparatorLinkedCount: rows.filter((row) => row.comparatorVolumes.length > 0).length,
    csvFiles: [
      "reports/blocker-resolution/all-blockers.csv",
      "reports/blocker-resolution/source-copy-actions.csv",
      "reports/blocker-resolution/declassification-actions.csv",
      "reports/blocker-resolution/cross-volume-actions.csv"
    ]
  },
  comparatorVolumes,
  sourceCopyRows,
  declassificationRows,
  crossVolumeRows,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "blocker-resolution-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(blockerDir, { recursive: true });

writeJsonPair("blocker-resolution-packet", "BLOCKER_RESOLUTION_PACKET", packet);
fs.writeFileSync(path.join(blockerDir, "all-blockers.csv"), toCsv(packet.rows.map(csvRow), blockerColumns()));
fs.writeFileSync(path.join(blockerDir, "source-copy-actions.csv"), toCsv(packet.sourceCopyRows.map(csvRow), blockerColumns()));
fs.writeFileSync(path.join(blockerDir, "declassification-actions.csv"), toCsv(packet.declassificationRows.map(csvRow), blockerColumns()));
fs.writeFileSync(path.join(blockerDir, "cross-volume-actions.csv"), toCsv(packet.crossVolumeRows.map(csvRow), blockerColumns()));
writeMarkdown(path.join(reportDir, "blocker-resolution-packet.md"), packet);
writeStableJson(path.join(reportDir, "blocker-resolution-packet-build.json"), {
  blockerCount: packet.summary.blockerCount,
  sourceCopyCount: packet.summary.sourceCopyCount,
  declassificationCount: packet.summary.declassificationCount,
  crossVolumeCount: packet.summary.crossVolumeCount,
  diaryControlledCount: packet.summary.diaryControlledCount,
  frusSourceNoteCount: packet.summary.frusSourceNoteCount,
  queryLinkedCount: packet.summary.queryLinkedCount,
  comparatorLinkedCount: packet.summary.comparatorLinkedCount,
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote blocker resolution packet: ${packet.summary.blockerCount} blockers, ${packet.summary.sourceCopyCount} source-copy, ${packet.summary.declassificationCount} declass, ${packet.summary.crossVolumeCount} cross-volume.`
);

function resolutionRow(row) {
  const resolutionType = resolutionTypeFor(row);
  const queryRows = matchingQueries(row, resolutionType).slice(0, 5);
  const actionSteps = actionStepsFor(row, resolutionType);
  const comparators = comparatorVolumesFor(row, resolutionType);
  return {
    id: row.id,
    draftNumber: row.draftNumber || "",
    resolutionType,
    readinessStatus: row.readinessStatus || "",
    priority: row.priority || "",
    lane: row.lane || "",
    country: row.country || "",
    date: row.date || "",
    sortDate: row.sortDate || row.date || "",
    dateText: row.dateText || "",
    title: row.title || "",
    recordType: row.recordType || "",
    participants: row.participants || [],
    releaseStatus: row.releaseStatus || "",
    naid: row.naid || "",
    catalogUrl: row.catalogUrl || "",
    pdfUrl: row.pdfUrl || "",
    blockers: row.blockers || [],
    actionSteps,
    recommendedDecisionField: recommendedDecisionField(resolutionType),
    handoffNote: handoffNoteFor(row, resolutionType),
    searchTerms: searchTermsFor(row, resolutionType),
    catalogSearchUrl: catalogSearchUrl(searchTermsFor(row, resolutionType)),
    queryRows,
    sourcePools: sourcePoolsFor(queryRows, resolutionType),
    comparatorVolumes: comparators,
    diaryReferenceCount: row.diaryReferenceCount || 0,
    diaryReferences: row.diaryReferences || [],
    authorityReviewEntries: row.authorityReviewEntries || [],
    frusSourceNote: row.frusSourceNote || "",
    catalogProvenance: row.catalogProvenance || "",
    nextAction: row.nextAction || "",
    decisionNeeded: row.decisionNeeded || "",
    basis: row.basis || ""
  };
}

function resolutionTypeFor(row) {
  if ((row.blockers || []).includes("Source-copy search") || row.readinessStatus === "Blocked: source-copy search") return "Source-copy search";
  if ((row.blockers || []).includes("Declassification review") || row.readinessStatus === "Blocked: declassification review") return "Declassification review";
  if ((row.blockers || []).includes("Cross-volume ownership") || row.readinessStatus === "Blocked: cross-volume ownership") return "Cross-volume ownership";
  return row.blockers?.[0] || "Other blocker";
}

function matchingQueries(row, resolutionType) {
  const rowText = normalize([row.title, row.country, row.lane, ...(row.participants || [])].join(" "));
  const weighted = allQueries.map((query) => {
    const terms = normalize([query.queryTerms, query.gapTitle, query.lane].join(" ")).split(" ").filter((term) => term.length > 2);
    const matches = terms.filter((term) => rowText.includes(term)).length;
    const typeBoost =
      (resolutionType === "Cross-volume ownership" && /cross|egypt|gulf|arab|terrorism/i.test(query.gapTitle || query.queryTerms || "")) ||
      (resolutionType === "Source-copy search" && /source|partial|memorandum|diary|backup|duplicate/i.test(query.gapTitle || query.queryTerms || "")) ||
      (resolutionType === "Declassification review" && /source|partial|memorandum|diary|backup|duplicate|mdr|withdrawal/i.test(query.gapTitle || query.queryTerms || ""));
    return { query, score: matches + (typeBoost ? 3 : 0) };
  });
  return weighted
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || priorityRank(a.query.priority) - priorityRank(b.query.priority))
    .map((item) => item.query);
}

function actionStepsFor(row, resolutionType) {
  if (resolutionType === "Source-copy search") {
    return [
      "Open the catalog/PDF row and confirm whether the public object is only a marker or no-memorandum placeholder.",
      "Use the date-matched Presidential Daily Diary/Backup references to verify that the call or meeting occurred and capture time/location/status.",
      "Search duplicate source-copy lanes: Scowcroft files, Presidential Daily File, NSC country files, and State central/bureau files using the supplied query terms.",
      "Record one of three decisions: duplicate source found, no memorandum exists, or keep as chronology-only marker."
    ];
  }
  if (resolutionType === "Declassification review") {
    return [
      "Open the public PDF and inspect redactions, withdrawal sheets, and any classification/release markings.",
      "Decide whether redactions block document selection or whether the available text supports full publication/excerpt.",
      "Search duplicate source-copy lanes for a cleaner copy before queuing MDR/referral work.",
      "Record the declassification path: usable as released, excerpt around redactions, duplicate-copy search, MDR/referral, or chronology-only."
    ];
  }
  if (resolutionType === "Cross-volume ownership") {
    return [
      "Compare the record against the linked adjacent FRUS volume lanes before assigning ownership.",
      "Tag the row as Volume XX core, adjacent-volume handoff, excerpt, or chronology-only.",
      "Retain the row in Volume XX only when Africa-specific substance is primary or necessary for the North/Sub-Saharan narrative.",
      "If handed off, preserve the source note and diary controls for the adjacent compiler."
    ];
  }
  return ["Resolve the listed blocker and record the final compiler decision."];
}

function recommendedDecisionField(resolutionType) {
  if (resolutionType === "Source-copy search") return "sourceCopyStatus";
  if (resolutionType === "Declassification review") return "declassificationStatus";
  if (resolutionType === "Cross-volume ownership") return "owningVolume";
  return "compilerNotes";
}

function handoffNoteFor(row, resolutionType) {
  if (resolutionType === "Cross-volume ownership") {
    return "Use this row as the ownership handoff note if Volume XX does not retain the document.";
  }
  if (resolutionType === "Source-copy search") {
    return "Use this row as the duplicate-copy search note; preserve diary evidence even if no memorandum exists.";
  }
  if (resolutionType === "Declassification review") {
    return "Use this row as the declassification/MDR note; preserve redaction findings and duplicate-copy attempts.";
  }
  return "Use this row as the blocker-resolution handoff note.";
}

function searchTermsFor(row, resolutionType) {
  const participantTerms = (row.participants || [])
    .filter((name) => !/George H\.? W\.? Bush|President Bush/i.test(name))
    .join(" ");
  const terms = [participantTerms, row.country, row.date, row.recordType].filter(Boolean).join(" ");
  if (resolutionType === "Source-copy search") return `${terms} memorandum telephone conversation duplicate source copy`;
  if (resolutionType === "Declassification review") return `${terms} partial restricted withdrawal sheet declassification duplicate copy`;
  if (resolutionType === "Cross-volume ownership") return `${terms} FRUS Gulf Arab-Israeli Africa ownership`;
  return terms;
}

function sourcePoolsFor(queryRows, resolutionType) {
  const poolIds = uniqueSorted(queryRows.map((query) => query.sourcePoolId));
  const pools = poolIds.map((id) => sourcePoolById.get(id)).filter(Boolean);
  if (!pools.length) {
    return fallbackSourcePools(resolutionType);
  }
  return pools.map((pool) => ({
    id: pool.id,
    title: pool.title,
    priority: pool.priority,
    url: pool.url || "",
    nextUse: pool.nextUse || ""
  }));
}

function fallbackSourcePools(resolutionType) {
  const ids =
    resolutionType === "Cross-volume ownership"
      ? ["cross-volume", "bush-memcons"]
      : ["bush-memcons", "daily-diary-backup", "nsc-records", "state-central"];
  return ids
    .map((id) => sourcePoolById.get(id))
    .filter(Boolean)
    .map((pool) => ({ id: pool.id, title: pool.title, priority: pool.priority, url: pool.url || "", nextUse: pool.nextUse || "" }));
}

function comparatorVolumesFor(row, resolutionType) {
  if (resolutionType !== "Cross-volume ownership") return [];
  const text = normalize([row.title, row.country, ...(row.participants || [])].join(" "));
  return comparatorVolumes.filter((volume) => {
    if (volume.id === "frus1989-92v14") return /egypt|mubarak|boutros|arab|israeli|israel|palestin/.test(text);
    if (volume.id === "frus1989-92v11" || volume.id === "frus1989-92v12" || volume.id === "frus1989-92v13") return /egypt|mubarak|gulf|iraq|kuwait|saddam|sanction/.test(text);
    if (volume.id === "frus1989-92v28") return /libya|qadhafi|gaddafi|terror|pan am|lockerbie|sanction/.test(text);
    return false;
  });
}

function csvRow(row) {
  return {
    draftNumber: row.draftNumber,
    resolutionType: row.resolutionType,
    readinessStatus: row.readinessStatus,
    recommendedDecisionField: row.recommendedDecisionField,
    lane: row.lane,
    country: row.country,
    date: row.date,
    dateText: row.dateText,
    title: row.title,
    participants: row.participants.join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    blockers: row.blockers.join("; "),
    nextAction: row.nextAction,
    actionSteps: row.actionSteps.join("; "),
    searchTerms: row.searchTerms,
    catalogSearchUrl: row.catalogSearchUrl,
    queryLinks: row.queryRows.map((query) => query.sourcePoolSearchUrl || query.catalogSearchUrl).filter(Boolean).join("; "),
    sourcePools: row.sourcePools.map((pool) => pool.title).join("; "),
    comparatorVolumes: row.comparatorVolumes.map((volume) => `${volume.title}: ${volume.url}`).join("; "),
    diaryReferenceCount: row.diaryReferenceCount,
    diaryReferences: formatDiaryReferences(row),
    authorityReviewEntries: row.authorityReviewEntries.join("; "),
    frusSourceNote: row.frusSourceNote,
    catalogProvenance: row.catalogProvenance,
    handoffNote: row.handoffNote
  };
}

function blockerColumns() {
  return [
    "draftNumber",
    "resolutionType",
    "readinessStatus",
    "recommendedDecisionField",
    "lane",
    "country",
    "date",
    "dateText",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "catalogUrl",
    "pdfUrl",
    "blockers",
    "nextAction",
    "actionSteps",
    "searchTerms",
    "catalogSearchUrl",
    "queryLinks",
    "sourcePools",
    "comparatorVolumes",
    "diaryReferenceCount",
    "diaryReferences",
    "authorityReviewEntries",
    "frusSourceNote",
    "catalogProvenance",
    "handoffNote"
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Blocker Resolution Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}#blocker-resolution`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Blockers: ${packet.summary.blockerCount}`,
    `- Source-copy searches: ${packet.summary.sourceCopyCount}`,
    `- Declassification reviews: ${packet.summary.declassificationCount}`,
    `- Cross-volume ownership rows: ${packet.summary.crossVolumeCount}`,
    `- Diary/backup controlled rows: ${packet.summary.diaryControlledCount}`,
    `- FRUS source-note rows: ${packet.summary.frusSourceNoteCount}`,
    "",
    "## CSV Outputs",
    "",
    ...packet.summary.csvFiles.map((filePath) => `- ${filePath.replace(/^reports\//, "")}`),
    "",
    "## Cross-Volume Comparators",
    "",
    ...packet.comparatorVolumes.map((volume) => `- ${volume.title}: ${volume.url} (${volume.use})`),
    "",
    "## Source-Copy Searches",
    ""
  ];

  for (const row of packet.sourceCopyRows) lines.push(...markdownRow(row));
  lines.push("## Declassification Reviews", "");
  for (const row of packet.declassificationRows) lines.push(...markdownRow(row));
  lines.push("## Cross-Volume Ownership", "");
  for (const row of packet.crossVolumeRows) lines.push(...markdownRow(row));

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function markdownRow(row) {
  const lines = [
    `### ${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`,
    "",
    `- Resolution type: ${row.resolutionType}`,
    `- Recommended field: ${row.recommendedDecisionField}`,
    `- Blockers: ${row.blockers.join("; ") || "n/a"}`,
    `- Next action: ${row.nextAction}`,
    `- Search terms: ${row.searchTerms}`,
    `- Catalog search: ${row.catalogSearchUrl}`,
    `- Catalog: ${row.catalogUrl || "n/a"}`,
    `- PDF: ${row.pdfUrl || "n/a"}`,
    `- Diary/backup controls: ${row.diaryReferenceCount}`,
    `- FRUS source note: ${row.frusSourceNote || "n/a"}`,
    "- Action steps:",
    ...row.actionSteps.map((step) => `  - ${step}`)
  ];
  if (row.comparatorVolumes.length) {
    lines.push("- Comparator volumes:", ...row.comparatorVolumes.map((volume) => `  - ${volume.title}: ${volume.url}`));
  }
  if (row.queryRows.length) {
    lines.push("- Query leads:", ...row.queryRows.slice(0, 3).map((query) => `  - ${query.queryLabel}: ${query.queryTerms}; ${query.sourcePoolSearchUrl || query.catalogSearchUrl}`));
  }
  lines.push("");
  return lines;
}

function rowSort(a, b) {
  return typeRank(a.resolutionType) - typeRank(b.resolutionType) || (a.sortDate || "").localeCompare(b.sortDate || "") || a.title.localeCompare(b.title);
}

function typeRank(type) {
  return { "Source-copy search": 0, "Declassification review": 1, "Cross-volume ownership": 2 }[type] ?? 9;
}

function priorityRank(priority) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 9;
}

function catalogSearchUrl(query) {
  return `https://catalog.archives.gov/search?q=${encodeURIComponent(query)}&availableOnline=true&limit=100`;
}

function formatDiaryReferences(row) {
  return (row.diaryReferences || [])
    .map((reference) => `${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`)
    .join("; ");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
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
