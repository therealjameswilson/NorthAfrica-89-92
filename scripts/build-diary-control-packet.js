#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const diaryReportDir = path.join(reportDir, "diary-control");

const DIARY_SERIES = {
  title: "Presidential Daily Diary and Presidential Daily Backup Materials",
  naid: "186322",
  catalogUrl: "https://catalog.archives.gov/id/186322"
};

const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const readiness = readJson("document-readiness-packet");
const blockers = readJson("blocker-resolution-packet");
const stubs = readJson("document-stubs-packet");

const readinessByNaid = new Map((readiness.rows || []).filter((row) => row.naid).map((row) => [String(row.naid), row]));
const blockerByNaid = new Map((blockers.rows || []).filter((row) => row.naid).map((row) => [String(row.naid), row]));
const stubByNaid = new Map((stubs.rows || []).filter((row) => row.naid).map((row) => [String(row.naid), row]));
const boundaryNumbersByNaid = assignBoundaryNumbers(boundaryRecords);

const volumeRows = records.map((record) => controlRow(record, "Volume XX draft")).sort(rowSort);
const boundaryRows = boundaryRecords.map((record) => controlRow(record, "Boundary handoff")).sort(rowSort);
const rows = volumeRows.concat(boundaryRows).sort(rowSort).map((row, index) => ({ ...row, controlNumber: `DC-${String(index + 1).padStart(3, "0")}` }));
const matchedRows = rows.filter((row) => row.diaryReferenceCount > 0);
const missingRows = rows.filter((row) => row.diaryReferenceCount === 0);
const readyRows = rows.filter((row) => row.queue === "Ready first-pass" || row.queue === "Authority-check");
const blockerRows = rows.filter((row) => /blocker|Source-copy|Declassification|Cross-volume/i.test(row.queue));
const handoffRows = rows.filter((row) => row.scope === "Boundary handoff");
const references = uniqueReferences(rows);

const packetBody = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  sourceSeries: DIARY_SERIES,
  summary: {
    controlRows: rows.length,
    matchedRows: matchedRows.length,
    missingRows: missingRows.length,
    volumeRows: volumeRows.length,
    boundaryRows: boundaryRows.length,
    readyRows: readyRows.length,
    blockerRows: blockerRows.length,
    diaryReferenceCount: rows.reduce((sum, row) => sum + row.diaryReferenceCount, 0),
    uniqueDiaryReferenceCount: references.length,
    dailyDiaryReferenceCount: references.filter((reference) => reference.kind === "Daily Diary").length,
    dailyBackupReferenceCount: references.filter((reference) => reference.kind === "Daily Backup").length,
    callRows: rows.filter((row) => row.eventType === "Call").length,
    meetingRows: rows.filter((row) => row.eventType === "Meeting").length,
    csvFiles: [
      "reports/diary-control/all-diary-controls.csv",
      "reports/diary-control/ready-diary-controls.csv",
      "reports/diary-control/blocker-diary-controls.csv",
      "reports/diary-control/boundary-diary-controls.csv",
      "reports/diary-control/diary-reference-index.csv"
    ]
  },
  readyRows,
  blockerRows,
  boundaryRows: handoffRows,
  missingRows,
  references,
  rows
};

const previous = readOptionalJson(path.join(dataDir, "diary-control-packet.json"));
const packet = {
  generatedAt: sameBody(previous, packetBody) ? previous.generatedAt : new Date().toISOString(),
  ...packetBody
};

fs.mkdirSync(diaryReportDir, { recursive: true });
writeJsonPair("diary-control-packet", "DIARY_CONTROL_PACKET", packet);
fs.writeFileSync(path.join(diaryReportDir, "all-diary-controls.csv"), toCsv(packet.rows.map(csvRow), controlColumns()));
fs.writeFileSync(path.join(diaryReportDir, "ready-diary-controls.csv"), toCsv(packet.readyRows.map(csvRow), controlColumns()));
fs.writeFileSync(path.join(diaryReportDir, "blocker-diary-controls.csv"), toCsv(packet.blockerRows.map(csvRow), controlColumns()));
fs.writeFileSync(path.join(diaryReportDir, "boundary-diary-controls.csv"), toCsv(packet.boundaryRows.map(csvRow), controlColumns()));
fs.writeFileSync(path.join(diaryReportDir, "diary-reference-index.csv"), toCsv(packet.references.map(referenceCsvRow), referenceColumns()));
writeMarkdown(path.join(reportDir, "diary-control-packet.md"), packet);
writeStableJson(path.join(reportDir, "diary-control-packet-build.json"), {
  sourceSeriesNaid: packet.sourceSeries.naid,
  controlRows: packet.summary.controlRows,
  matchedRows: packet.summary.matchedRows,
  missingRows: packet.summary.missingRows,
  volumeRows: packet.summary.volumeRows,
  boundaryRows: packet.summary.boundaryRows,
  readyRows: packet.summary.readyRows,
  blockerRows: packet.summary.blockerRows,
  diaryReferenceCount: packet.summary.diaryReferenceCount,
  uniqueDiaryReferenceCount: packet.summary.uniqueDiaryReferenceCount,
  dailyDiaryReferenceCount: packet.summary.dailyDiaryReferenceCount,
  dailyBackupReferenceCount: packet.summary.dailyBackupReferenceCount,
  callRows: packet.summary.callRows,
  meetingRows: packet.summary.meetingRows,
  markdown: "reports/diary-control-packet.md",
  csvFiles: packet.summary.csvFiles
});

