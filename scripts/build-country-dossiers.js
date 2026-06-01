#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildSelectionMatrix, countBy, priorityRank, recommendationRank } = require("./selection-matrix-core");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const dossierDir = path.join(reportDir, "country-dossiers");

const meta = readJson("volume-meta");
const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");
const gapTracker = readJson("gap-tracker");
const researchRunbook = readJson("research-runbook");
const persons = readJson("persons");
const sourceCopyLedger = readJson("source-copy-ledger");

const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });
const countries = buildVolumeCountryList();
const dossiers = countries.map(buildDossier).sort(dossierSort);
const searchRows = dossiers.flatMap((dossier) => dossier.queryRows.map((row) => ({ country: dossier.country, lanes: dossier.lanes.join("; "), ...row })));

const body = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    dossierCount: dossiers.length,
    countryCount: countries.length,
    activeChronologyCountries: dossiers.filter((dossier) => dossier.chronologyRows > 0).length,
    noChronologyCountries: dossiers.filter((dossier) => dossier.chronologyRows === 0).length,
    sourceCopyReviewCountries: dossiers.filter((dossier) => dossier.sourceCopyRows > 0).length,
    directGapCountries: dossiers.filter((dossier) => dossier.gapCount > 0).length,
    queryRows: searchRows.length
  },
  dossiers
};

const previous = readOptionalJson(path.join(dataDir, "country-dossiers.json"));
const generatedAt = sameBody(previous, body) ? previous.generatedAt : new Date().toISOString();
const packet = { generatedAt, ...body };

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(dossierDir, { recursive: true });

writeJsonPair("country-dossiers", "COUNTRY_DOSSIERS", packet);
writeStableJson(path.join(reportDir, "country-dossiers-build.json"), {
  dossierCount: packet.summary.dossierCount,
  countryCount: packet.summary.countryCount,
  activeChronologyCountries: packet.summary.activeChronologyCountries,
  noChronologyCountries: packet.summary.noChronologyCountries,
  sourceCopyReviewCountries: packet.summary.sourceCopyReviewCountries,
  directGapCountries: packet.summary.directGapCountries,
  queryRows: packet.summary.queryRows,
  csvFiles: ["reports/country-dossiers/country-dossiers.csv", "reports/country-dossiers/country-searches.csv"]
});
writeMarkdown(path.join(reportDir, "country-dossiers.md"), packet);
writeCsv(path.join(dossierDir, "country-dossiers.csv"), dossiers.map(dossierCsvRow), [
  "country",
  "lanes",
  "coverageStatus",
  "chronologyRows",
  "conversationPages",
  "firstDate",
  "lastDate",
  "releaseStatusCounts",
  "selectionCounts",
  "sourceCopyRows",
  "diaryMatchedRows",
  "policyFileCount",
  "publicReferenceCount",
  "gapCount",
  "runbookQueryCount",
  "personCount",
  "nextActions"
]);
writeCsv(path.join(dossierDir, "country-searches.csv"), searchRows, [
  "country",
  "lanes",
  "priority",
  "gapTitle",
  "sourcePoolTitle",
  "sourcePoolPriority",
  "queryLabel",
  "queryTerms",
  "sourcePoolSearchUrl",
  "catalogSearchUrl",
  "nextAction"
]);

console.log(`Wrote country dossiers: ${dossiers.length} countries, ${searchRows.length} query rows.`);

function buildVolumeCountryList() {
  const lanes = new Map();
  for (const chapter of meta.chapters || []) {
    for (const country of chapter.countries || []) {
      if (!lanes.has(country)) lanes.set(country, []);
      if (!lanes.get(country).includes(chapter.name)) lanes.get(country).push(chapter.name);
    }
  }
  for (const record of records) {
    if (!lanes.has(record.country)) lanes.set(record.country, [record.chapter?.name || "Regional and Multilateral"]);
  }
  return [...lanes.entries()].map(([country, countryLanes]) => ({ country, lanes: countryLanes })).sort((a, b) => a.country.localeCompare(b.country));
}

