#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const TABLE_URL =
  "https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons";
const CATALOG_SEARCH_URL = "https://catalog.archives.gov/proxy/records/search";
const HISTORY_URL = "https://history.state.gov/historicaldocuments/frus1989-92v20";
const STATUS_URL = "https://history.state.gov/historicaldocuments/status-of-the-series";

const FRUS_VOLUME = {
  id: "frus1989-92v20",
  title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
  url: HISTORY_URL,
  status: "Being Researched",
  statusUrl: STATUS_URL
};

const CHAPTERS = [
  {
    number: 1,
    name: "North Africa",
    countries: ["Algeria", "Egypt", "Libya", "Morocco", "Tunisia"],
    description: "Maghreb, Egypt, Libya sanctions, and cross-volume Middle East review."
  },
  {
    number: 2,
    name: "Horn and East Africa",
    countries: ["Burundi", "Djibouti", "Eritrea", "Ethiopia", "Kenya", "Rwanda", "Sudan", "Tanzania", "Uganda"],
    description: "Horn, Nile basin, East Africa, and humanitarian/diplomatic files outside Somalia."
  },
  {
    number: 3,
    name: "West Africa and Sahel",
    countries: [
      "Benin",
      "Cape Verde",
      "Gambia",
      "Ghana",
      "Guinea",
      "Ivory Coast",
      "Liberia",
      "Mali",
      "Mauritania",
      "Niger",
      "Nigeria",
      "Senegal",
      "Sierra Leone",
      "Togo"
    ],
    description: "West African leadership, Sahel diplomacy, narcotics certification, and regional aid files."
  },
  {
    number: 4,
    name: "Central Africa",
    countries: ["Cameroon", "Central African Republic", "Chad", "Congo", "Gabon", "Rwanda", "Zaire"],
    description: "Central African state visits, Zaire/Mobutu files, and regional stability records."
  },
  {
    number: 5,
    name: "Regional and Multilateral",
    countries: [],
    description: "Africa-wide strategy, UN, NSR/NSD, NSC, and cross-regional policy files."
  }
];

const chapterByCountry = new Map();
for (const chapter of CHAPTERS) {
  for (const country of chapter.countries) chapterByCountry.set(country, chapter);
}
const regionalChapter = CHAPTERS.find((chapter) => chapter.name === "Regional and Multilateral");

const VOLUME_COUNTRIES = new Set([...chapterByCountry.keys()]);
const BOUNDARY_COUNTRIES = new Set([
  "Angola",
  "Botswana",
  "Mozambique",
  "Namibia",
  "Somalia",
  "South Africa",
  "Zambia",
  "Zimbabwe"
]);

const COUNTRY_ALIASES = {
  "Cote d'Ivoire": "Ivory Coast",
  "Cote d Ivoire": "Ivory Coast",
  Congo: "Congo",
  Zaire: "Zaire"
};

const PARTICIPANT_FIXES = {
  "Ali, Ben": "Zine El Abidine Ben Ali",
  "Bendjedid, Chadil": "Chadli Bendjedid",
  "Bendjedid, Chadli": "Chadli Bendjedid",
  "Boutros-Ghali, Boutros": "Boutros Boutros-Ghali",
  "de Klerk, F.W.": "F. W. de Klerk",
  "Diouf, Abdou": "Abdou Diouf",
  "dos Santos, Jose Eduardo": "Jose Eduardo dos Santos",
  "Gouled, Hassan": "Hassan Gouled Aptidon",
  "Hassan III, King": "King Hassan II",
  "Meguid, Ahmed Esmat Abdel": "Ahmed Esmat Abdel Meguid",
  "Mubarak, Hosni": "Hosni Mubarak",
  "Museveni. Yoweri": "Yoweri Museveni",
  "Museveni, Yoweri": "Yoweri Museveni",
  "Sese Seko, Mobutu": "Mobutu Sese Seko",
  "Viega, Carlos": "Carlos Veiga"
};

const SOURCE_COLLECTION = {
  name: "Records of the National Security Council (George H. W. Bush Administration)",
  naid: "2163580",
  url: "https://catalog.archives.gov/id/2163580",
  referenceUnit: "George Bush Library"
};

