#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const runbookDir = path.join(reportDir, "research-runbook");

const gapTracker = readJson("gap-tracker");
const sourcePools = readJson("source-pools");

const sourcePoolByName = buildSourcePoolIndex(sourcePools);
const runbookRows = [];
const gapRunbooks = gapTracker.map((gap) => buildGapRunbook(gap));
const priorityRows = gapRunbooks
  .flatMap((gap) => gap.queries)
  .filter((row) => row.priority === "Critical" || row.sourcePoolPriority === "Missing")
  .slice(0, 60);

const body = {
  volume: {
    id: "frus1989-92v20",
    title: "Foreign Relations of the United States, 1989-1992, Volume XX, North Africa; Sub-Saharan Africa",
    url: "https://history.state.gov/historicaldocuments/frus1989-92v20",
    livePageUrl: "https://therealjameswilson.github.io/NorthAfrica-89-92/"
  },
  summary: {
    gapCount: gapRunbooks.length,
    criticalGapCount: gapRunbooks.filter((gap) => gap.priority === "Critical").length,
    sourcePoolCount: sourcePools.length,
    queryCount: runbookRows.length,
    missingSourcePoolCount: sourcePools.filter((pool) => pool.priority === "Missing").length,
    stateDepartmentQueryCount: runbookRows.filter((row) => row.sourcePoolId === "state-central").length
  },
  sourcePoolAliases: Object.fromEntries([...sourcePoolByName.entries()].map(([key, pool]) => [key, pool.id])),
  gaps: gapRunbooks,
  priorityRows
};

const previous = readOptionalJson(path.join(dataDir, "research-runbook.json"));
const generatedAt = sameBody(previous, body) ? previous.generatedAt : new Date().toISOString();
const runbook = { generatedAt, ...body };

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(runbookDir, { recursive: true });

writeJsonPair("research-runbook", "RESEARCH_RUNBOOK", runbook);
writeStableJson(path.join(reportDir, "research-runbook-build.json"), {
  gapCount: runbook.summary.gapCount,
  criticalGapCount: runbook.summary.criticalGapCount,
  sourcePoolCount: runbook.summary.sourcePoolCount,
  queryCount: runbook.summary.queryCount,
  missingSourcePoolCount: runbook.summary.missingSourcePoolCount,
  stateDepartmentQueryCount: runbook.summary.stateDepartmentQueryCount,
  csvFiles: ["reports/research-runbook/all-gap-queries.csv", "reports/research-runbook/priority-gap-queries.csv"]
});
writeMarkdown(path.join(reportDir, "research-runbook.md"), runbook);
writeCsv(path.join(runbookDir, "all-gap-queries.csv"), runbookRows);
writeCsv(path.join(runbookDir, "priority-gap-queries.csv"), priorityRows);

console.log(`Wrote research runbook: ${gapRunbooks.length} gaps, ${runbookRows.length} query rows.`);

function buildGapRunbook(gap) {
  const pools = (gap.sourcePools || []).map((name) => resolveSourcePool(name));
  const terms = buildTermBundles(gap);
  const queries = [];

  for (const pool of pools) {
    for (const bundle of terms) {
      const query = {
        id: `${gap.id}-${pool.id}-${bundle.id}`,
        gapId: gap.id,
        priority: gap.priority,
        lane: gap.lane,
        gapTitle: gap.title,
        sourcePoolId: pool.id,
        sourcePoolTitle: pool.title,
        sourcePoolPriority: pool.priority,
        sourcePoolUrl: pool.url,
        queryLabel: bundle.label,
        queryTerms: bundle.terms.join(" "),
        catalogSearchUrl: catalogSearchUrl(bundle.terms),
        sourcePoolSearchUrl: sourcePoolSearchUrl(pool, bundle.terms),
        nextAction: gap.nextActions?.[0] || pool.nextUse || "",
        expectedUse: pool.nextUse || "",
        evidence: gap.evidence || ""
      };
      queries.push(query);
      runbookRows.push(query);
    }
  }

  return {
    id: gap.id,
    priority: gap.priority,
    status: gap.status,
    lane: gap.lane,
    title: gap.title,
    evidence: gap.evidence,
    needed: gap.needed,
    nextActions: gap.nextActions || [],
    targetTerms: gap.targetTerms || [],
    sourcePools: pools,
    queries
  };
}

function buildTermBundles(gap) {
  const terms = unique(gap.targetTerms || []);
  const compactTerms = terms.slice(0, 5);
  const bundles = [
    {
      id: "primary",
      label: "Primary terms",
      terms: compactTerms
    }
  ];

  if (/libya|pan am|lockerbie/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "libya-sanctions", label: "Libya sanctions", terms: ["Libya", "Pan Am 103", "Lockerbie", "sanctions"] });
  }
  if (/egypt|mubarak|gulf/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "egypt-africa", label: "Egypt Africa overlap", terms: ["Mubarak", "Egypt", "Africa", "Sudan", "Libya"] });
  }
  if (/state department|source base|central/i.test(gap.title + " " + gap.needed)) {
    bundles.push({ id: "state-base", label: "State source base", terms: ["Africa", "Bureau of African Affairs", "Baker", "Policy Planning"] });
  }
  if (/1992|NSR-30|NSD-75|post-Cold/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "africa-policy-1992", label: "1992 Africa policy", terms: ["NSR-30", "NSD-75", "Africa in the 1990s"] });
  }
  if (/Horn|Sudan|Ethiopia|refugees/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "horn-humanitarian", label: "Horn humanitarian", terms: ["Sudan", "Ethiopia", "Eritrea", "refugees", "humanitarian"] });
  }
  if (/Liberia|ECOMOG|Nigeria|Sahel/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "west-africa-crisis", label: "West Africa crisis", terms: ["Liberia", "ECOMOG", "Nigeria", "Sahel"] });
  }
  if (/Zaire|Rwanda|Great Lakes/i.test(gap.title + " " + terms.join(" "))) {
    bundles.push({ id: "great-lakes", label: "Great Lakes", terms: ["Zaire", "Rwanda", "Burundi", "Great Lakes"] });
  }

  return uniqueBy(bundles, (bundle) => bundle.id);
}

