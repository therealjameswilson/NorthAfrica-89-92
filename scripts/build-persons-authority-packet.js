#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const authorityReportDir = path.join(reportDir, "persons-authority");

const persons = readJson("persons");
const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const gapTracker = readJson("gap-tracker");
const draftDocumentList = readJson("draft-document-list");
const personsBuild = readOptionalJson(path.join(reportDir, "persons-list-build.json")) || {};

const documentSources = [
  ...records.map((record) => documentRow(record, "Chronology", "Chronology row")),
  ...boundaryRecords.map((record) => documentRow(record, "Boundary", "Boundary handoff")),
  ...(draftDocumentList.proposedRows || []).map((record) => documentRow(record, "Draft", "Proposed")),
  ...(draftDocumentList.conditionalRows || []).map((record) => documentRow(record, "Draft", "Conditional"))
];

const personPackets = persons.map((person) => {
  const terms = personTerms(person);
  const matchedDocuments = documentSources
    .filter((document) => documentMatches(document, terms))
    .sort(documentSort);
  const gapMentions = gapTracker.filter((gap) => gapMatches(gap, terms)).map(gapRow).sort(gapSort);
  const priority = reviewPriority(person, matchedDocuments, gapMentions);
  const documentLinks = matchedDocuments.map((document) => personDocumentLink(person, document, priority));
  return {
    ...person,
    reviewPriority: priority,
    nextAction: nextAction(person, documentLinks, gapMentions),
    documentCount: documentLinks.length,
    proposedDocumentCount: documentLinks.filter((link) => link.proposalStatus === "Proposed").length,
    conditionalDocumentCount: documentLinks.filter((link) => link.proposalStatus === "Conditional").length,
    gapMentionCount: gapMentions.length,
    firstDocumentDate: documentLinks[0]?.date || "",
    documentLinks,
    gapMentions
  };
});

const reviewRows = personPackets
  .filter((person) => person.needsReview)
  .sort(
    (a, b) =>
      priorityRank(a.reviewPriority) - priorityRank(b.reviewPriority) ||
      b.documentCount - a.documentCount ||
      (a.sortKey || a.name).localeCompare(b.sortKey || b.name)
  );
const documentLinkRows = personPackets.flatMap((person) => person.documentLinks);
const allPersonRows = personPackets.map(allPersonCsvRow);

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  authority: {
    source: personsBuild.namesDocxSource || "Bush Comprehensive Names List.docx",
    mode: personsBuild.authorityMode || "",
    entryCount: personsBuild.authorityEntryCount || 0,
    selectedPersonCount: persons.length,
    matchedAuthorityCount: persons.filter((person) => person.source === "Bush Comprehensive Names List").length,
    reviewCount: reviewRows.length
  },
  summary: {
    personCount: persons.length,
    authorityMatchedCount: persons.filter((person) => person.source === "Bush Comprehensive Names List").length,
    reviewCount: reviewRows.length,
    documentLinkCount: documentLinkRows.length,
    reviewDocumentLinkCount: reviewRows.reduce((sum, person) => sum + person.documentCount, 0),
    proposedDocumentLinkCount: documentLinkRows.filter((row) => row.proposalStatus === "Proposed").length,
    conditionalDocumentLinkCount: documentLinkRows.filter((row) => row.proposalStatus === "Conditional").length,
    gapMentionCount: personPackets.reduce((sum, person) => sum + person.gapMentionCount, 0),
    highPriorityReviewCount: reviewRows.filter((row) => row.reviewPriority === "High").length,
    csvFiles: [
      "reports/persons-authority/authority-review.csv",
      "reports/persons-authority/person-document-links.csv",
      "reports/persons-authority/all-persons-authority.csv"
    ]
  },
  reviewRows,
  persons: personPackets
};