const SERIES_FALLBACKS = {
  Memcon: {
    name: "Presidential Memcon Files",
    naid: "321498039",
    url: "https://catalog.archives.gov/id/321498039"
  },
  Telcon: {
    name: "Presidential Telcon Files",
    naid: "321498139",
    url: "https://catalog.archives.gov/id/321498139"
  }
};

const POLICY_FILE_SEEDS = [
  {
    naid: "470760928",
    lane: "North Africa",
    priority: "High",
    reason: "NSC meeting file on Libya, the clearest Catalog-level North Africa policy anchor."
  },
  {
    naid: "446394969",
    lane: "North Africa",
    priority: "High",
    reason: "NSR on U.S. policy toward the Maghreb: Morocco, Algeria, and Tunisia."
  },
  {
    naid: "446394987",
    lane: "Regional and Multilateral",
    priority: "High",
    reason: "NSR on American policy toward Africa in the 1990s."
  },
  {
    naid: "446396910",
    lane: "Regional and Multilateral",
    priority: "High",
    reason: "NSD on American policy toward Sub-Saharan Africa in the 1990s."
  },
  {
    naid: "470761420",
    lane: "Boundary: Somalia",
    priority: "Boundary",
    reason: "Somalia belongs to FRUS 1989-1992, Volume XXI; retain for boundary control."
  },
  {
    naid: "470761536",
    lane: "Boundary: Somalia",
    priority: "Boundary",
    reason: "Somalia Deputies Committee follow-up file; retain for handoff to Volume XXI."
  },
  {
    naid: "470761557",
    lane: "Boundary: Somalia",
    priority: "Boundary",
    reason: "Somalia Deputies Committee follow-up file; retain for handoff to Volume XXI."
  },
  {
    naid: "470761563",
    lane: "Boundary: Somalia",
    priority: "Boundary",
    reason: "Somalia Deputies Committee follow-up file; retain for handoff to Volume XXI."
  },
  {
    naid: "470761565",
    lane: "Boundary: Somalia",
    priority: "Boundary",
    reason: "Somalia Deputies Committee follow-up file; retain for handoff to Volume XXI."
  }
];

const PUBLIC_REFERENCE_SOURCES = [
  path.join(workspaceRoot, "Bush41-drugs-thugs", "data", "public-statements.json"),
  path.join(workspaceRoot, "Bush41-LatAm", "data", "public-statements.json")
];

const PUBLIC_TERMS = [
  "Egypt",
  "Mubarak",
  "Algeria",
  "Bendjedid",
  "Morocco",
  "Hassan",
  "Tunisia",
  "Ben Ali",
  "Libya",
  "Qadhafi",
  "Gadhafi",
  "Pan Am 103",
  "Maghreb",
  "Sub-Saharan",
  "Africa",
  "African",
  "Zaire",
  "Mobutu",
  "Nigeria",
  "Babangida",
  "Senegal",
  "Diouf",
  "Uganda",
  "Museveni",
  "Djibouti",
  "Togo",
  "Cape Verde",
  "Benin",
  "Sudan",
  "Ethiopia",
  "Somalia"
];

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function rowsFromHtml(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => decodeHtml(cell[1])))
    .filter((cells) => cells.length === 6)
    .map(([date, type, participants, country, status, naid]) => ({
      date,
      type,
      participants,
      country: COUNTRY_ALIASES[country] || country,
      status,
      naid
    }));
}