function buildDossier(countryInfo) {
  const { country, lanes } = countryInfo;
  const terms = countryTerms(country);
  const countryRecords = records.filter((record) => record.country === country).sort(rowSort);
  const countrySelectionRows = matrix.filter((row) => row.country === country).sort(rowSort).map(cleanSelectionRow);
  const countryPolicyFiles = policyFiles.filter((file) => matchesAnyTerm(file, terms)).sort(rowSort).map(cleanPolicyFile);
  const lanePolicyFiles = policyFiles
    .filter((file) => !matchesAnyTerm(file, terms) && lanes.includes(file.lane))
    .sort(rowSort)
    .slice(0, 4)
    .map(cleanPolicyFile);
  const countryPublicReferences = publicReferences.filter((item) => matchesAnyTerm(item, terms)).sort(rowSort).map(cleanPublicReference);
  const countryGaps = gapTracker.filter((gap) => matchesAnyTerm(gap, terms)).sort(gapSort).map(cleanGap);
  const laneGaps = gapTracker
    .filter((gap) => !matchesAnyTerm(gap, terms) && lanes.includes(gap.lane))
    .sort(gapSort)
    .slice(0, 3)
    .map(cleanGap);
  const countryQueries = (researchRunbook.gaps || [])
    .flatMap((gap) => gap.queries || [])
    .filter((query) => matchesAnyTerm(query, terms) || (lanes.includes(query.lane) && countryRecords.length === 0))
    .sort(querySort)
    .map(cleanQuery);
  const countryPersons = persons.filter((person) => matchesPerson(person, country, terms)).sort(personSort).map(cleanPerson);
  const countryLedger = sourceCopyLedger.filter((item) => item.country === country).sort(rowSort).map(cleanLedgerRow);
  const dates = countryRecords.map((record) => record.sortDate || record.date).filter(Boolean).sort();
  const conversationPages = sum(countryRecords.map((record) => record.pageCount || 0));
  const diaryMatchedRows = countryRecords.filter((record) => record.diaryReferences?.length).length;
  const releaseStatusCounts = countBy(countryRecords.map((record) => record.releaseStatus || "Unspecified"));
  const typeCounts = countBy(countryRecords.map((record) => record.type || "Conversation"));
  const selectionCounts = countBy(countrySelectionRows.map((row) => row.recommendation || "Unspecified"));
  const status = coverageStatus(country, countryRecords, countryLedger, countryGaps, countryQueries);

  return {
    country,
    lanes,
    coverageStatus: status,
    coverageNote: coverageNote(country, status, countryRecords, countryLedger, countryGaps, countryQueries),
    chronologyRows: countryRecords.length,
    conversationPages,
    firstDate: dates[0] || "",
    lastDate: dates[dates.length - 1] || "",
    releaseStatusCounts,
    typeCounts,
    selectionCounts,
    sourceCopyRows: countryLedger.length,
    diaryMatchedRows,
    policyFileCount: countryPolicyFiles.length,
    lanePolicyFileCount: lanePolicyFiles.length,
    publicReferenceCount: countryPublicReferences.length,
    gapCount: countryGaps.length,
    laneGapCount: laneGaps.length,
    runbookQueryCount: countryQueries.length,
    personCount: countryPersons.length,
    nextActions: nextActionsFor(country, countryRecords, countryLedger, countryGaps, countryQueries, countryPolicyFiles, countryPublicReferences),
    chronologyPreview: countryRecords.slice(0, 5).map(cleanRecord),
    selectionPreview: countrySelectionRows.slice(0, 5),
    policyFiles: countryPolicyFiles.slice(0, 5),
    lanePolicyFiles,
    publicReferences: countryPublicReferences.slice(0, 5),
    gaps: countryGaps.slice(0, 5),
    laneGaps,
    queryRows: countryQueries.slice(0, 8),
    persons: countryPersons.slice(0, 8),
    sourceCopyLedger: countryLedger.slice(0, 5)
  };
}

