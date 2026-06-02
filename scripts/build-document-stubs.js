#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const stubDir = path.join(reportDir, "document-stubs");

const readiness = readJson("document-readiness-packet");
const blockers = readJson("blocker-resolution-packet");
const personsAuthority = readJson("persons-authority-packet");

const blockerByDraft = new Map((blockers.rows || []).map((row) => [row.draftNumber, row]));
const authorityLinksByDraft = buildAuthorityLinksByDraft(personsAuthority.persons || []);

const rows = (readiness.rows || []).map(stubRow).sort(rowSort);
const readyRows = rows.filter((row) => row.stubStatus === "Ready stub");
const authorityRows = rows.filter((row) => row.stubStatus === "Authority-check stub");
const blockerRows = rows.filter((row) => row.stubStatus === "Blocker-resolution stub");

fs.rmSync(stubDir, { recursive: true, force: true });
fs.mkdirSync(stubDir, { recursive: true });
for (const row of rows) fs.writeFileSync(path.join(repoRoot, row.stubPath), stubMarkdown(row));

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    stubCount: rows.length,
    readyStubCount: readyRows.length,
    authorityStubCount: authorityRows.length,
    blockerStubCount: blockerRows.length,
    sourceNoteStubCount: rows.filter((row) => row.frusSourceNote).length,
    diaryControlledStubCount: rows.filter((row) => row.diaryReferenceCount > 0).length,
    authorityReviewStubCount: rows.filter((row) => row.authorityReviewCount > 0).length,
    sourceCopyStubCount: rows.filter((row) => row.resolutionType === "Source-copy search").length,
    declassificationStubCount: rows.filter((row) => row.resolutionType === "Declassification review").length,
    crossVolumeStubCount: rows.filter((row) => row.resolutionType === "Cross-volume ownership").length,
    csvFiles: ["reports/document-stubs/document-stub-index.csv"]
  },
  readyRows,
  authorityRows,
  blockerRows,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "document-stubs-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