console.log(
  `Wrote diary controls: ${packet.summary.controlRows} rows, ${packet.summary.matchedRows} matched, ${packet.summary.uniqueDiaryReferenceCount} unique diary/backup file units.`
);

function controlRow(record, scope) {
  const naid = String(record.naid || "");
  const readinessRow = readinessByNaid.get(naid) || null;
  const blocker = blockerByNaid.get(naid) || null;
  const stub = stubByNaid.get(naid) || null;
  const referencesForRow = record.diaryReferences || [];
  const queue = queueFor(scope, readinessRow, blocker);
  return {
    id: record.id || `record-${naid}`,
    scope,
    queue,
    draftNumber: stub?.draftNumber || readinessRow?.draftNumber || boundaryNumbersByNaid.get(naid) || "",
    stubPath: stub?.stubPath || "",
    readinessStatus: readinessRow?.readinessStatus || (scope === "Boundary handoff" ? "Boundary handoff" : ""),
    resolutionType: blocker?.resolutionType || "",
    eventType: eventType(record.type),
    recordType: record.type || "",
    lane: record.chapter?.name || readinessRow?.lane || "",
    country: record.country || readinessRow?.country || "",
    date: record.date || "",
    sortDate: record.sortDate || record.date || "",
    dateText: record.dateText || record.date || "",
    title: record.title || "",
    participants: record.participants || [],
    counterpart: record.counterpart || "",
    releaseStatus: record.releaseStatus || "",
    naid,
    catalogUrl: record.catalogUrl || "",
    pdfUrl: record.pdfUrl || "",
    pageCount: record.pageCount || "",
    frusSourceNote: record.frusSourceNote || readinessRow?.frusSourceNote || "",
    diaryCrossReferenceNote:
      record.diaryCrossReferenceNote ||
      "Date-matched Presidential Daily Diary/Backup lead for time, location, attendees, call status, and scheduling context.",
    diaryReferenceCount: referencesForRow.length,
    diaryReferences: referencesForRow,
    diaryReferenceNaids: referencesForRow.map((reference) => reference.naid),
    diaryReferenceKinds: [...new Set(referencesForRow.map((reference) => reference.kind))],
    verificationTargets: verificationTargets(record.type),
    nextAction: nextActionFor(scope, readinessRow, blocker, referencesForRow.length)
  };
}

function queueFor(scope, readinessRow, blocker) {
  if (scope === "Boundary handoff") return "Boundary handoff";
  if (blocker?.resolutionType === "Source-copy search") return "Source-copy blocker";
  if (blocker?.resolutionType === "Declassification review") return "Declassification blocker";
  if (blocker?.resolutionType === "Cross-volume ownership") return "Cross-volume blocker";
  if (/authority/i.test(readinessRow?.readinessStatus || "")) return "Authority-check";
  if (/ready/i.test(readinessRow?.readinessStatus || "")) return "Ready first-pass";
  return readinessRow?.readinessStatus || "Volume XX draft";
}

function nextActionFor(scope, readinessRow, blocker, referenceCount) {
  if (!referenceCount) return "No current Daily Diary/Backup file-unit match; rerun the diary cross-reference builder or search NAID 186322 by date.";
  if (scope === "Boundary handoff") return "Preserve the diary/backup control note with the adjacent-volume handoff or chronology-only decision.";
  if (blocker?.resolutionType === "Cross-volume ownership") return "Use diary/backup timing and participants while deciding Volume XX ownership versus adjacent-volume handoff.";
  if (blocker?.resolutionType === "Source-copy search") return "Use diary/backup file units as duplicate-copy leads and to confirm whether a call or meeting actually occurred.";
  if (blocker?.resolutionType === "Declassification review") return "Use diary/backup context to frame MDR/referral questions without treating the diary as minutes.";
  if (/authority/i.test(readinessRow?.readinessStatus || "")) return "Verify participants against diary/backup context while resolving persons authority.";
  return "Open the diary/backup file unit beside the memo/telcon and confirm time, location, attendees, call status, and scheduling context.";
}

function eventType(type) {
  if (/telcon|call/i.test(type || "")) return "Call";
  if (/memcon|meeting/i.test(type || "")) return "Meeting";
  return "Conversation";
}

function verificationTargets(type) {
  if (/telcon|call/i.test(type || "")) {
    return ["call time", "call participant/routing sheet", "call completion or attempted-call status", "scheduling context"];
  }
  if (/memcon|meeting/i.test(type || "")) {
    return ["meeting time", "meeting location", "attendee list", "scheduling context"];
  }
  return ["date", "time", "participants", "scheduling context"];
}