function buildSourcePoolIndex(pools) {
  const index = new Map();
  for (const pool of pools) {
    for (const key of sourcePoolKeys(pool)) index.set(normalize(key), pool);
  }
  return index;
}

function sourcePoolKeys(pool) {
  const aliases = {
    "bush-memcons": ["Bush Library memcons/telcons", "Memcons and Telcons"],
    "nsc-records": ["NSC files", "Records of the National Security Council"],
    "scowcroft-papers": ["Scowcroft Papers"],
    "presidential-daily-file": ["Presidential Daily File", "PDB/Presidential Daily File"],
    "presidential-daily-diary-backup": ["Presidential Daily Diary/Backup", "Presidential Daily Diary and Presidential Daily Backup Materials"],
    "nsc-meetings": ["NSC Meeting Files"],
    "nsc-dc": ["NSC/DC Meetings", "NSC/DC Meetings and Follow-Up", "Deputies Committee"],
    "nsr-files": ["NSR Files", "National Security Review Files"],
    "nsd-files": ["NSD Files", "National Security Directive Files"],
    whorm: ["WHORM"],
    "chief-of-staff": ["Chief of Staff files"],
    "state-central": ["State Department central files", "State Department central and bureau files", "Bureau of African Affairs"],
    "govinfo-public-papers": ["GovInfo Public Papers", "Public Papers companion harvests"],
    "cross-volume": ["FRUS cross-volume comparator", "Southern Africa companion work", "Somalia Volume XXI", "Counterterrorism companion volume", "Counternarcotics companion volume", "Human rights source files"]
  };
  return [pool.id, pool.title, ...(aliases[pool.id] || [])];
}

function resolveSourcePool(name) {
  const found = sourcePoolByName.get(normalize(name));
  if (found) return found;
  return {
    id: slug(name),
    priority: "Missing",
    lane: "All lanes",
    title: name,
    url: "",
    coverage: "Not yet mapped as a public source-pool URL.",
    nextUse: "Map collection, access route, and search terms before harvest."
  };
}

function catalogSearchUrl(terms) {
  return `https://catalog.archives.gov/search?q=${encodeURIComponent(terms.join(" "))}&availableOnline=true&limit=100`;
}

function sourcePoolSearchUrl(pool, terms) {
  const naid = naidFromUrl(pool.url);
  if (naid) return `https://catalog.archives.gov/search-within/${naid}?q=${encodeURIComponent(terms.join(" "))}&availableOnline=true&limit=100`;
  return pool.url || catalogSearchUrl(terms);
}

function naidFromUrl(url) {
  if (!url) return "";
  const match = String(url).match(/catalog\.archives\.gov\/(?:id|search-within)\/(\d+)/);
  return match ? match[1] : "";
}

function writeMarkdown(filePath, runbook) {
  const lines = [
    "# FRUS Volume XX Research Runbook",
    "",
    `Generated: ${runbook.generatedAt}`,
    `Live page: ${runbook.volume.livePageUrl}`,
    `Official volume: ${runbook.volume.url}`,
    "",
    "## Summary",
    "",
    `- Gap worklists: ${runbook.summary.gapCount}`,
    `- Critical gaps: ${runbook.summary.criticalGapCount}`,
    `- Source pools: ${runbook.summary.sourcePoolCount}`,
    `- Query rows: ${runbook.summary.queryCount}`,
    `- State Department query rows: ${runbook.summary.stateDepartmentQueryCount}`,
    "",
    "## CSV Outputs",
    "",
    "- research-runbook/all-gap-queries.csv",
    "- research-runbook/priority-gap-queries.csv",
    ""
  ];

  for (const gap of runbook.gaps) {
    lines.push(`## ${gap.title}`, "", `Priority: ${gap.priority}`, `Lane: ${gap.lane}`, `Needed: ${gap.needed}`, "");
    for (const query of gap.queries.slice(0, 10)) {
      lines.push(
        `- ${query.sourcePoolTitle} / ${query.queryLabel}`,
        `  - Terms: ${query.queryTerms}`,
        `  - Catalog: ${query.catalogSearchUrl}`,
        `  - Source-pool search: ${query.sourcePoolSearchUrl}`
      );
    }
    lines.push("");
  }

  fs.writeFileSync(filePath, `${lines.join("\n").trim()}\n`);
}

function writeCsv(filePath, rows) {
  const columns = [
    "id",
    "gapId",
    "priority",
    "lane",
    "gapTitle",
    "sourcePoolId",
    "sourcePoolTitle",
    "sourcePoolPriority",
    "sourcePoolUrl",
    "queryLabel",
    "queryTerms",
    "catalogSearchUrl",
    "sourcePoolSearchUrl",
    "nextAction",
    "expectedUse",
    "evidence"
  ];
  fs.writeFileSync(filePath, toCsv(rows, columns));
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

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value) {
  return normalize(value).replace(/ /g, "-");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(values, getter) {
  const seen = new Set();
  return values.filter((value) => {
    const key = getter(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