function isoDateFromSlash(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function displayDate(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function participantDisplay(value) {
  if (PARTICIPANT_FIXES[value]) return PARTICIPANT_FIXES[value];
  const cleaned = String(value || "").replace(/\.\s*/, ", ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(",").map((part) => part.trim());
  return parts.length > 1 ? `${parts.slice(1).join(" ")} ${parts[0]}`.replace(/\s+/g, " ") : cleaned;
}

function catalogUrl(naid) {
  return `https://catalog.archives.gov/id/${naid}`;
}

function ancestor(record, levelPattern) {
  return (record?.ancestors || []).find((item) => new RegExp(levelPattern, "i").test(item.levelOfDescription || ""));
}

function firstPdf(record) {
  return (record?.digitalObjects || []).find((object) =>
    /pdf/i.test(`${object.objectType || ""} ${object.objectFilename || ""} ${object.objectUrl || ""}`)
  );
}

function logicalDate(record) {
  return (
    record?.productionDates?.find((date) => date.logicalDate)?.logicalDate ||
    record?.coverageStartDate?.logicalDate ||
    record?.coverageEndDate?.logicalDate ||
    record?.inclusiveStartDate?.logicalDate ||
    record?.inclusiveEndDate?.logicalDate ||
    ""
  );
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sourceParts(record, fallbackType = "") {
  const collection = ancestor(record, "collection");
  const series = ancestor(record, "series");
  const fileUnit = ancestor(record, "file");
  const fallback = SERIES_FALLBACKS[fallbackType] || {};
  return {
    collectionTitle: collection?.title || collection?.collectionTitle || SOURCE_COLLECTION.name,
    collectionNaid: String(collection?.naId || SOURCE_COLLECTION.naid),
    seriesTitle: series?.title || fallback.name || "",
    seriesNaid: String(series?.naId || fallback.naid || ""),
    fileTitle: fileUnit?.title || "",
    fileNaid: fileUnit?.naId ? String(fileUnit.naId) : ""
  };
}

function releaseStatus(row, record) {
  const text = `${row.type || ""} ${row.status || ""} ${record?.accessRestriction?.status || ""}`;
  if (/no\s+(memcon|telcon)/i.test(row.type)) return "Marker / no memorandum listed";
  if (/partial|partly/i.test(text)) return "Partial";
  if (/denied|restricted/i.test(text) && !/unrestricted/i.test(text)) return "Restricted";
  if (/full|unrestricted/i.test(text)) return "Full";
  return row.status || record?.accessRestriction?.status || "Unknown";
}

function countryChapter(country) {
  return chapterByCountry.get(country) || regionalChapter;
}

function boundaryReason(country) {
  if (country === "Somalia") return "Somalia is assigned to FRUS 1989-1992, Volume XXI.";
  if (BOUNDARY_COUNTRIES.has(country)) return "Southern Africa is assigned to FRUS 1989-1992, Volume XIX.";
  return "";
}

function fileUnitUrl(naid) {
  return naid ? catalogUrl(naid) : "";
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.text();
}

async function fetchAllTableRows() {
  const pages = [];
  for (let page = 0; page <= 68; page += 1) {
    const url = page === 0 ? TABLE_URL : `${TABLE_URL}?page=${page}`;
    pages.push(rowsFromHtml(await fetchText(url)));
  }
  return pages.flat();
}

async function fetchCatalogRecord(naid, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = new URL(CATALOG_SEARCH_URL);
      url.searchParams.set("naId", String(naid));
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await response.text();
      if (!response.ok) throw new Error(`Catalog status ${response.status}`);
      if (/^\s*</.test(text)) throw new Error("Catalog returned HTML");
      const json = JSON.parse(text);
      const record = json.body?.hits?.hits?.[0]?._source?.record;
      if (!record) throw new Error(`No Catalog record for NAID ${naid}`);
      return record;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 650));
    }
  }
  throw lastError;
}

async function pageCountForPdf(url, naid) {
  if (!url || !/\.pdf($|\?)/i.test(url)) return null;
  const target = path.join(os.tmpdir(), `frus20-${naid}-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`);
  await new Promise((resolve, reject) => {
    const get = (nextUrl) => {
      https
        .get(nextUrl, (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            get(response.headers.location);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`PDF download failed ${response.statusCode}`));
            return;
          }
          const output = fs.createWriteStream(target);
          response.pipe(output);
          output.on("finish", () => output.close(resolve));
          output.on("error", reject);
        })
        .on("error", reject);
    };
    get(url);
  });
  try {
    const info = execFileSync("pdfinfo", [target], { encoding: "utf8" });
    const match = info.match(/^Pages:\s+(\d+)/m);
    return match ? Number(match[1]) : null;
  } finally {
    fs.rmSync(target, { force: true });
  }
}

async function pageCountForPdfWithRetry(url, naid, attempts = 2) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await pageCountForPdf(url, naid);
    } catch (error) {
      if (attempt === attempts) return null;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  return null;
}