function coverageStatus(country, countryRecords, countryLedger, countryGaps, countryQueries) {
  if (country === "Egypt") return "Cross-volume review";
  if (countryLedger.length) return "Source-copy review";
  if (!countryRecords.length && (countryGaps.length || countryQueries.length)) return "Missing-source target";
  if (!countryRecords.length) return "No chronology row";
  if (countryGaps.length) return "Source-base gap";
  return "Chronology active";
}

function coverageNote(country, status, countryRecords, countryLedger, countryGaps, countryQueries) {
  if (status === "Cross-volume review") {
    return "Heavy presidential-call coverage is available, but each Egypt row needs Arab-Israeli, Persian Gulf, terrorism, and Africa-specific ownership review.";
  }
  if (status === "Source-copy review") {
    return `${countryLedger.length} ${countryLedger.length === 1 ? "row needs" : "rows need"} source-copy or declassification follow-up before final selection.`;
  }
  if (status === "Missing-source target") {
    return `No Bush Library memcon/telcon row is currently assigned to ${country}; use the mapped source-pool queries to hunt for State, NSC, and public-line evidence.`;
  }
  if (status === "No chronology row") {
    return `No declassified chronology row is currently assigned to ${country}; confirm whether the country belongs in a lane note, a regional document, or a missing-source search.`;
  }
  if (status === "Source-base gap") {
    return `${countryRecords.length} chronology ${countryRecords.length === 1 ? "row exists" : "rows exist"}, but direct gap items still point to missing policy or source-base work.`;
  }
  return `${countryRecords.length} chronology ${countryRecords.length === 1 ? "row is" : "rows are"} available for first-pass selection and source-note review.`;
}

function nextActionsFor(country, countryRecords, countryLedger, countryGaps, countryQueries, countryPolicyFiles, countryPublicReferences) {
  const actions = [];
  if (country === "Egypt") actions.push("Assign each Egypt row to Volume XX, Arab-Israeli, Persian Gulf, counterterrorism, or retain-only chronology before selection.");
  if (!countryRecords.length) actions.push(`Run missing-source searches for ${country} across State, NSC, Presidential Daily File, and Public Papers lanes.`);
  if (countryLedger.length) actions.push("Resolve source-copy, partial-release, and diary/backup control issues before final selection.");
  if (!countryPolicyFiles.length) actions.push("Search for policy-file anchors that can supply chapter context beyond leader conversations.");
  if (!countryPublicReferences.length) actions.push("Add or verify Public Papers references for public-line chronology and public posture.");
  if (countryGaps[0]?.nextActions?.[0]) actions.push(countryGaps[0].nextActions[0]);
  if (countryQueries.length) actions.push(`Work the first ${Math.min(countryQueries.length, 8)} country-matched runbook queries and promote useful hits into the selection matrix.`);
  return unique(actions).slice(0, 6);
}

function countryTerms(country) {
  const aliases = {
    Algeria: ["Bendjedid", "Chadli"],
    Benin: ["Kerekou"],
    Burundi: ["Buyoya"],
    "Cape Verde": ["Pires"],
    Djibouti: ["Gouled"],
    Egypt: ["Mubarak", "Nile"],
    Eritrea: ["Eritrean"],
    Ethiopia: ["Mengistu", "Addis Ababa"],
    Gambia: ["Jawara"],
    Ghana: ["Rawlings"],
    Kenya: ["Moi"],
    Liberia: ["Doe", "Taylor", "ECOMOG", "ECOWAS"],
    Libya: ["Qadhafi", "Qaddafi", "Gadhafi", "Gaddafi", "Pan Am 103", "Lockerbie"],
    Morocco: ["Hassan II", "Filali", "Western Sahara", "Polisario"],
    Nigeria: ["Babangida"],
    Rwanda: ["Habyarimana", "Great Lakes"],
    Senegal: ["Diouf"],
    Sudan: ["Bashir", "Khartoum"],
    Togo: ["Eyadema"],
    Tunisia: ["Ben Ali"],
    Uganda: ["Museveni"],
    Zaire: ["Mobutu"]
  };
  return unique([country, ...(aliases[country] || [])]);
}

function matchesAnyTerm(value, terms) {
  const text = normalizeSearchText(value);
  return terms.some((term) => includesTerm(text, term));
}

