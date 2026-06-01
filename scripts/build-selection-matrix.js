#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const records = assignCompilerNumbers(readJson("records"));
const boundaryRecords = assignBoundaryNumbers(readJson("boundary-records"));
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");

const matrix = [
  ...records.map((record) => conversationEntry(record, false)),
  ...boundaryRecords.map((record) => conversationEntry(record, true)),
  ...policyFiles.map(policyEntry),
  ...publicReferences.map(publicEntry)
].sort(selectionSort);

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, "selection-matrix-build.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      selectionCount: matrix.length,
      byRecommendation: countBy(matrix.map((item) => item.recommendation)),
      byPriority: countBy(matrix.map((item) => item.priority)),
      byRecordType: countBy(matrix.map((item) => item.recordType))
    },
    null,
    2
  )}\n`
);

console.log(`Verified ${matrix.length} compiler selection matrix rows.`);

function conversationEntry(record, isBoundary) {
  const flags = [];
  if (record.diaryReferences?.length) flags.push("Diary/backup matched");
  if (/partial|restricted/i.test(record.releaseStatus || "")) flags.push("Partial/restricted release");
  if (/marker|no memorandum|no public pdf/i.test(record.releaseStatus || "") || !record.documentAvailable) {
    flags.push("Source-copy lead");
  }
  if (record.country === "Egypt") flags.push("Egypt cross-volume screen");
  if (isGulfCrisisEgypt(record)) flags.push("Persian Gulf crisis overlap");
  if (isBoundary) flags.push("Boundary row");

  const recommendation = recommendationForConversation(record, isBoundary);
  return compact({
    id: `selection-${record.id || record.naid}`,
    sourceId: record.id || "",
    compilerNumber: record.compilerNumber || "",
    recordType: record.type || "Conversation",
    recommendation,
    priority: priorityForConversation(record, isBoundary, recommendation),
    lane: record.chapter?.name || "",
    country: record.country || "",
    date: record.date || "",
    sortDate: record.sortDate || record.date || "",
    dateText: record.dateText || record.date || "",
    title: record.title || "",
    participants: record.participants || [],
    releaseStatus: record.releaseStatus || "",
    naid: record.naid || "",
    catalogUrl: record.catalogUrl || "",
    pdfUrl: record.pdfUrl || "",
    pageCount: record.pageCount || 0,
    flags,
    basis: basisForConversation(record, isBoundary, recommendation),
    nextAction: nextActionForConversation(record, isBoundary, recommendation),
    frusSourceNote: record.frusSourceNote || "",
    sourceNote: record.sourceNote || "",
    diaryReferences: record.diaryReferences || [],
    diaryCrossReferenceNote: record.diaryCrossReferenceNote || ""
  });
}

function policyEntry(file) {
  const isBoundary = file.priority === "Boundary" || /Boundary/i.test(file.lane || "");
  const recommendation = isBoundary ? "Boundary handoff" : "Policy anchor candidate";
  return compact({
    id: `selection-${file.id || file.naid}`,
    sourceId: file.id || "",
    compilerNumber: "",
    recordType: "Policy file",
    recommendation,
    priority: isBoundary ? "Boundary" : file.priority || "High",
    lane: file.lane || "",
    country: "",
    date: file.date || "",
    sortDate: file.sortDate || file.date || "",
    dateText: file.dateText || file.date || "",
    title: file.title || "",
    participants: [],
    releaseStatus: file.accessRestriction || "",
    naid: file.naid || "",
    catalogUrl: file.catalogUrl || "",
    pdfUrl: file.pdfUrl || "",
    pageCount: file.pageCount || 0,
    flags: [file.priority || "Policy file", file.levelOfDescription || ""].filter(Boolean),
    basis: file.reason || "Policy file surfaced as a source anchor for compilation review.",
    nextAction: isBoundary
      ? "Confirm adjacent-volume ownership before selecting or citing this file."
      : "Review file contents for policy papers, decision memoranda, meeting materials, and source-document candidates.",
    frusSourceNote: file.frusSourceNote || "",
    sourceNote: file.sourceNote || ""
  });
}

function publicEntry(item) {
  return compact({
    id: `selection-${item.id}`,
    sourceId: item.id || "",
    compilerNumber: "",
    recordType: item.documentType || "Public Papers reference",
    recommendation: "Public-line/context check",
    priority: "Context",
    lane: item.chapter || "",
    country: "",
    date: item.date || "",
    sortDate: item.sortDate || item.date || "",
    dateText: item.dateText || item.date || "",
    title: item.title || "",
    participants: [],
    releaseStatus: "",
    naid: "",
    catalogUrl: item.govinfoUrl || "",
    pdfUrl: item.pdfUrl || "",
    pageCount: 0,
    flags: item.matchedTerms || [],
    basis: item.relevance || "Public Papers reference for public-line and chronology checks.",
    nextAction: "Use to verify public posture, public chronology, and whether a private source document needs to be paired with public remarks.",
    frusSourceNote: item.frusSourceNote || "",
    sourceNote: item.sourceNote || item.citation || ""
  });
}

function recommendationForConversation(record, isBoundary) {
  if (isBoundary) return "Boundary handoff";
  if (/marker|no memorandum/i.test(record.releaseStatus || "") || !record.documentAvailable) return "Source-copy search";
  if (/partial|restricted/i.test(record.releaseStatus || "")) return "Declassification review";
  if (isGulfCrisisEgypt(record) || record.country === "Egypt") return "Cross-volume review";
  return "Candidate core document";
}

function priorityForConversation(record, isBoundary, recommendation) {
  if (isBoundary) return "Boundary";
  if (recommendation === "Source-copy search") return "Critical";
  if (recommendation === "Declassification review") return "High";
  if (recommendation === "Cross-volume review") return isGulfCrisisEgypt(record) ? "Critical" : "High";
  return "High";
}

function basisForConversation(record, isBoundary, recommendation) {
  if (isBoundary) {
    return record.boundaryReason || "Adjacent-volume boundary row retained for handoff control.";
  }
  if (recommendation === "Source-copy search") {
    return "Catalog row has no public memorandum/PDF or is marked as a no-memorandum entry; verify whether a duplicate source copy exists.";
  }
  if (recommendation === "Declassification review") {
    return "Public release is partial or restricted; review redactions, withdrawal sheets, and duplicate source copies before selection.";
  }
  if (recommendation === "Cross-volume review") {
    return isGulfCrisisEgypt(record)
      ? "Egypt record falls in the Persian Gulf crisis window and needs ownership review against Gulf and Arab-Israeli volumes."
      : "Egypt record belongs geographically in Volume XX but needs screening against Arab-Israeli, Gulf, and terrorism volume boundaries.";
  }
  return "Declassified conversation row in a Volume XX geographic lane with direct FRUS source-note and diary/backup support.";
}

function nextActionForConversation(record, isBoundary, recommendation) {
  if (isBoundary) return "Confirm exclude, excerpt, cite-elsewhere, or adjacent-volume handoff decision.";
  if (recommendation === "Source-copy search") {
    return "Search Presidential Daily Diary/Backup, Scowcroft files, Presidential Daily File, and State files for duplicate source-copy evidence.";
  }
  if (recommendation === "Declassification review") {
    return "Assess whether redactions block selection; queue MDR/referral or locate cleaner duplicate copies.";
  }
  if (recommendation === "Cross-volume review") {
    return "Tag primary volume ownership before selecting; retain only Africa-specific substance for Volume XX.";
  }
  return "Read for substance, prepare selection/excerpt decision, and verify persons/source notes.";
}

function isGulfCrisisEgypt(record) {
  if (record.country !== "Egypt") return false;
  const date = record.sortDate || record.date || "";
  return date >= "1990-08-02" && date <= "1991-03-03";
}

function assignCompilerNumbers(items) {
  const counts = new Map();
  return [...items]
    .sort(byChapterThenDate)
    .map((item) => {
      const key = item.chapter?.name || "Regional and Multilateral";
      const count = (counts.get(key) || 0) + 1;
      counts.set(key, count);
      return {
        ...item,
        compilerNumber: `XX-${item.chapter?.number || 0}.${String(count).padStart(3, "0")}`
      };
    });
}

function assignBoundaryNumbers(items) {
  return [...items]
    .sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.sortDate || "").localeCompare(b.sortDate || ""))
    .map((item, index) => ({ ...item, compilerNumber: `B-${String(index + 1).padStart(3, "0")}` }));
}

function byChapterThenDate(a, b) {
  return (
    (a.chapter?.number || 99) - (b.chapter?.number || 99) ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function selectionSort(a, b) {
  return (
    recommendationRank(a.recommendation) - recommendationRank(b.recommendation) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    (a.lane || "").localeCompare(b.lane || "") ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function recommendationRank(recommendation) {
  return (
    {
      "Candidate core document": 1,
      "Policy anchor candidate": 2,
      "Declassification review": 3,
      "Source-copy search": 4,
      "Cross-volume review": 5,
      "Boundary handoff": 6,
      "Public-line/context check": 7
    }[recommendation] || 99
  );
}

function priorityRank(priority) {
  return ({ Critical: 1, High: 2, Medium: 3, Active: 4, Boundary: 5, Context: 6 }[priority] || 99);
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return entry !== "" && entry !== null && entry !== undefined;
    })
  );
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}