async function mapLimit(items, limit, worker) {
  const queue = [...items];
  const results = [];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

function toConversationRecord(row, catalogRecord, pageCount) {
  const date = isoDateFromSlash(row.date) || logicalDate(catalogRecord);
  const pdf = firstPdf(catalogRecord);
  const chapter = countryChapter(row.country);
  const source = sourceParts(catalogRecord, row.type.replace(/^No\s+/, ""));
  const counterpart = participantDisplay(row.participants);
  const status = releaseStatus(row, catalogRecord);
  const documentAvailable = !/^No\s+/i.test(row.type) && Boolean(pdf?.objectUrl);
  const title = catalogRecord?.title || `${row.type}: President Bush and ${counterpart}`;
  const topics = [
    chapter.name,
    row.country,
    row.type,
    documentAvailable ? "Online PDF" : "Marker / no public PDF",
    status
  ];

  if (row.country === "Egypt") topics.push("Cross-check Volume XIV and Persian Gulf crisis volumes");

  return {
    id: `bush-library-${row.naid}`,
    date,
    sortDate: date,
    dateText: displayDate(date),
    type: row.type,
    title,
    documentTitle: title,
    participants: ["George H. W. Bush", counterpart],
    counterpart,
    countries: ["United States", row.country],
    country: row.country,
    chapter: { number: chapter.number, name: chapter.name },
    releaseStatus: status,
    documentAvailable,
    naid: String(row.naid),
    catalogUrl: catalogUrl(row.naid),
    pdfUrl: pdf?.objectUrl || "",
    objectFilename: pdf?.objectFilename || "",
    pageCount: pageCount || 0,
    accessRestriction: catalogRecord?.accessRestriction?.status || "",
    levelOfDescription: catalogRecord?.levelOfDescription || "",
    source: {
      name: "Bush Library Memcons and Telcons index",
      tableUrl: TABLE_URL,
      collection: source.collectionTitle,
      collectionNaid: source.collectionNaid,
      series: source.seriesTitle,
      seriesNaid: source.seriesNaid,
      fileUnitTitle: source.fileTitle,
      fileUnitNaid: source.fileNaid,
      fileUnitUrl: fileUnitUrl(source.fileNaid),
      objectFilename: pdf?.objectFilename || ""
    },
    frusVolume: FRUS_VOLUME,
    topics,
    notes:
      row.country === "Egypt"
        ? "Egypt belongs in the Volume XX geographic search lane, but these records also need cross-volume review against Arab-Israeli and Persian Gulf compilation boundaries."
        : "",
    sourceNote: [
      `Source: George H.W. Bush Presidential Library and Museum, Digital Research Room, "Memcons and Telcons" table (${TABLE_URL}), row: Date ${row.date}; Type ${row.type}; Participants ${row.participants}; Country ${row.country}; Release Status ${row.status || "blank"}; NAID ${row.naid}.`,
      `National Archives Catalog item: ${title}, NAID ${row.naid}.`,
      `Collection: ${source.collectionTitle}, NAID ${source.collectionNaid}.`,
      source.seriesTitle ? `Series: ${source.seriesTitle}, NAID ${source.seriesNaid}.` : "",
      source.fileTitle ? `File unit: ${source.fileTitle}, NAID ${source.fileNaid}.` : "",
      pdf?.objectFilename ? `Digital object: ${pdf.objectFilename}, URL ${pdf.objectUrl}.` : "Digital object: none listed in Catalog.",
      `Access/release status: ${status}.`
    ]
      .filter(Boolean)
      .join(" ")
  };
}

async function buildConversationDatasets(tableRows) {
  const candidateRows = tableRows.filter((row) => VOLUME_COUNTRIES.has(row.country) || BOUNDARY_COUNTRIES.has(row.country));
  const catalogRows = await mapLimit(candidateRows, 6, async (row) => {
    const catalogRecord = await fetchCatalogRecord(row.naid);
    const pdf = firstPdf(catalogRecord);
    const pageCount = pdf?.objectUrl ? await pageCountForPdfWithRetry(pdf.objectUrl, row.naid) : null;
    return { row, catalogRecord, record: toConversationRecord(row, catalogRecord, pageCount) };
  });

  const volumeRecords = catalogRows
    .filter(({ row }) => VOLUME_COUNTRIES.has(row.country))
    .map(({ record }) => record)
    .sort(byChapterDateTitle);
  const boundaryRecords = catalogRows
    .filter(({ row }) => BOUNDARY_COUNTRIES.has(row.country))
    .map(({ record }) => ({
      ...record,
      boundaryReason: boundaryReason(record.country),
      chapter: { number: 9, name: record.country === "Somalia" ? "Boundary: Somalia" : "Boundary: Southern Africa" }
    }))
    .sort((a, b) => a.country.localeCompare(b.country) || a.sortDate.localeCompare(b.sortDate));

  return {
    volumeRecords,
    boundaryRecords,
    rowsReviewed: candidateRows.length,
    missingCatalogRecords: catalogRows.filter((item) => !item.catalogRecord).length
  };
}

function byChapterDateTitle(a, b) {
  return a.chapter.number - b.chapter.number || a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title);
}