function matchesPerson(person, country, terms) {
  if ((person.places || []).includes(country)) return true;
  return matchesAnyTerm(person, terms);
}

function includesTerm(text, term) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function normalizeSearchText(value) {
  return JSON.stringify(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanRecord(record) {
  return compact({
    id: record.id,
    compilerNumber: record.compilerNumber || "",
    date: record.date,
    sortDate: record.sortDate,
    dateText: record.dateText,
    type: record.type,
    title: record.title,
    participants: record.participants || [],
    releaseStatus: record.releaseStatus,
    naid: record.naid,
    catalogUrl: record.catalogUrl,
    pdfUrl: record.pdfUrl,
    pageCount: record.pageCount || 0,
    frusSourceNote: record.frusSourceNote,
    diaryReferenceCount: record.diaryReferences?.length || 0
  });
}

function cleanSelectionRow(row) {
  return compact({
    id: row.id,
    compilerNumber: row.compilerNumber || "",
    recommendation: row.recommendation,
    priority: row.priority,
    date: row.date,
    sortDate: row.sortDate,
    dateText: row.dateText,
    title: row.title,
    releaseStatus: row.releaseStatus,
    catalogUrl: row.catalogUrl,
    pdfUrl: row.pdfUrl,
    nextAction: row.nextAction,
    frusSourceNote: row.frusSourceNote
  });
}

function cleanPolicyFile(file) {
  return compact({
    id: file.id,
    title: file.title,
    date: file.date,
    sortDate: file.sortDate,
    dateText: file.dateText,
    lane: file.lane,
    priority: file.priority,
    naid: file.naid,
    catalogUrl: file.catalogUrl,
    pdfUrl: file.pdfUrl,
    pageCount: file.pageCount || 0,
    reason: file.reason,
    frusSourceNote: file.frusSourceNote
  });
}

function cleanPublicReference(item) {
  return compact({
    id: item.id,
    title: item.title,
    date: item.date,
    sortDate: item.sortDate,
    dateText: item.dateText,
    documentType: item.documentType,
    matchedTerms: item.matchedTerms || [],
    govinfoUrl: item.govinfoUrl,
    pdfUrl: item.pdfUrl,
    frusSourceNote: item.frusSourceNote
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
    nextActions: gap.nextActions || [],
    targetTerms: gap.targetTerms || []
  });
}

function cleanQuery(query) {
  return compact({
    id: query.id,
    priority: query.priority,
    gapTitle: query.gapTitle,
    sourcePoolTitle: query.sourcePoolTitle,
    sourcePoolPriority: query.sourcePoolPriority,
    queryLabel: query.queryLabel,
    queryTerms: query.queryTerms,
    sourcePoolSearchUrl: query.sourcePoolSearchUrl,
    catalogSearchUrl: query.catalogSearchUrl,
    nextAction: query.nextAction
  });
}

function cleanPerson(person) {
  return compact({
    id: person.id,
    name: person.name,
    displayName: person.displayName,
    entry: person.entry,
    description: person.description,
    authorityStatus: person.authorityStatus,
    needsReview: person.needsReview
  });
}

function cleanLedgerRow(item) {
  return compact({
    id: item.id,
    issueType: item.issueType,
    priority: item.priority,
    date: item.date,
    sortDate: item.sortDate,
    dateText: item.dateText,
    title: item.title,
    participants: item.participants || [],
    releaseStatus: item.releaseStatus,
    naid: item.naid,
    catalogUrl: item.catalogUrl,
    pdfUrl: item.pdfUrl,
    action: item.action,
    frusSourceNote: item.frusSourceNote
  });
}

function dossierCsvRow(dossier) {
  return {
    country: dossier.country,
    lanes: dossier.lanes.join("; "),
    coverageStatus: dossier.coverageStatus,
    chronologyRows: dossier.chronologyRows,
    conversationPages: dossier.conversationPages,
    firstDate: dossier.firstDate,
    lastDate: dossier.lastDate,
    releaseStatusCounts: formatCounts(dossier.releaseStatusCounts),
    selectionCounts: formatCounts(dossier.selectionCounts),
    sourceCopyRows: dossier.sourceCopyRows,
    diaryMatchedRows: dossier.diaryMatchedRows,
    policyFileCount: dossier.policyFileCount,
    publicReferenceCount: dossier.publicReferenceCount,
    gapCount: dossier.gapCount,
    runbookQueryCount: dossier.runbookQueryCount,
    personCount: dossier.personCount,
    nextActions: dossier.nextActions.join("; ")
  };
}

function writeMarkdown(filePath, packet) {
  const lines = [
    "# FRUS Volume XX Country Dossiers",
    "",
    `Generated: ${packet.generatedAt}`,
    `Live page: ${packet.volume.livePageUrl}`,
    `Official volume: ${packet.volume.url}`,
    "",
    "## Summary",
    "",
    `- Country dossiers: ${packet.summary.dossierCount}`,
    `- Countries with chronology rows: ${packet.summary.activeChronologyCountries}`,
    `- Countries without chronology rows: ${packet.summary.noChronologyCountries}`,
    `- Countries with source-copy review rows: ${packet.summary.sourceCopyReviewCountries}`,
    `- Country search rows: ${packet.summary.queryRows}`,
    "",
    "## CSV Outputs",
    "",
    "- country-dossiers/country-dossiers.csv",
    "- country-dossiers/country-searches.csv",
    ""
  ];

  for (const dossier of packet.dossiers) {
    lines.push(
      `## ${dossier.country}`,
      "",
      `Status: ${dossier.coverageStatus}`,
      `Lanes: ${dossier.lanes.join("; ")}`,
      `Chronology: ${dossier.chronologyRows} rows / ${dossier.conversationPages} pages`,
      `Date span: ${dossier.firstDate || "n/a"} to ${dossier.lastDate || "n/a"}`,
      `Policy files: ${dossier.policyFileCount}`,
      `Public references: ${dossier.publicReferenceCount}`,
      `Runbook queries: ${dossier.runbookQueryCount}`,
      "",
      dossier.coverageNote,
      "",
      "Next actions:"
    );
    for (const action of dossier.nextActions) lines.push(`- ${action}`);
    lines.push("", "Top query rows:");
    for (const query of dossier.queryRows.slice(0, 5)) lines.push(`- ${query.sourcePoolTitle} / ${query.queryLabel}: ${query.sourcePoolSearchUrl}`);
    lines.push("");
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function writeCsv(filePath, rows, columns) {
  fs.writeFileSync(filePath, toCsv(rows, columns));
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

function rowSort(a, b) {
  return (
    (a.sortDate || a.date || "").localeCompare(b.sortDate || b.date || "") ||
    (recommendationRank(a.recommendation) - recommendationRank(b.recommendation)) ||
    (priorityRank(a.priority) - priorityRank(b.priority)) ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function gapSort(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || (a.lane || "").localeCompare(b.lane || "") || (a.title || "").localeCompare(b.title || "");
}

function querySort(a, b) {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    priorityRank(a.sourcePoolPriority) - priorityRank(b.sourcePoolPriority) ||
    (a.sourcePoolTitle || "").localeCompare(b.sourcePoolTitle || "") ||
    (a.queryLabel || "").localeCompare(b.queryLabel || "")
  );
}

function dossierSort(a, b) {
  return (
    statusRank(a.coverageStatus) - statusRank(b.coverageStatus) ||
    a.lanes.join("; ").localeCompare(b.lanes.join("; ")) ||
    b.chronologyRows - a.chronologyRows ||
    a.country.localeCompare(b.country)
  );
}

function statusRank(status) {
  const ranks = {
    "Cross-volume review": 1,
    "Source-copy review": 2,
    "Missing-source target": 3,
    "Source-base gap": 4,
    "No chronology row": 5,
    "Chronology active": 6
  };
  return ranks[status] || 99;
}

function personSort(a, b) {
  return (a.sortKey || a.name || "").localeCompare(b.sortKey || b.name || "");
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== "";
    })
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function formatCounts(counts) {
  return Object.entries(counts || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}
