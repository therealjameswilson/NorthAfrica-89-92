#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const scanPdfs = process.env.SOURCE_NOTE_SCAN_PDFS === "1";
const hasPdfToText = commandExists("pdftotext");

const datasets = [
  { baseName: "records", variableName: "VOLUME_RECORDS", kind: "conversation" },
  { baseName: "boundary-records", variableName: "BOUNDARY_RECORDS", kind: "conversation" },
  { baseName: "policy-files", variableName: "POLICY_FILES", kind: "policy" },
  { baseName: "public-references", variableName: "PUBLIC_REFERENCES", kind: "public" },
  { baseName: "source-copy-ledger", variableName: "SOURCE_COPY_LEDGER", kind: "ledger", optional: true }
];

const report = {
  generatedAt: new Date().toISOString(),
  scannedPdfs: scanPdfs,
  pdftotextAvailable: hasPdfToText,
  datasets: {},
  scanFailures: []
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const tempDir = scanPdfs && hasPdfToText ? fs.mkdtempSync(path.join(os.tmpdir(), "frus-source-notes-")) : "";
  const pdfScanCache = new Map();
  const allItemsByNaid = new Map();
  const enrichedDatasets = {};

  try {
    for (const dataset of datasets.filter((item) => item.kind !== "ledger")) {
      const items = readJson(dataset.baseName, dataset.optional);
      if (!items) continue;
      const enriched = await mapLimit(items, 5, async (item) =>
        enrichItem(item, dataset.kind, tempDir, pdfScanCache)
      );
      enrichedDatasets[dataset.baseName] = { dataset, items: enriched };
      for (const item of enriched) {
        if (item.naid) allItemsByNaid.set(String(item.naid), item);
      }
    }

    const ledgerDataset = datasets.find((item) => item.kind === "ledger");
    const ledgerItems = readJson(ledgerDataset.baseName, true);
    if (ledgerItems) {
      enrichedDatasets[ledgerDataset.baseName] = {
        dataset: ledgerDataset,
        items: ledgerItems.map((item) => enrichLedgerItem(item, allItemsByNaid))
      };
    }

    for (const { dataset, items } of Object.values(enrichedDatasets)) {
      writeJsonPair(dataset.baseName, dataset.variableName, items);
      report.datasets[dataset.baseName] = {
        count: items.length,
        frusSourceNoteCount: countWhere(items, (item) => item.frusSourceNote),
        classificationMarkingCount: countWhere(items, (item) => item.classificationMarking)
      };
    }

    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, "frus-source-notes-build.json"), `${JSON.stringify(report, null, 2)}\n`);
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`Wrote FRUS-style source notes for ${Object.keys(enrichedDatasets).length} datasets.`);
}

async function enrichItem(item, kind, tempDir, pdfScanCache) {
  const scanned = await scanPdfForMarkings(item, kind, tempDir, pdfScanCache);
  const useScannedHandling = scanPdfs && kind === "conversation";
  const enriched = withInsertedSourceNoteFields(item, {
    classificationMarking: item.classificationMarking || scanned.classificationMarking || "",
    handlingMarkings: useScannedHandling ? scanned.handlingMarkings || [] : item.handlingMarkings || scanned.handlingMarkings || [],
    frusSourceNote: ""
  });
  enriched.frusSourceNote = buildFrusSourceNote(enriched, kind);
  return enriched;
}

function enrichLedgerItem(item, allItemsByNaid) {
  const sourceItem = allItemsByNaid.get(String(item.naid || ""));
  const enriched = withInsertedSourceNoteFields(item, {
    classificationMarking: item.classificationMarking || sourceItem?.classificationMarking || "",
    handlingMarkings: item.handlingMarkings || sourceItem?.handlingMarkings || [],
    frusSourceNote: sourceItem?.frusSourceNote || item.frusSourceNote || buildFrusSourceNote(item, "ledger")
  });
  return enriched;
}

function withInsertedSourceNoteFields(item, fields) {
  const { sourceNote, frusSourceNote, classificationMarking, handlingMarkings, ...rest } = item;
  const hasHandlingMarkings = Object.prototype.hasOwnProperty.call(fields, "handlingMarkings");
  const output = { ...rest };
  const nextClassificationMarking = fields.classificationMarking || classificationMarking || "";
  const nextHandlingMarkings = hasHandlingMarkings ? fields.handlingMarkings || [] : handlingMarkings || [];
  if (nextClassificationMarking) output.classificationMarking = nextClassificationMarking;
  if (nextHandlingMarkings.length) output.handlingMarkings = nextHandlingMarkings;
  output.frusSourceNote = fields.frusSourceNote || frusSourceNote || "";
  output.sourceNote = sourceNote;
  return output;
}