const previous = readOptionalJson(path.join(dataDir, "persons-authority-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(authorityReportDir, { recursive: true });

writeJsonPair("persons-authority-packet", "PERSONS_AUTHORITY_PACKET", packet);
fs.writeFileSync(path.join(authorityReportDir, "authority-review.csv"), toCsv(reviewRows.map(reviewCsvRow), reviewColumns()));
fs.writeFileSync(path.join(authorityReportDir, "person-document-links.csv"), toCsv(documentLinkRows, documentColumns()));
fs.writeFileSync(path.join(authorityReportDir, "all-persons-authority.csv"), toCsv(allPersonRows, allPersonColumns()));
writeMarkdown(path.join(reportDir, "persons-authority-packet.md"), packet);
writeStableJson(path.join(reportDir, "persons-authority-packet-build.json"), {
  personCount: packet.summary.personCount,
  authorityMatchedCount: packet.summary.authorityMatchedCount,
  reviewCount: packet.summary.reviewCount,
  documentLinkCount: packet.summary.documentLinkCount,
  reviewDocumentLinkCount: packet.summary.reviewDocumentLinkCount,
  proposedDocumentLinkCount: packet.summary.proposedDocumentLinkCount,
  conditionalDocumentLinkCount: packet.summary.conditionalDocumentLinkCount,
  gapMentionCount: packet.summary.gapMentionCount,
  highPriorityReviewCount: packet.summary.highPriorityReviewCount,
  authorityMode: packet.authority.mode,
  authorityEntryCount: packet.authority.entryCount,
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote persons authority packet: ${packet.summary.personCount} persons, ${packet.summary.reviewCount} review rows, ${packet.summary.documentLinkCount} document links.`
);

function documentRow(record, context, proposalStatus) {
  return {
    context,
    proposalStatus,
    draftNumber: record.draftNumber || "",
    recommendation: record.recommendation || "",
    editorialStatus: record.editorialStatus || "",
    priority: record.priority || "",
    lane: record.lane || record.chapter?.name || "",
    country: record.country || "",
    date: record.date || "",
    sortDate: record.sortDate || record.date || "",
    dateText: record.dateText || "",
    recordType: record.recordType || record.type || "",
    title: record.title || record.documentTitle || "",
    participants: record.participants || [],
    releaseStatus: record.releaseStatus || "",
    naid: record.naid || "",
    catalogUrl: record.catalogUrl || "",
    pdfUrl: record.pdfUrl || "",
    pageCount: record.pageCount || "",
    decisionNeeded: record.decisionNeeded || "",
    basis: record.basis || "",
    frusSourceNote: record.frusSourceNote || "",
    sourceNote: record.sourceNote || "",
    diaryReferences: record.diaryReferences || []
  };
}

function personTerms(person) {
  const values = [
    person.name,
    person.displayName,
    entryName(person.entry),
    ...(person.aliases || [])
  ];
  return uniqueSorted(values.map(normalize).filter((value) => value.length > 2));
}

function entryName(entry) {
  const parts = String(entry || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && !/^(King|President|Prime Minister|Foreign Minister|Minister|Ambassador|Secretary|Leader|leader)\b/.test(parts[1])) {
    return `${parts[1]} ${parts[0]}`;
  }
  return parts[0] || entry;
}

function documentMatches(document, terms) {
  const participantText = normalize((document.participants || []).join(" "));
  const titleText = normalize(document.title || "");
  return terms.some((term) => participantText.includes(term) || titleText.includes(term));
}

function gapMatches(gap, terms) {
  const haystack = normalize(
    [
      gap.title,
      gap.evidence,
      gap.problem,
      gap.needed,
      ...(gap.nextActions || []),
      ...(gap.targetTerms || []),
      ...(gap.sourcePools || []).flatMap((pool) => [pool.name, pool.repository, pool.series, ...(pool.queries || [])])
    ].join(" ")
  );
  return terms.some((term) => haystack.includes(term));
}

function personDocumentLink(person, document, reviewPriority) {
  return {
    personId: person.id,
    personName: person.name || "",
    displayName: person.displayName || "",
    entry: person.entry || "",
    needsReview: person.needsReview ? "Yes" : "No",
    authorityStatus: person.authorityStatus || "",
    reviewPriority,
    context: document.context,
    proposalStatus: document.proposalStatus,
    draftNumber: document.draftNumber,
    recommendation: document.recommendation,
    editorialStatus: document.editorialStatus,
    priority: document.priority,
    lane: document.lane,
    country: document.country,
    date: document.date,
    dateText: document.dateText,
    recordType: document.recordType,
    title: document.title,
    participants: document.participants.join("; "),
    releaseStatus: document.releaseStatus,
    naid: document.naid,
    catalogUrl: document.catalogUrl,
    pdfUrl: document.pdfUrl,
    pageCount: document.pageCount,
    decisionNeeded: document.decisionNeeded,
    frusSourceNote: document.frusSourceNote,
    catalogProvenance: document.sourceNote,
    diaryReferences: formatDiaryReferences(document)
  };
}

function gapRow(gap) {
  return {
    id: gap.id || "",
    priority: gap.priority || "",
    status: gap.status || "",
    lane: gap.lane || "",
    title: gap.title || "",
    needed: gap.needed || "",
    nextActions: (gap.nextActions || []).join("; "),
    targetTerms: (gap.targetTerms || []).join("; ")
  };
}

function reviewPriority(person, documentLinks, gapMentions) {
  if (!person.needsReview) return "None";
  if (documentLinks.some((link) => link.proposalStatus === "Proposed" || link.proposalStatus === "Conditional")) return "High";
  if ((person.scopes || []).includes("Compiler source target") || gapMentions.some((gap) => gap.priority === "Critical")) return "High";
  if (documentLinks.length || (person.scopes || []).includes("Volume XX chronology")) return "Medium";
  if ((person.scopes || []).includes("Boundary handoff")) return "Medium";
  return "Low";
}

function nextAction(person, documentLinks, gapMentions) {
  if (!person.needsReview) return "No authority action needed unless the final selected document text introduces a new form.";
  const context = [];
  if (documentLinks.some((link) => link.proposalStatus === "Proposed")) context.push("proposed document");
  if (documentLinks.some((link) => link.proposalStatus === "Conditional")) context.push("conditional document");
  if (gapMentions.length) context.push("open gap");
  if ((person.scopes || []).includes("Compiler source target")) context.push("compiler source target");
  const contextText = context.length ? ` before finalizing the ${uniqueSorted(context).join(", ")} row(s)` : "";
  if (person.authorityStatus === "normalized") {
    return `Confirm the normalized display form against the Bush names authority list and Volume XX document text${contextText}.`;
  }
  return `Verify the final FRUS entry form, office dates, and transliteration against the Bush names authority list and a second authority source${contextText}.`;
}

function reviewCsvRow(person) {
  return {
    reviewPriority: person.reviewPriority,
    name: person.name || "",
    suggestedFinalEntry: person.entry || "",
    displayName: person.displayName || "",
    description: person.description || "",
    currentAuthorityStatus: person.authorityStatus || "",
    source: person.source || "",
    scopes: (person.scopes || []).join("; "),
    places: (person.places || []).join("; "),
    aliases: (person.aliases || []).join("; "),
    documentCount: person.documentCount,
    proposedDocumentCount: person.proposedDocumentCount,
    conditionalDocumentCount: person.conditionalDocumentCount,
    gapMentionCount: person.gapMentionCount,
    firstDocumentDate: person.firstDocumentDate,
    documentRefs: person.documentLinks.map(documentRef).join("; "),
    gapRefs: person.gapMentions.map((gap) => `${gap.priority}: ${gap.title}`).join("; "),
    nextAction: person.nextAction,
    reviewReason: person.reviewReason || ""
  };
}

function allPersonCsvRow(person) {
  return {
    name: person.name || "",
    displayName: person.displayName || "",
    entry: person.entry || "",
    description: person.description || "",
    authorityStatus: person.authorityStatus || "",
    needsReview: person.needsReview ? "Yes" : "No",
    reviewPriority: person.reviewPriority,
    scopes: (person.scopes || []).join("; "),
    places: (person.places || []).join("; "),
    aliases: (person.aliases || []).join("; "),
    source: person.source || "",
    documentCount: person.documentCount,
    proposedDocumentCount: person.proposedDocumentCount,
    conditionalDocumentCount: person.conditionalDocumentCount,
    gapMentionCount: person.gapMentionCount,
    reviewReason: person.reviewReason || "",
    nextAction: person.nextAction
  };
}

function documentRef(row) {
  return [row.draftNumber || row.context, row.date || row.dateText, row.title, row.naid ? `NAID ${row.naid}` : ""].filter(Boolean).join(" - ");
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Persons Authority Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}persons.html`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Authority Source",
    "",
    `- Source: ${packet.authority.source}`,
    `- Mode: ${packet.authority.mode || "n/a"}`,
    `- Authority entries read: ${packet.authority.entryCount}`,
    `- Selected Volume XX persons: ${packet.authority.selectedPersonCount}`,
    `- Authority matches: ${packet.authority.matchedAuthorityCount}`,
    `- Compiler review rows: ${packet.authority.reviewCount}`,
    "",
    "## CSV Outputs",
    "",
    ...packet.summary.csvFiles.map((filePath) => `- ${filePath.replace(/^reports\//, "")}`),
    "",
    "## Review Queue",
    ""
  ];

  for (const person of packet.reviewRows) {
    lines.push(
      `### ${person.reviewPriority}: ${person.entry}`,
      "",
      `- Review reason: ${person.reviewReason || "n/a"}`,
      `- Scopes: ${(person.scopes || []).join("; ") || "n/a"}`,
      `- Places: ${(person.places || []).join("; ") || "n/a"}`,
      `- Aliases: ${(person.aliases || []).join("; ") || "n/a"}`,
      `- Documents: ${person.documentCount} (${person.proposedDocumentCount} proposed; ${person.conditionalDocumentCount} conditional)`,
      `- Gaps: ${person.gapMentionCount}`,
      `- Next action: ${person.nextAction}`,
      ""
    );
    for (const link of person.documentLinks.slice(0, 5)) {
      lines.push(`- ${documentRef(link)}`);
      if (link.frusSourceNote) lines.push(`  - FRUS source note: ${link.frusSourceNote}`);
    }
    if (person.gapMentions.length) {
      lines.push("- Gap references:");
      for (const gap of person.gapMentions.slice(0, 3)) lines.push(`  - ${gap.priority}: ${gap.title}`);
    }
    lines.push("");
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function reviewColumns() {
  return [
    "reviewPriority",
    "name",
    "suggestedFinalEntry",
    "displayName",
    "description",
    "currentAuthorityStatus",
    "source",
    "scopes",
    "places",
    "aliases",
    "documentCount",
    "proposedDocumentCount",
    "conditionalDocumentCount",
    "gapMentionCount",
    "firstDocumentDate",
    "documentRefs",
    "gapRefs",
    "nextAction",
    "reviewReason"
  ];
}

function documentColumns() {
  return [
    "personId",
    "personName",
    "displayName",
    "entry",
    "needsReview",
    "authorityStatus",
    "reviewPriority",
    "context",
    "proposalStatus",
    "draftNumber",
    "recommendation",
    "editorialStatus",
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
    "frusSourceNote",
    "catalogProvenance",
    "diaryReferences"
  ];
}

function allPersonColumns() {
  return [
    "name",
    "displayName",
    "entry",
    "description",
    "authorityStatus",
    "needsReview",
    "reviewPriority",
    "scopes",
    "places",
    "aliases",
    "source",
    "documentCount",
    "proposedDocumentCount",
    "conditionalDocumentCount",
    "gapMentionCount",
    "reviewReason",
    "nextAction"
  ];
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

function documentSort(a, b) {
  return (
    (a.date || "").localeCompare(b.date || "") ||
    contextRank(a.context) - contextRank(b.context) ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function gapSort(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || (a.title || "").localeCompare(b.title || "");
}

function priorityRank(priority) {
  return { High: 0, Critical: 0, Medium: 1, Boundary: 2, Low: 3, None: 4 }[priority] ?? 5;
}

function contextRank(context) {
  return { Draft: 0, Chronology: 1, Boundary: 2 }[context] ?? 3;
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
