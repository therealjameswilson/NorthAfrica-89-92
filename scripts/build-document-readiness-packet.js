#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const readinessDir = path.join(reportDir, "document-readiness");

const draftDocumentList = readJson("draft-document-list");
const personsAuthorityPacket = readJson("persons-authority-packet");
const sourceCopyLedger = readJson("source-copy-ledger");
const gapTracker = readJson("gap-tracker");

const sourceCopyByNaid = new Map(sourceCopyLedger.map((row) => [String(row.naid || ""), row]).filter(([naid]) => naid));
const personLinksByNaid = buildPersonLinksByNaid(personsAuthorityPacket.persons || []);

const rows = [...(draftDocumentList.proposedRows || []), ...(draftDocumentList.conditionalRows || [])]
  .map(readinessRow)
  .sort(rowSort);

const readyRows = rows.filter((row) => row.readinessStatus === "Ready for first-pass read");
const authorityRows = rows.filter((row) => row.readinessStatus === "Ready with authority check");
const blockerRows = rows.filter((row) => row.blockerCount > 0);
const chapterGroups = groupBy(rows, (row) => row.lane || "Unassigned").map(([lane, laneRows]) => chapterGroup(lane, laneRows));

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    documentCount: rows.length,
    proposedCount: rows.filter((row) => row.proposalStatus === "Proposed").length,
    conditionalCount: rows.filter((row) => row.proposalStatus === "Conditional").length,
    readyForReadCount: readyRows.length,
    readyWithAuthorityCheckCount: authorityRows.length,
    blockerCount: blockerRows.length,
    sourceCopyCount: rows.filter((row) => row.hasSourceCopyBlocker).length,
    declassificationCount: rows.filter((row) => row.hasDeclassificationBlocker).length,
    crossVolumeCount: rows.filter((row) => row.hasCrossVolumeBlocker).length,
    missingSourceNoteCount: rows.filter((row) => !row.hasFrusSourceNote).length,
    diaryMatchedCount: rows.filter((row) => row.diaryReferenceCount > 0).length,
    authorityReviewDocumentCount: rows.filter((row) => row.authorityReviewCount > 0).length,
    highAuthorityReviewDocumentCount: rows.filter((row) => row.authorityReviewPriorities.includes("High")).length,
    byReadinessStatus: countBy(rows.map((row) => row.readinessStatus)),
    csvFiles: [
      "reports/document-readiness/document-readiness.csv",
      "reports/document-readiness/ready-first-pass.csv",
      "reports/document-readiness/blockers.csv",
      "reports/document-readiness/authority-checks.csv"
    ]
  },
  readyRows,
  authorityRows,
  blockerRows,
  chapterGroups,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "document-readiness-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(readinessDir, { recursive: true });