writeJsonPair("document-stubs-packet", "DOCUMENT_STUBS_PACKET", packet);
fs.writeFileSync(path.join(stubDir, "document-stub-index.csv"), toCsv(rows.map(csvRow), stubColumns()));
writeMarkdown(path.join(reportDir, "document-stubs-packet.md"), packet);
writeStableJson(path.join(reportDir, "document-stubs-packet-build.json"), {
  stubCount: packet.summary.stubCount,
  readyStubCount: packet.summary.readyStubCount,
  authorityStubCount: packet.summary.authorityStubCount,
  blockerStubCount: packet.summary.blockerStubCount,
  sourceNoteStubCount: packet.summary.sourceNoteStubCount,
  diaryControlledStubCount: packet.summary.diaryControlledStubCount,
  authorityReviewStubCount: packet.summary.authorityReviewStubCount,
  sourceCopyStubCount: packet.summary.sourceCopyStubCount,
  declassificationStubCount: packet.summary.declassificationStubCount,
  crossVolumeStubCount: packet.summary.crossVolumeStubCount,
  stubFiles: packet.rows.map((row) => row.stubPath),
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote ${packet.summary.stubCount} document stubs: ${packet.summary.readyStubCount} ready, ${packet.summary.authorityStubCount} authority, ${packet.summary.blockerStubCount} blockers.`
);

function stubRow(row) {
  const blocker = blockerByDraft.get(row.draftNumber) || null;
  const authorityLinks = authorityLinksByDraft.get(row.draftNumber) || [];
  const authorityReviewLinks = authorityLinks.filter((link) => link.needsReview === "Yes");
  const matchedAuthorityLinks = authorityLinks.filter((link) => link.needsReview !== "Yes");
  const stubStatus = blocker
    ? "Blocker-resolution stub"
    : authorityReviewLinks.length
      ? "Authority-check stub"
      : "Ready stub";
  const stubPath = `reports/document-stubs/${slug(row.draftNumber || row.id)}.md`;
  return {
    id: row.id,
    draftNumber: row.draftNumber || "",
    stubStatus,
    stubPath,
    proposalStatus: row.proposalStatus || "",
    editorialStatus: row.editorialStatus || "",
    recommendation: row.recommendation || "",
    priority: row.priority || "",
    readinessStatus: row.readinessStatus || "",
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
    nextAction: row.nextAction || "",
    blockers: row.blockers || [],
    blocker,
    resolutionType: blocker?.resolutionType || "",
    authorityReviewCount: authorityReviewLinks.length,
    authorityReviewEntries: authorityReviewLinks.map((link) => link.entry).sort(),
    authorityMatchedCount: matchedAuthorityLinks.length,
    authorityEntries: authorityLinks.map((link) => link.entry).sort(),
    diaryReferenceCount: row.diaryReferenceCount || 0,
    diaryReferences: row.diaryReferences || [],
    diaryCrossReferenceNote: row.diaryCrossReferenceNote || "",
    gapMentions: row.gapMentions || [],
    frusSourceNote: row.frusSourceNote || "",
    catalogProvenance: row.catalogProvenance || ""
  };
}

function buildAuthorityLinksByDraft(persons) {
  const links = new Map();
  for (const person of persons) {
    for (const link of person.documentLinks || []) {
      if (link.context !== "Draft" || !link.draftNumber) continue;
      if (!links.has(link.draftNumber)) links.set(link.draftNumber, []);
      links.get(link.draftNumber).push({
        personId: person.id,
        entry: person.entry || "",
        name: person.name || "",
        needsReview: person.needsReview ? "Yes" : "No",
        reviewPriority: person.reviewPriority || "",
        reviewReason: person.reviewReason || "",
        nextAction: person.nextAction || ""
      });
    }
  }
  for (const [draftNumber, draftLinks] of links.entries()) {
    links.set(draftNumber, uniqueBy(draftLinks, (link) => link.personId).sort((a, b) => a.entry.localeCompare(b.entry)));
  }
  return links;
}

function stubMarkdown(row) {
  const lines = [
    `# ${row.draftNumber} - ${row.title}`,
    "",
    "## Compiler Fields",
    "",
    "- Final FRUS document number:",
    "- Final selection decision:",
    "- Full text or excerpt:",
    "- Owning volume:",
    "- Source-copy status:",
    "- Declassification status:",
    "- Persons authority status:",
    "- Annotation needs:",
    "- Compiler notes:",
    "",
    "## Draft Heading",
    "",
    `- Proposed heading: ${row.title}`,
    `- Date line: ${row.dateText || row.date || "Undated"}${row.country ? `; ${row.country}` : ""}`,
    `- Record type: ${row.recordType || "n/a"}`,
    `- Participants: ${row.participants.join("; ") || "n/a"}`,
    `- Readiness: ${row.readinessStatus}`,
    `- Stub status: ${row.stubStatus}`,
    "",
    "## Source Note",
    "",
    row.frusSourceNote || "Source note missing.",
    "",
    "## Catalog Controls",
    "",
    `- NAID: ${row.naid || "n/a"}`,
    `- Catalog: ${row.catalogUrl || "n/a"}`,
    `- PDF: ${row.pdfUrl || "n/a"}`,
    `- Page count: ${row.pageCount || "n/a"}`,
    `- Release status: ${row.releaseStatus || "n/a"}`,
    `- Catalog provenance: ${row.catalogProvenance || "n/a"}`,
    "",
    "## Diary / Backup Controls",
    "",
    row.diaryCrossReferenceNote ||
      "Date-matched Presidential Daily Diary/Backup leads should be used to verify time, location, attendees, call status, and scheduling context."
  ];

  if (row.diaryReferences.length) {
    lines.push("", ...row.diaryReferences.map((reference) => `- ${reference.kind}: ${reference.title}; NAID ${reference.naid}; ${reference.catalogUrl}`));
  } else {
    lines.push("", "- No diary/backup match in current data.");
  }

  lines.push("", "## Persons Authority", "");
  if (row.authorityEntries.length) {
    lines.push(...row.authorityEntries.map((entry) => `- ${entry}`));
  } else {
    lines.push("- No person authority links generated for this row.");
  }
  if (row.authorityReviewEntries.length) {
    lines.push("", "### Authority Reviews Needed", "", ...row.authorityReviewEntries.map((entry) => `- ${entry}`));
  }

  lines.push("", "## Blocker / Readiness Actions", "", `- Next action: ${row.nextAction || row.decisionNeeded || "Read and decide."}`);
  if (row.blockers.length) lines.push(`- Blockers: ${row.blockers.join("; ")}`);
  if (row.blocker) {
    lines.push(
      `- Resolution type: ${row.blocker.resolutionType}`,
      `- Recommended decision field: ${row.blocker.recommendedDecisionField}`,
      `- Search terms: ${row.blocker.searchTerms}`,
      `- Catalog search: ${row.blocker.catalogSearchUrl}`,
      "",
      "### Resolution Steps",
      "",
      ...row.blocker.actionSteps.map((step, index) => `${index + 1}. ${step}`)
    );
    if (row.blocker.comparatorVolumes?.length) {
      lines.push("", "### Cross-Volume Comparators", "", ...row.blocker.comparatorVolumes.map((volume) => `- ${volume.title}: ${volume.url} (${volume.use})`));
    }
    if (row.blocker.queryRows?.length) {
      lines.push("", "### Query Leads", "", ...row.blocker.queryRows.slice(0, 5).map((query) => `- ${query.queryLabel}: ${query.queryTerms}; ${query.sourcePoolSearchUrl || query.catalogSearchUrl}`));
    }
  }

  if (row.gapMentions.length) {
    lines.push("", "## Gap References", "", ...row.gapMentions.map((gap) => `- ${gap.priority}: ${gap.title}`));
  }

  lines.push(
    "",
    "## Text Transcription",
    "",
    "Text has not been transcribed in this assist packet. Open the PDF/catalog object, read the document, and paste selected text or excerpt notes here only after compiler review.",
    "",
    "## Annotation Notes",
    "",
    "- Public-paper/public-line references:",
    "- Related FRUS cross-references:",
    "- Editorial note candidates:",
    "- Declassification/excision note:",
    ""
  );

  return `${lines.join("\n").trim()}\n`;
}

