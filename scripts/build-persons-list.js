#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const defaultDocxPath = path.join(repoRoot, "sources", "Bush Comprehensive Names List.docx");
const namesDocxPath = process.env.BUSH_NAMES_DOCX || defaultDocxPath;

const records = readJson("records.json");
const boundaryRecords = readJson("boundary-records.json");

const US_PRINCIPALS = [
  {
    name: "James Baker",
    lookup: ["Baker, James Addison"],
    scope: "U.S. principal"
  },
  {
    name: "Brent Scowcroft",
    lookup: ["Scowcroft, Gen. Brent", "Scowcroft"],
    scope: "U.S. principal"
  },
  {
    name: "Herman J. Cohen",
    lookup: ["Cohen, Herman Jay"],
    scope: "U.S. principal"
  },
  {
    name: "Chester Crocker",
    lookup: ["Crocker, Chester Arthur"],
    scope: "U.S. principal"
  },
  {
    name: "Lawrence Eagleburger",
    lookup: ["Eagleburger, Lawrence Sidney"],
    scope: "U.S. principal"
  },
  {
    name: "Robert Gates",
    lookup: ["Gates, Robert M."],
    scope: "U.S. principal"
  },
  {
    name: "Richard Cheney",
    lookup: ["Cheney, Richard Bruce"],
    scope: "U.S. principal"
  },
  {
    name: "Colin Powell",
    lookup: ["Powell, Colin L."],
    scope: "U.S. principal"
  },
  {
    name: "Robert Kimmitt",
    lookup: ["Kimmitt, Robert M."],
    scope: "U.S. principal"
  },
  {
    name: "Dennis Ross",
    lookup: ["Ross, Dennis B."],
    scope: "U.S. principal"
  },
  {
    name: "Richard Haass",
    lookup: ["Haass, Richard N."],
    scope: "U.S. principal"
  },
  {
    name: "John Kelly",
    lookup: ["Kelly, John Hubert"],
    scope: "U.S. principal"
  }
];

const COMPILER_TARGETS = [
  {
    name: "Muammar Qadhafi",
    fallback: "Qadhafi, Muammar, leader of Libya",
    scope: "Compiler source target"
  },
  {
    name: "Haile Mariam Mengistu",
    lookup: ["Mengistu, Haile Mariam"],
    scope: "Compiler source target"
  },
  {
    name: "Omar al-Bashir",
    fallback: "Bashir, Omar al-, President of Sudan from June 30, 1989",
    scope: "Compiler source target"
  },
  {
    name: "Samuel Doe",
    lookup: ["Doe, Gen. Samuel K."],
    scope: "Compiler source target"
  },
  {
    name: "Charles Taylor",
    fallback: "Taylor, Charles, leader of the National Patriotic Front of Liberia",
    scope: "Compiler source target"
  },
  {
    name: "Juvenal Habyarimana",
    fallback: "Habyarimana, Juvenal, President of Rwanda",
    scope: "Compiler source target"
  }
];

const FALLBACKS = {
  "Abdellatif Filali": "Filali, Abdellatif, Foreign Minister of Morocco",
  "Ahmed Esmat Abdel Meguid": "Meguid, Ahmed Esmat Abdel, Foreign Minister of Egypt until May 1991",
  "Amr Mousa": "Mousa, Amr, Foreign Minister of Egypt from May 1991",
  "Aristides Pereira": "Pereira, Aristides, President of Cape Verde until March 22, 1991",
  "Carlos Veiga": "Veiga, Carlos, Prime Minister of Cape Verde from April 4, 1991",
  "Hassan Gouled Aptidon": "Gouled Aptidon, Hassan, President of Djibouti",
  "Ibrahim Babangida": "Babangida, Ibrahim, President of Nigeria",
  "Ismail Khelil": "Khelil, Ismail, Ambassador of Tunisia to the United States",
  "Pierre Buyoya": "Buyoya, Pierre, President of Burundi until July 10, 1993",
  "Youssef Abu Talib": "Abu Talib, Youssef, Minister of Defense of Egypt",
  "Gatsha Mangosuthu Buthelezi": "Buthelezi, Gatsha Mangosuthu, Chief Minister of KwaZulu and leader of the Inkatha Freedom Party",
  "Nelson Mandela": "Mandela, Nelson, Deputy President of the African National Congress",
  "Quett K J. Masire": "Masire, Quett K.J., President of Botswana"
};

const LOOKUP_OVERRIDES = {
  "George H. W. Bush": ["Bush, George Herbert Walker"],
  "King Hassan II": ["Hassan II, King of Morocco", "Hassan II"],
  "Yoweri Museveni": ["Musaveni, Yoweri", "Museveni"],
  "F. W. de Klerk": ["De Klerk, Frederik Willem", "de Klerk"],
  "Kenneth D Kaunda": ["Kaunda, Kenneth D."],
  "Jose Eduardo dos Santos": ["dos Santos, Jose Eduardo"],
  "Boutros Boutros-Ghali": ["Boutros-Ghali, Boutros"]
};

const ENTRY_OVERRIDES = {
  "Yoweri Museveni": "Museveni, Yoweri, President of Uganda"
};

if (!fs.existsSync(namesDocxPath)) {
  throw new Error(
    `Could not find Bush names DOCX at ${namesDocxPath}. Set BUSH_NAMES_DOCX to the attached file path.`
  );
}

const authorityEntries = parseDocxParagraphs(namesDocxPath).map((text, index) => ({
  id: `authority-${String(index + 1).padStart(4, "0")}`,
  raw: cleanEntry(text),
  normalized: normalizeText(text)
}));

const candidates = new Map();