function policyDate(record) {
  const titleDate = String(record?.title || "").match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(1989|1990|1991|1992|1993)\b/i
  );
  if (titleDate) {
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ];
    const month = months.indexOf(titleDate[1].toLowerCase()) + 1;
    return `${titleDate[3]}-${String(month).padStart(2, "0")}-${titleDate[2].padStart(2, "0")}`;
  }
  return logicalDate(record) || "1989-01-01";
}

async function buildPolicyFiles() {
  return mapLimit(POLICY_FILE_SEEDS, 4, async (seed) => {
    const record = await fetchCatalogRecord(seed.naid);
    const pdf = firstPdf(record);
    const source = sourceParts(record);
    const pageCount = pdf?.objectUrl ? await pageCountForPdfWithRetry(pdf.objectUrl, seed.naid, 2) : null;
    const date = policyDate(record);
    return {
      id: `policy-${seed.naid}`,
      naid: String(seed.naid),
      title: record.title || `Policy file ${seed.naid}`,
      date,
      sortDate: date,
      dateText: displayDate(date),
      lane: seed.lane,
      priority: seed.priority,
      reason: seed.reason,
      levelOfDescription: record.levelOfDescription || "",
      accessRestriction: record.accessRestriction?.status || "",
      catalogUrl: catalogUrl(seed.naid),
      pdfUrl: pdf?.objectUrl || "",
      objectFilename: pdf?.objectFilename || "",
      pageCount: pageCount || 0,
      source: {
        collection: source.collectionTitle,
        collectionNaid: source.collectionNaid,
        series: source.seriesTitle,
        seriesNaid: source.seriesNaid
      },
      frusVolume: FRUS_VOLUME,
      sourceNote: [
        `National Archives Catalog file: ${record.title || "Untitled"}, NAID ${seed.naid}.`,
        source.collectionTitle ? `Collection: ${source.collectionTitle}, NAID ${source.collectionNaid}.` : "",
        source.seriesTitle ? `Series: ${source.seriesTitle}, NAID ${source.seriesNaid}.` : "",
        `Access status: ${record.accessRestriction?.status || "not stated"}.`,
        pdf?.objectFilename ? `Digital object: ${pdf.objectFilename}, URL ${pdf.objectUrl}.` : "",
        `Catalog: ${catalogUrl(seed.naid)}.`
      ]
        .filter(Boolean)
        .join(" ")
    };
  });
}

function publicReferenceText(record) {
  return cleanText(
    [
      record.title,
      record.snippet,
      record.sourceNote,
      record.citation,
      JSON.stringify(record.matchedTerms || {}),
      JSON.stringify(record.countries || {})
    ].join(" ")
  );
}

function publicChapter(text) {
  if (/Somalia/i.test(text)) return "Boundary: Somalia";
  if (/South Africa|Mandela|de Klerk|Angola|Mozambique|Namibia|Zimbabwe|Zambia|Botswana/i.test(text)) {
    return "Boundary: Southern Africa";
  }
  if (/Egypt|Mubarak|Algeria|Bendjedid|Morocco|Hassan|Tunisia|Ben Ali|Libya|Qadhafi|Gadhafi|Maghreb|Pan Am/i.test(text)) {
    return "North Africa";
  }
  if (/Sudan|Ethiopia|Djibouti|Kenya|Uganda|Museveni|Burundi|Rwanda/i.test(text)) return "Horn and East Africa";
  if (/Nigeria|Babangida|Senegal|Diouf|Togo|Cape Verde|Benin|Ghana|Liberia|Sahel/i.test(text)) return "West Africa and Sahel";
  if (/Zaire|Mobutu|Congo|Chad|Cameroon|Gabon/i.test(text)) return "Central Africa";
  return "Regional and Multilateral";
}

