#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildSelectionMatrix, countBy } = require("./selection-matrix-core");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const records = readJson("records");
const boundaryRecords = readJson("boundary-records");
const policyFiles = readJson("policy-files");
const publicReferences = readJson("public-references");

const matrix = buildSelectionMatrix({ records, boundaryRecords, policyFiles, publicReferences });

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

function readJson(baseName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${baseName}.json`), "utf8"));
}