writeJsonPair("document-readiness-packet", "DOCUMENT_READINESS_PACKET", packet);
fs.writeFileSync(path.join(readinessDir, "document-readiness.csv"), toCsv(packet.rows.map(csvRow), readinessColumns()));
fs.writeFileSync(path.join(readinessDir, "ready-first-pass.csv"), toCsv(packet.readyRows.map(csvRow), readinessColumns()));
fs.writeFileSync(path.join(readinessDir, "blockers.csv"), toCsv(packet.blockerRows.map(csvRow), readinessColumns()));
fs.writeFileSync(path.join(readinessDir, "authority-checks.csv"), toCsv(packet.authorityRows.map(csvRow), readinessColumns()));
writeMarkdown(path.join(reportDir, "document-readiness-packet.md"), packet);
writeStableJson(path.join(reportDir, "document-readiness-packet-build.json"), {
  documentCount: packet.summary.documentCount,
  proposedCount: packet.summary.proposedCount,
  conditionalCount: packet.summary.conditionalCount,
  readyForReadCount: packet.summary.readyForReadCount,
  readyWithAuthorityCheckCount: packet.summary.readyWithAuthorityCheckCount,
  blockerCount: packet.summary.blockerCount,
  sourceCopyCount: packet.summary.sourceCopyCount,
  declassificationCount: packet.summary.declassificationCount,
  crossVolumeCount: packet.summary.crossVolumeCount,
  missingSourceNoteCount: packet.summary.missingSourceNoteCount,
  diaryMatchedCount: packet.summary.diaryMatchedCount,
  authorityReviewDocumentCount: packet.summary.authorityReviewDocumentCount,
  highAuthorityReviewDocumentCount: packet.summary.highAuthorityReviewDocumentCount,
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote document readiness packet: ${packet.summary.documentCount} documents, ${packet.summary.readyForReadCount} ready, ${packet.summary.blockerCount} blocked.`
);

function readinessRow(row) {
  const sourceCopy = sourceCopyByNaid.get(String(row.naid || ""));
  const authorityLinks = uniqueBy(personLinksByNaid.get(String(row.naid || "")) || [], (link) => link.personId);
  const authorityReviewLinks = authorityLinks.filter((link) => link.needsReview === "Yes");
  const gapMentions = gapMatches(row);
  const blockers = blockerList(row, sourceCopy, authorityReviewLinks);
  const readinessStatus = statusFor(row, blockers, authorityReviewLinks);
  const nextAction = nextActionFor(row, readinessStatus, blockers, authorityReviewLinks);
  return {
    id: row.id,
    draftNumber: row.draftNumber || "",
    proposalStatus: row.proposalStatus || "",
    editorialStatus: row.editorialStatus || "",
    recommendation: row.recommendation || "",
    priority: row.priority || "",
    readinessStatus,
    blockerCount: blockers.length,
    blockers,
    nextAction,
    lane: row.lane || "",
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
    basis: row.basis || "",
    decisionNeeded: row.decisionNeeded || "",
    hasFrusSourceNote: Boolean(row.frusSourceNote),
    frusSourceNote: row.frusSourceNote || "",
    catalogProvenance: row.sourceNote || "",
    diaryReferenceCount: (row.diaryReferences || []).length,
    diaryReferences: row.diaryReferences || [],
    diaryCrossReferenceNote: row.diaryCrossReferenceNote || "",
    hasSourceCopyBlocker: isSourceCopyBlocker(row, sourceCopy),
    sourceCopyIssue: sourceCopy?.issueType || (row.recommendation === "Source-copy search" ? "Source-copy search" : ""),
    sourceCopyNextAction: sourceCopy?.nextAction || "",
    hasDeclassificationBlocker: isDeclassificationBlocker(row, sourceCopy),
    hasCrossVolumeBlocker: row.recommendation === "Cross-volume review",
    authorityReviewCount: authorityReviewLinks.length,
    authorityReviewEntries: authorityReviewLinks.map((link) => link.entry).sort(),
    authorityReviewPriorities: uniqueSorted(authorityReviewLinks.map((link) => link.reviewPriority)),
    authorityMatchedCount: authorityLinks.filter((link) => link.needsReview !== "Yes").length,
    gapMentionCount: gapMentions.length,
    gapMentions
  };
}

function buildPersonLinksByNaid(persons) {
  const links = new Map();
  for (const person of persons) {
    for (const link of person.documentLinks || []) {
      if (link.context !== "Draft" || !link.naid) continue;
      const row = {
        personId: person.id,
        personName: person.name || "",
        entry: person.entry || "",
        needsReview: person.needsReview ? "Yes" : "No",
        reviewPriority: person.reviewPriority || "",
        authorityStatus: person.authorityStatus || "",
        reviewReason: person.reviewReason || ""
      };
      if (!links.has(String(link.naid))) links.set(String(link.naid), []);
      links.get(String(link.naid)).push(row);
    }
  }
  return links;
}

function blockerList(row, sourceCopy, authorityReviewLinks) {
  const blockers = [];
  if (!row.frusSourceNote) blockers.push("Missing FRUS source note");
  if (isSourceCopyBlocker(row, sourceCopy)) blockers.push("Source-copy search");
  if (isDeclassificationBlocker(row, sourceCopy)) blockers.push("Declassification review");
  if (row.recommendation === "Cross-volume review") blockers.push("Cross-volume ownership");
  if (authorityReviewLinks.length && row.proposalStatus !== "Proposed") blockers.push("Persons authority check");
  return uniqueSorted(blockers);
}

function isSourceCopyBlocker(row, sourceCopy) {
  return row.recommendation === "Source-copy search" || /marker|no memorandum/i.test(sourceCopy?.issueType || "");
}

function isDeclassificationBlocker(row, sourceCopy) {
  return row.recommendation === "Declassification review" || /partial|restricted|redaction/i.test(sourceCopy?.issueType || "");
}

function statusFor(row, blockers, authorityReviewLinks) {
  if (blockers.includes("Source-copy search")) return "Blocked: source-copy search";
  if (blockers.includes("Declassification review")) return "Blocked: declassification review";
  if (blockers.includes("Cross-volume ownership")) return "Blocked: cross-volume ownership";
  if (blockers.includes("Missing FRUS source note")) return "Blocked: source-note gap";
  if (authorityReviewLinks.length) return "Ready with authority check";
  if (row.proposalStatus === "Proposed") return "Ready for first-pass read";
  return "Conditional review";
}

function nextActionFor(row, readinessStatus, blockers, authorityReviewLinks) {
  if (readinessStatus === "Ready for first-pass read") {
    return "Read for substance, assign a final document number, and decide full text versus excerpt.";
  }
  if (readinessStatus === "Ready with authority check") {
    return `Read for substance, then confirm authority form(s): ${authorityReviewLinks.map((link) => link.entry).join("; ")}.`;
  }
  if (blockers.includes("Source-copy search")) {
    return "Locate a duplicate source copy or confirm that no memorandum exists before selection.";
  }
  if (blockers.includes("Declassification review")) {
    return "Review redactions, withdrawal sheets, referral status, or duplicate copies before selection.";
  }
  if (blockers.includes("Cross-volume ownership")) {
    return "Decide Volume XX ownership versus handoff/excerpt with the overlapping volume.";
  }
  return row.decisionNeeded || "Make final selection, excerpt, and ownership decision.";
}

function gapMatches(row) {
  const haystack = normalize([row.title, row.country, row.lane, ...(row.participants || [])].join(" "));
  return gapTracker
    .filter((gap) => {
      const terms = [gap.title, ...(gap.targetTerms || [])].map(normalize).filter(Boolean);
      return terms.some((term) => term.length > 2 && haystack.includes(term));
    })
    .map((gap) => ({
      id: gap.id || "",
      priority: gap.priority || "",
      lane: gap.lane || "",
      title: gap.title || ""
    }));
}

function chapterGroup(lane, laneRows) {
  return {
    lane,
    count: laneRows.length,
    proposedCount: laneRows.filter((row) => row.proposalStatus === "Proposed").length,
    conditionalCount: laneRows.filter((row) => row.proposalStatus === "Conditional").length,
    readyForReadCount: laneRows.filter((row) => row.readinessStatus === "Ready for first-pass read").length,
    readyWithAuthorityCheckCount: laneRows.filter((row) => row.readinessStatus === "Ready with authority check").length,
    blockerCount: laneRows.filter((row) => row.blockerCount > 0).length,
    sourceCopyCount: laneRows.filter((row) => row.hasSourceCopyBlocker).length,
    declassificationCount: laneRows.filter((row) => row.hasDeclassificationBlocker).length,
    crossVolumeCount: laneRows.filter((row) => row.hasCrossVolumeBlocker).length,
    rows: laneRows.slice(0, 8)
  };
}

function csvRow(row) {
  return {
    draftNumber: row.draftNumber,
    readinessStatus: row.readinessStatus,
    proposalStatus: row.proposalStatus,
    editorialStatus: row.editorialStatus,
    recommendation: row.recommendation,
    priority: row.priority,
    lane: row.lane,
    country: row.country,
    date: row.date,
    dateText: row.dateText,
    recordType: row.recordType,
    title: row.title,
    participants: row.participants.join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    pageCount: row.pageCount,
    blockerCount: row.blockerCount,
    blockers: row.blockers.join("; "),
    nextAction: row.nextAction,
    hasFrusSourceNote: row.hasFrusSourceNote ? "Yes" : "No",
    diaryReferenceCount: row.diaryReferenceCount,
    authorityReviewCount: row.authorityReviewCount,
    authorityReviewEntries: row.authorityReviewEntries.join("; "),
    authorityReviewPriorities: row.authorityReviewPriorities.join("; "),
    sourceCopyIssue: row.sourceCopyIssue,
    gapMentionCount: row.gapMentionCount,
    gapMentions: row.gapMentions.map((gap) => `${gap.priority}: ${gap.title}`).join("; "),
    decisionNeeded: row.decisionNeeded,
    basis: row.basis,
    frusSourceNote: row.frusSourceNote,
    catalogProvenance: row.catalogProvenance,
    diaryReferences: formatDiaryReferences(row)
  };
}

function readinessColumns() {
  return [
    "draftNumber",
    "readinessStatus",
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
    "blockerCount",
    "blockers",
    "nextAction",
    "hasFrusSourceNote",
    "diaryReferenceCount",
    "authorityReviewCount",
    "authorityReviewEntries",
    "authorityReviewPriorities",
    "sourceCopyIssue",
    "gapMentionCount",
    "gapMentions",
    "decisionNeeded",
    "basis",
    "frusSourceNote",
    "catalogProvenance",
    "diaryReferences"
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Document Readiness Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}#document-readiness`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Draft documents: ${packet.summary.documentCount}`,
    `- Ready for first-pass read: ${packet.summary.readyForReadCount}`,
    `- Ready with authority check: ${packet.summary.readyWithAuthorityCheckCount}`,
    `- Blocked/conditional rows: ${packet.summary.blockerCount}`,
    `- Missing FRUS source notes: ${packet.summary.missingSourceNoteCount}`,
    `- Diary/backup matched rows: ${packet.summary.diaryMatchedCount}`,
    "",
    "## CSV Outputs",
    "",
    ...packet.summary.csvFiles.map((filePath) => `- ${filePath.replace(/^reports\//, "")}`),
    "",
    "## Ready for First-Pass Read",
    ""
  ];

  for (const row of packet.readyRows.slice(0, 20)) lines.push(...markdownRow(row));
  lines.push("## Ready with Authority Check", "");
  for (const row of packet.authorityRows) lines.push(...markdownRow(row));
  lines.push("## Blockers", "");
  for (const row of packet.blockerRows) lines.push(...markdownRow(row));

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function markdownRow(row) {
  const lines = [
    `### ${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`,
    "",
    `- Readiness: ${row.readinessStatus}`,
    `- Recommendation: ${row.recommendation}`,
    `- Lane: ${row.lane || "n/a"}`,
    `- Country: ${row.country || "n/a"}`,
    `- Blockers: ${row.blockers.join("; ") || "none"}`,
    `- Next action: ${row.nextAction}`,
    `- Authority checks: ${row.authorityReviewEntries.join("; ") || "none"}`,
    `- Diary/backup controls: ${row.diaryReferenceCount}`,
    `- Catalog: ${row.catalogUrl || "n/a"}`,
    `- PDF: ${row.pdfUrl || "n/a"}`,
    `- FRUS source note: ${row.frusSourceNote || "n/a"}`
  ];
  if (row.diaryReferences.length) {
    lines.push(
      "- Diary/backup references:",
      ...row.diaryReferences.map((reference) => `  - ${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`)
    );
  }
  lines.push("");
  return lines;
}

function rowSort(a, b) {
  return statusRank(a.readinessStatus) - statusRank(b.readinessStatus) || (a.sortDate || "").localeCompare(b.sortDate || "") || a.title.localeCompare(b.title);
}

function statusRank(status) {
  return {
    "Ready for first-pass read": 0,
    "Ready with authority check": 1,
    "Blocked: source-copy search": 2,
    "Blocked: declassification review": 3,
    "Blocked: cross-volume ownership": 4,
    "Blocked: source-note gap": 5,
    "Conditional review": 6
  }[status] ?? 9;
}

function formatDiaryReferences(row) {
  return (row.diaryReferences || [])
    .map((reference) => `${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`)
    .join("; ");
}

function groupBy(items, getter) {
  const groups = new Map();
  for (const item of items) {
    const key = getter(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function uniqueBy(values, getter) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = getter(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