function matchedPublicTerms(text) {
  return PUBLIC_TERMS.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

function normalizePublicReference(record, sourcePath) {
  const text = publicReferenceText(record);
  const terms = matchedPublicTerms(text);
  if (!terms.length) return null;
  if (/African-American/i.test(text) && terms.every((term) => /Africa|African/i.test(term))) return null;

  const date = record.date || record.documentDate || record.sortDate || "";
  const title = record.title || record.documentTitle || "Untitled public statement";
  const chapter = publicChapter(text);
  return {
    id: `public-${date}-${title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120),
    title,
    date,
    sortDate: date,
    dateText: record.dateText || displayDate(date),
    chapter,
    documentType: record.documentType || record.publicVoice || "Public statement",
    relevance: record.relevance || "Public Papers reference",
    matchedTerms: terms,
    citation: record.citation || record.sourceNote || "",
    sourceNote: record.sourceNote || record.citation || "",
    govinfoUrl: record.govinfoUrl || record.htmlUrl || record.detailsUrl || "",
    pdfUrl: record.pdfPageUrl || record.pageLink || record.pdfUrl || "",
    pageRange: record.pageRange || [record.pageStart, record.pageEnd].filter(Boolean).join("-"),
    sourceDataset: path.relative(workspaceRoot, sourcePath)
  };
}

function buildPublicReferences() {
  const records = [];
  for (const sourcePath of PUBLIC_REFERENCE_SOURCES) {
    if (!fs.existsSync(sourcePath)) continue;
    const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const normalized = raw.map((record) => normalizePublicReference(record, sourcePath)).filter(Boolean);
    records.push(...normalized);
  }

  const deduped = [...new Map(records.map((record) => [`${record.date}|${record.title}`, record])).values()];
  return deduped.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title));
}

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}

async function main() {
  ensureDirs();
  const tableRows = await fetchAllTableRows();
  const conversations = await buildConversationDatasets(tableRows);
  const policyFiles = (await buildPolicyFiles()).sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title));
  const publicReferences = buildPublicReferences();

  writeJsonPair("records", "VOLUME_RECORDS", conversations.volumeRecords);
  writeJsonPair("boundary-records", "BOUNDARY_RECORDS", conversations.boundaryRecords);
  writeJsonPair("policy-files", "POLICY_FILES", policyFiles);
  writeJsonPair("public-references", "PUBLIC_REFERENCES", publicReferences);
  writeJsonPair("volume-meta", "VOLUME_META", { frusVolume: FRUS_VOLUME, chapters: CHAPTERS, generatedAt: new Date().toISOString() });

  fs.writeFileSync(
    path.join(reportDir, "volume20-harvest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        frusVolume: FRUS_VOLUME,
        tableUrl: TABLE_URL,
        tableRowsScanned: tableRows.length,
        volumeRecordCount: conversations.volumeRecords.length,
        boundaryRecordCount: conversations.boundaryRecords.length,
        policyFileCount: policyFiles.length,
        publicReferenceCount: publicReferences.length,
        volumeCountryCounts: countBy(conversations.volumeRecords, (record) => record.country),
        boundaryCountryCounts: countBy(conversations.boundaryRecords, (record) => record.country),
        sourceDatasets: PUBLIC_REFERENCE_SOURCES.map((sourcePath) => ({
          path: path.relative(workspaceRoot, sourcePath),
          exists: fs.existsSync(sourcePath)
        }))
      },
      null,
      2
    )}\n`
  );

  console.log(
    `Wrote ${conversations.volumeRecords.length} volume records, ${conversations.boundaryRecords.length} boundary records, ${policyFiles.length} policy files, and ${publicReferences.length} public references.`
  );
}

function countBy(items, getter) {
  const counts = {};
  for (const item of items) {
    const key = getter(item) || "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