function csvRow(row) {
  return {
    draftNumber: row.draftNumber,
    stubStatus: row.stubStatus,
    stubPath: row.stubPath,
    readinessStatus: row.readinessStatus,
    recommendation: row.recommendation,
    priority: row.priority,
    lane: row.lane,
    country: row.country,
    date: row.date,
    title: row.title,
    participants: row.participants.join("; "),
    releaseStatus: row.releaseStatus,
    naid: row.naid,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    authorityReviewCount: row.authorityReviewCount,
    authorityReviewEntries: row.authorityReviewEntries.join("; "),
    resolutionType: row.resolutionType,
    blockers: row.blockers.join("; "),
    diaryReferenceCount: row.diaryReferenceCount,
    hasFrusSourceNote: row.frusSourceNote ? "Yes" : "No",
    nextAction: row.nextAction || row.decisionNeeded
  };
}

function stubColumns() {
  return [
    "draftNumber",
    "stubStatus",
    "stubPath",
    "readinessStatus",
    "recommendation",
    "priority",
    "lane",
    "country",
    "date",
    "title",
    "participants",
    "releaseStatus",
    "naid",
    "catalogUrl",
    "pdfUrl",
    "authorityReviewCount",
    "authorityReviewEntries",
    "resolutionType",
    "blockers",
    "diaryReferenceCount",
    "hasFrusSourceNote",
    "nextAction"
  ];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Document Stubs",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}#document-stubs`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Document stubs: ${packet.summary.stubCount}`,
    `- Ready stubs: ${packet.summary.readyStubCount}`,
    `- Authority-check stubs: ${packet.summary.authorityStubCount}`,
    `- Blocker-resolution stubs: ${packet.summary.blockerStubCount}`,
    `- Source-note stubs: ${packet.summary.sourceNoteStubCount}`,
    `- Diary/backup controlled stubs: ${packet.summary.diaryControlledStubCount}`,
    "",
    "## Index",
    "",
    "- document-stubs/document-stub-index.csv",
    "",
    "## First Ready Stubs",
    "",
    ...packet.readyRows.slice(0, 12).map(indexLine),
    "",
    "## Authority-Check Stubs",
    "",
    ...packet.authorityRows.map(indexLine),
    "",
    "## Blocker-Resolution Stubs",
    "",
    ...packet.blockerRows.slice(0, 30).map(indexLine)
  ];
  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function indexLine(row) {
  return `- [${row.draftNumber} - ${row.title}](${row.stubPath.replace(/^reports\//, "")})`;
}

function rowSort(a, b) {
  return (a.sortDate || "").localeCompare(b.sortDate || "") || a.draftNumber.localeCompare(b.draftNumber);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