async function scanPdfForMarkings(item, kind, tempDir, pdfScanCache) {
  if (!scanPdfs || !hasPdfToText || kind !== "conversation" || !item.pdfUrl) {
    return {};
  }

  if (pdfScanCache.has(item.pdfUrl)) return pdfScanCache.get(item.pdfUrl);

  const safeName = `${item.naid || item.id || pdfScanCache.size}.pdf`.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const pdfPath = path.join(tempDir, safeName);
  try {
    await downloadFile(item.pdfUrl, pdfPath);
    const text = childProcess.execFileSync("pdftotext", ["-f", "1", "-l", "2", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    const result = detectMarkings(text);
    pdfScanCache.set(item.pdfUrl, result);
    return result;
  } catch (error) {
    report.scanFailures.push({
      naid: item.naid || "",
      title: item.title || "",
      pdfUrl: item.pdfUrl,
      error: error.message
    });
    const result = {};
    pdfScanCache.set(item.pdfUrl, result);
    return result;
  } finally {
    fs.rmSync(pdfPath, { force: true });
  }
}

function buildFrusSourceNote(item, kind) {
  if (kind === "public") return normalizePublicSourceNote(item);

  const location = sourceLocation(item, kind);
  const sentences = [`Source: ${location}.`];
  const markings = markingSentence(item);
  if (markings) sentences.push(markings);

  if (kind === "policy") {
    if (item.levelOfDescription) sentences.push(`${levelLabel(item.levelOfDescription)}.`);
    sentences.push(`Catalog metadata records access status as ${item.accessRestriction || "not stated"}.`);
  } else {
    sentences.push(`Catalog metadata records access/release status as ${item.releaseStatus || item.accessRestriction || "not stated"}.`);
  }

  if (item.naid) sentences.push(`Catalog reference: NAID ${item.naid}.`);
  return cleanSentenceSpacing(sentences.join(" "));
}

function sourceLocation(item, kind) {
  const source = item.source || {};
  const parts = ["George H.W. Bush Library"];
  if (source.collection) parts.push(source.collection);
  if (source.series) parts.push(source.series);
  if (source.fileUnitTitle) parts.push(source.fileUnitTitle);
  if (kind === "policy" && item.title) parts.push(item.title);

  if (parts.length === 1 && item.sourceNote) return compactCatalogSource(item.sourceNote);
  return parts.map(cleanSourcePart).filter(Boolean).join(", ");
}

function markingSentence(item) {
  const markings = [];
  if (item.classificationMarking) markings.push(item.classificationMarking);
  for (const marking of item.handlingMarkings || []) {
    if (marking && !markings.includes(marking)) markings.push(marking);
  }
  if (markings.length) return `${markings.join("; ")}.`;
  return "Classification marking not identified in the available catalog/OCR metadata.";
}

function normalizePublicSourceNote(item) {
  const note = item.citation || item.sourceNote || "Public Papers reference.";
  return /^Source:/i.test(note) ? note : `Source: ${note}`;
}

function compactCatalogSource(sourceNote) {
  const collection = matchSourceNote(sourceNote, /Collection: ([^.]+)\./);
  const series = matchSourceNote(sourceNote, /Series: ([^.]+)\./);
  const fileUnit = matchSourceNote(sourceNote, /File unit: ([^.]+)\./);
  return ["George H.W. Bush Library", collection, series, fileUnit].filter(Boolean).join(", ");
}

function matchSourceNote(note, regex) {
  const match = String(note || "").match(regex);
  return match ? match[1].replace(/, NAID \d+$/i, "") : "";
}

function cleanSourcePart(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, ":")
    .trim();
}

function cleanSentenceSpacing(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function levelLabel(value) {
  if (String(value || "").toLowerCase() === "fileunit") return "File unit";
  return titleCase(value);
}

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detectMarkings(text) {
  const lines = String(text || "").split(/\r?\n/).slice(0, 120);
  const tokens = lines
    .join(" ")
    .toUpperCase()
    .match(/[A-Z0-9!|]{3,}/g) || [];
  const normalizedTokens = tokens.map(normalizeToken).filter(Boolean);

  let classificationMarking = "";
  if (hasAdjacentTokens(normalizedTokens, "TOP", "SECRET") || normalizedTokens.some((token) => /^TOPSECRET$/.test(token))) {
    classificationMarking = "Top Secret";
  } else if (normalizedTokens.some((token) => /^SECRET$/.test(token))) {
    classificationMarking = "Secret";
  } else if (normalizedTokens.some((token) => token.startsWith("CONF") && token.includes("ENTIA"))) {
    classificationMarking = "Confidential";
  }

  const handlingMarkings = [];
  if (normalizedTokens.some((token) => token.startsWith("SENSITIV"))) handlingMarkings.push("Sensitive");
  if (normalizedTokens.includes("NODIS")) handlingMarkings.push("Nodis");
  if (normalizedTokens.includes("LIMDIS")) handlingMarkings.push("Limdis");
  if (normalizedTokens.includes("EXDIS")) handlingMarkings.push("Exdis");
  if (hasAdjacentTokens(normalizedTokens, "EYES", "ONLY")) handlingMarkings.push("Eyes Only");
  if (normalizedTokens.includes("OADR")) handlingMarkings.push("OADR");
  if (!classificationMarking) {
    return {
      classificationMarking,
      handlingMarkings: handlingMarkings.filter((marking) => marking !== "OADR")
    };
  }

  return { classificationMarking, handlingMarkings };
}

function normalizeToken(token) {
  return String(token || "")
    .toUpperCase()
    .replace(/[0]/g, "O")
    .replace(/[1!|]/g, "I")
    .replace(/[^A-Z]/g, "");
}

function hasAdjacentTokens(tokens, first, second) {
  return tokens.some((token, index) => token === first && tokens[index + 1] === second);
}

function readJson(baseName, optional = false) {
  const filePath = path.join(dataDir, `${baseName}.json`);
  if (!fs.existsSync(filePath)) {
    if (optional) return null;
    throw new Error(`Missing data file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

async function mapLimit(items, limit, iterator) {
  const output = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      output[currentIndex] = await iterator(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function commandExists(command) {
  try {
    childProcess.execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function downloadFile(url, targetPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects > 5) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        resolve(downloadFile(new URL(response.headers.location, url).toString(), targetPath, redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const file = fs.createWriteStream(targetPath);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });
    request.setTimeout(45000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
    request.on("error", reject);
  });
}