for (const record of records) {
  for (const participant of record.participants || []) {
    addCandidate(candidates, participant, "Volume XX chronology", record.country || record.chapter?.name || "");
  }
}

for (const record of boundaryRecords) {
  for (const participant of record.participants || []) {
    addCandidate(candidates, participant, "Boundary handoff", record.country || "");
  }
}

for (const person of US_PRINCIPALS) addCandidate(candidates, person.name, person.scope, "United States", person);
for (const person of COMPILER_TARGETS) addCandidate(candidates, person.name, person.scope, "Gap tracker", person);

const persons = [...candidates.values()]
  .map((candidate) => buildPerson(candidate, authorityEntries))
  .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.entry.localeCompare(b.entry));

writeJsonPair("persons", "PERSONS", persons);
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, "persons-list-build.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      namesDocxSource: sourceLabel(namesDocxPath),
      authorityEntryCount: authorityEntries.length,
      selectedPersonCount: persons.length,
      matchedAuthorityCount: persons.filter((person) => person.source === "Bush Comprehensive Names List").length,
      generatedFallbackCount: persons.filter((person) => person.source !== "Bush Comprehensive Names List").length,
      generatedFallbacks: persons
        .filter((person) => person.source !== "Bush Comprehensive Names List")
        .map((person) => ({ name: person.name, entry: person.entry, scopes: person.scopes })),
      scopes: countBy(persons.flatMap((person) => person.scopes))
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${persons.length} persons from ${authorityEntries.length} authority entries.`);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
}

function sourceLabel(sourcePath) {
  const relative = path.relative(repoRoot, sourcePath);
  return relative && !relative.startsWith("..") ? relative : path.basename(sourcePath);
}

function parseDocxParagraphs(docxPath) {
  const xml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024
  });
  return xml
    .split(/<w:p[\s>]/)
    .map((paragraph) =>
      [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanEntry(value) {
  return String(value || "")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+\[(\d{4})\]/g, " in $1")
    .replace(/\s+\[(\d{4}),\s*(\d{4})\]/g, " in $1 and $2")
    .replace(/\s+\[(\d{4})-(\d{4})\]/g, " from $1 until $2")
    .replace(/\s+\[(\d{4})-(\d{2})\]/g, (_, start, end) => ` from ${start} until ${start.slice(0, 2)}${end}`)
    .replace(/\s+;/g, ";")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(map, name, scope, place = "", detail = {}) {
  if (!name) return;
  const key = normalizeNameKey(name);
  const existing = map.get(key) || {
    name,
    scopes: new Set(),
    places: new Set(),
    lookup: [],
    fallback: ""
  };
  existing.scopes.add(scope);
  if (place) existing.places.add(place);
  existing.lookup.push(...(detail.lookup || []));
  if (detail.fallback) existing.fallback = detail.fallback;
  map.set(key, existing);
}

function normalizeNameKey(name) {
  return normalizeText(name).replace(/\b(george|h|w|president|king|gen|col|lt)\b/g, "").replace(/\s+/g, " ").trim();
}

function buildPerson(candidate, authorityEntries) {
  const lookups = [
    ...(candidate.lookup || []),
    ...(LOOKUP_OVERRIDES[candidate.name] || []),
    candidate.name
  ].filter(Boolean);
  const authority = findAuthority(lookups, authorityEntries);
  const fallback = candidate.fallback || FALLBACKS[candidate.name] || fallbackFromName(candidate.name);
  const entry = ENTRY_OVERRIDES[candidate.name] || authority?.raw || fallback;
  const display = splitEntry(entry);
  return {
    id: slug(entry),
    name: candidate.name,
    entry,
    displayName: display.name,
    description: display.description,
    sortKey: sortKeyForEntry(entry),
    scopes: [...candidate.scopes].sort(),
    places: [...candidate.places].filter(Boolean).sort(),
    source: authority && !ENTRY_OVERRIDES[candidate.name] ? "Bush Comprehensive Names List" : "Volume XX compiler normalization",
    needsReview: !authority || Boolean(ENTRY_OVERRIDES[candidate.name])
  };
}

function splitEntry(entry) {
  const parts = String(entry || "").split(",").map((part) => part.trim());
  if (parts.length < 2) return { name: entry, description: "" };

  const second = parts[1] || "";
  const secondIsRole = /^(King|President|Prime Minister|Foreign Minister|Minister|Ambassador|Secretary|Leader|leader)\b/.test(second);
  let namePartCount = secondIsRole ? 1 : 2;
  if (/^(Jr\.?|Sr\.?|I{2,3}|IV|V|\(.+\))$/.test(parts[2] || "")) namePartCount = 3;

  return {
    name: parts.slice(0, namePartCount).join(", "),
    description: parts.slice(namePartCount).join(", ")
  };
}

function findAuthority(lookups, authorityEntries) {
  for (const lookup of lookups) {
    const normalizedLookup = normalizeText(lookup);
    const exact = authorityEntries.find((entry) => entry.normalized.startsWith(normalizedLookup));
    if (exact) return exact;
  }

  for (const lookup of lookups) {
    const tokens = normalizeText(lookup)
      .split(" ")
      .filter((token) => token.length > 1 && !["king", "president", "gen", "col", "lt"].includes(token));
    if (!tokens.length) continue;
    const last = tokens[tokens.length - 1];
    const first = tokens[0];
    const loose = authorityEntries.find((entry) => entry.normalized.includes(last) && entry.normalized.includes(first));
    if (loose) return loose;
  }
  return null;
}

function fallbackFromName(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  return `${surname}, ${given}`;
}

function sortKeyForEntry(entry) {
  return normalizeText(entry.split(",")[0] || entry);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