function uniqueReferences(controlRows) {
  const map = new Map();
  for (const row of controlRows) {
    for (const reference of row.diaryReferences || []) {
      const key = String(reference.naid || `${reference.kind}-${reference.title}`);
      if (!map.has(key)) {
        map.set(key, {
          kind: reference.kind || "",
          date: reference.date || row.date,
          title: reference.title || "",
          naid: String(reference.naid || ""),
          catalogUrl: reference.catalogUrl || "",
          sourceNote: reference.sourceNote || "",
          rowCount: 0,
          rows: []
        });
      }
      const item = map.get(key);
      item.rowCount += 1;
      item.rows.push({
        controlNumber: row.controlNumber || "",
        draftNumber: row.draftNumber || "",
        title: row.title,
        country: row.country,
        queue: row.queue
      });
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

function assignBoundaryNumbers(items) {
  return new Map(
    [...items]
      .sort((a, b) => (a.country || "").localeCompare(b.country || "") || (a.sortDate || "").localeCompare(b.sortDate || ""))
      .map((item, index) => [String(item.naid || ""), `B-${String(index + 1).padStart(3, "0")}`])
  );
}

function rowSort(a, b) {
  return (a.sortDate || "").localeCompare(b.sortDate || "") || (a.country || "").localeCompare(b.country || "") || (a.title || "").localeCompare(b.title || "");
}

function csvRow(row) {
  return {
    controlNumber: row.controlNumber,
    scope: row.scope,
    queue: row.queue,
    draftNumber: row.draftNumber,
    stubPath: row.stubPath,
    readinessStatus: row.readinessStatus,
    resolutionType: row.resolutionType,
    eventType: row.eventType,
    recordType: row.recordType,
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
    pageCount: row.pageCount,
    diaryReferenceCount: row.diaryReferenceCount,
    diaryReferenceKinds: row.diaryReferenceKinds.join("; "),
    diaryReferenceNaids: row.diaryReferenceNaids.join("; "),
    diaryReferences: row.diaryReferences.map((reference) => `${reference.kind} NAID ${reference.naid}: ${reference.catalogUrl}`).join("; "),
    verificationTargets: row.verificationTargets.join("; "),
    nextAction: row.nextAction,
    frusSourceNote: row.frusSourceNote
  };
}

function referenceCsvRow(reference) {
  return {
    kind: reference.kind,
    date: reference.date,
    title: reference.title,
    naid: reference.naid,
    catalogUrl: reference.catalogUrl,
    rowCount: reference.rowCount,
    linkedRows: reference.rows.map((row) => [row.controlNumber, row.draftNumber, row.country, row.queue].filter(Boolean).join(" / ")).join("; "),
    sourceNote: reference.sourceNote
  };
}

function controlColumns() {
  return [
    "controlNumber",
    "scope",
    "queue",
    "draftNumber",
    "stubPath",
    "readinessStatus",
    "resolutionType",
    "eventType",
    "recordType",
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
    "pageCount",
    "diaryReferenceCount",
    "diaryReferenceKinds",
    "diaryReferenceNaids",
    "diaryReferences",
    "verificationTargets",
    "nextAction",
    "frusSourceNote"
  ];
}

function referenceColumns() {
  return ["kind", "date", "title", "naid", "catalogUrl", "rowCount", "linkedRows", "sourceNote"];
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Daily Diary / Backup Controls",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}#diary-controls`,
    `Source series: ${packet.sourceSeries.title}, NAID ${packet.sourceSeries.naid} (${packet.sourceSeries.catalogUrl})`,
    "",
    "## Summary",
    "",
    `- Control rows: ${packet.summary.controlRows}`,
    `- Matched rows: ${packet.summary.matchedRows}`,
    `- Missing rows: ${packet.summary.missingRows}`,
    `- Ready/authority rows: ${packet.summary.readyRows}`,
    `- Blocker rows: ${packet.summary.blockerRows}`,
    `- Boundary rows: ${packet.summary.boundaryRows}`,
    `- Unique diary/backup file units: ${packet.summary.uniqueDiaryReferenceCount}`,
    "",
    "## Compiler Use",
    "",
    "Use these rows to verify time, location, attendees, call status, and scheduling context. The diary and backup materials are controls, not substitutes for the memorandum of conversation or telephone conversation text.",
    "",
    "## CSV Worklists",
    "",
    ...packet.summary.csvFiles.map((file) => `- [${file}](${file.replace(/^reports\//, "")})`),
    "",
    "## Ready / Authority Controls",
    "",
    ...packet.readyRows.slice(0, 20).map(markdownRow),
    "",
    "## Blocker Controls",
    "",
    ...packet.blockerRows.slice(0, 30).map(markdownRow),
    "",
    "## Boundary Handoff Controls",
    "",
    ...packet.boundaryRows.slice(0, 20).map(markdownRow)
  ];
  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function markdownRow(row) {
  const href = row.stubPath || row.catalogUrl;
  const label = [row.controlNumber, row.draftNumber, row.title].filter(Boolean).join(" - ");
  const refs = row.diaryReferences.map((reference) => `${reference.kind} NAID ${reference.naid}`).join("; ");
  return `- [${label}](${href.replace(/^reports\//, "")}) - ${row.dateText}; ${row.country}; ${row.queue}; ${refs}.`;
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
