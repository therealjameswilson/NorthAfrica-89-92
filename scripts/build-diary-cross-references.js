#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const CATALOG_SEARCH_URL = "https://catalog.archives.gov/proxy/records/search";
const DIARY_SERIES_NAID = "186322";
const DIARY_SERIES_URL = `https://catalog.archives.gov/id/${DIARY_SERIES_NAID}`;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  const records = readJson("records");
  const boundaryRecords = readJson("boundary-records");
  const targetDates = new Set(records.concat(boundaryRecords).map((record) => record.date).filter(Boolean));
  const { series, fileUnits } = await fetchDiaryFileUnits(targetDates);
  const referencesByDate = groupReferencesByDate(fileUnits, series);

  const enrichedRecords = records.map((record) => enrichRecord(record, referencesByDate));
  const enrichedBoundaryRecords = boundaryRecords.map((record) => enrichRecord(record, referencesByDate));
  writeJsonPair("records", "VOLUME_RECORDS", enrichedRecords);
  writeJsonPair("boundary-records", "BOUNDARY_RECORDS", enrichedBoundaryRecords);

  const matchedDates = [...targetDates].filter((date) => referencesByDate.has(date));
  const missingDates = [...targetDates].filter((date) => !referencesByDate.has(date)).sort();
  const matchedRecords = enrichedRecords.concat(enrichedBoundaryRecords).filter((record) => record.diaryReferences?.length);

  fs.writeFileSync(
    path.join(reportDir, "diary-cross-references-build.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          title: series.title,
          naid: DIARY_SERIES_NAID,
          catalogUrl: DIARY_SERIES_URL,
          levelOfDescription: series.levelOfDescription,
          dateNote: series.dateNote || "",
          accessRestriction: series.accessRestriction?.status || ""
        },
        diaryBackupFileUnitCount: fileUnits.length,
        targetDateCount: targetDates.size,
        matchedDateCount: matchedDates.length,
        missingDateCount: missingDates.length,
        matchedRecordCount: matchedRecords.length,
        missingDates
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote diary cross-references for ${matchedRecords.length} records across ${matchedDates.length} dates.`);
}

function enrichRecord(record, referencesByDate) {
  const references = referencesByDate.get(record.date) || [];
  const { diaryReferences, diaryCrossReferenceNote, ...rest } = record;
  if (!references.length) return rest;
  return {
    ...rest,
    diaryReferences: references,
    diaryCrossReferenceNote:
      "Date-matched Presidential Daily Diary/Backup lead. Use to verify time, location, attendees, call status, and scheduling context; the series does not usually provide meeting minutes or call summaries."
  };
}

function groupReferencesByDate(fileUnits, series) {
  const grouped = new Map();
  for (const fileUnit of fileUnits) {
    const date = dateFromTitle(fileUnit.title);
    const kind = diaryKind(fileUnit.title);
    if (!date || !kind) continue;
    const reference = {
      kind,
      date,
      title: fileUnit.title,
      naid: String(fileUnit.naId),
      catalogUrl: catalogUrl(fileUnit.naId),
      sourceNote: buildDiarySourceNote(fileUnit, series)
    };
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(reference);
  }

  for (const references of grouped.values()) {
    references.sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.title.localeCompare(b.title));
  }
  return grouped;
}

async function fetchDiaryFileUnits(targetDates) {
  const series = await fetchCatalogRecord(DIARY_SERIES_NAID);
  const fileUnits = new Map();
  const firstPage = await fetchAncestorPage(1);
  const total = firstPage.total || series.fileUnitCount || 3008;
  const pages = Math.ceil(total / 20);

  addDiaryFileUnits(fileUnits, firstPage.records);
  for (let page = 2; page <= pages; page += 1) {
    const pageResult = await fetchAncestorPage(page);
    addDiaryFileUnits(fileUnits, pageResult.records);
  }

  for (const date of targetDates) {
    if (hasFileUnitForDate(fileUnits, date)) continue;
    for (const record of await fetchDateFileUnits(date)) {
      addDiaryFileUnits(fileUnits, [record]);
    }
  }

  return {
    series,
    fileUnits: [...fileUnits.values()].sort((a, b) => (dateFromTitle(a.title) || "").localeCompare(dateFromTitle(b.title) || ""))
  };
}

function hasFileUnitForDate(fileUnits, date) {
  return [...fileUnits.values()].some((record) => dateFromTitle(record.title) === date);
}

function addDiaryFileUnits(fileUnits, records) {
  for (const record of records) {
    if (record.levelOfDescription !== "fileUnit") continue;
    if (!diaryKind(record.title)) continue;
    if (!dateFromTitle(record.title)) continue;
    fileUnits.set(String(record.naId), record);
  }
}

async function fetchCatalogRecord(naid) {
  const url = new URL(CATALOG_SEARCH_URL);
  url.searchParams.set("naId", String(naid));
  const json = await fetchJson(url);
  const record = json.body?.hits?.hits?.[0]?._source?.record;
  if (!record) throw new Error(`No Catalog record for NAID ${naid}`);
  return record;
}

async function fetchAncestorPage(page) {
  const url = new URL(CATALOG_SEARCH_URL);
  url.searchParams.set("ancestorNaId", DIARY_SERIES_NAID);
  url.searchParams.set("page", String(page));
  const json = await fetchJson(url);
  return {
    total: json.body?.hits?.total?.value || 0,
    records: (json.body?.hits?.hits || []).map((hit) => hit._source?.record).filter(Boolean)
  };
}

async function fetchDateFileUnits(date) {
  const results = new Map();
  for (const query of dateQueries(date)) {
    const url = new URL(CATALOG_SEARCH_URL);
    url.searchParams.set("ancestorNaId", DIARY_SERIES_NAID);
    url.searchParams.set("q", query);
    const json = await fetchJson(url);
    for (const record of (json.body?.hits?.hits || []).map((hit) => hit._source?.record).filter(Boolean)) {
      if (record.levelOfDescription !== "fileUnit") continue;
      if (!diaryKind(record.title)) continue;
      if (dateFromTitle(record.title) !== date) continue;
      results.set(String(record.naId), record);
    }
  }
  return [...results.values()];
}

function dateQueries(date) {
  const [year, month, day] = date.split("-").map(Number);
  return [
    `${month}/${day}/${year}`,
    `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`
  ];
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Catalog status ${response.status} for ${url}`);
  if (/^\s*</.test(text)) throw new Error(`Catalog returned HTML for ${url}`);
  return JSON.parse(text);
}

function dateFromTitle(title) {
  const value = String(title || "");
  const spaced = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const compact = value.match(/(\d{1,2})\/(\d{2})(\d{4})/);
  const match = spaced || compact;
  if (!match) return "";
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function diaryKind(title) {
  if (/Presidential Daily Diary/i.test(title || "")) return "Daily Diary";
  if (/Presidential Daily Backup/i.test(title || "")) return "Daily Backup";
  return "";
}

function kindRank(kind) {
  return kind === "Daily Diary" ? 1 : 2;
}

function buildDiarySourceNote(fileUnit, series) {
  return [
    `Source: George H.W. Bush Library, White House Office of Appointments and Scheduling Files, ${series.title}, ${fileUnit.title}.`,
    `Catalog metadata records access status as ${fileUnit.accessRestriction?.status || series.accessRestriction?.status || "not stated"}.`,
    `Catalog reference: NAID ${fileUnit.naId}.`
  ].join(" ");
}

function catalogUrl(naid) {
  return `https://catalog.archives.gov/id/${naid}`;
}

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}
