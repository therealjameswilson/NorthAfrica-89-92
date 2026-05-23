#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");

const records = readJson("records.json");
const boundaryRecords = readJson("boundary-records.json");
const policyFiles = readJson("policy-files.json");
const publicReferences = readJson("public-references.json");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

function countCountry(country) {
  return countWhere(records, (record) => record.country === country);
}

function countLane(lane) {
  return countWhere(records, (record) => record.chapter?.name === lane);
}

function yearCount(year) {
  return countWhere(records, (record) => String(record.sortDate || record.date || "").startsWith(String(year)));
}

function publicLaneCount(lane) {
  return countWhere(publicReferences, (record) => record.chapter === lane);
}

const partialCount = countWhere(records, (record) => /partial|restricted/i.test(record.releaseStatus || ""));
const markerCount = countWhere(records, (record) => /marker|no memorandum/i.test(record.releaseStatus || ""));
const egyptCount = countCountry("Egypt");
const libyaPolicyCount = countWhere(policyFiles, (file) => /Libya/i.test(file.title));
const africaPolicyCount = countWhere(policyFiles, (file) => /Africa|Sub-Saharan/i.test(file.title));
const maghrebPolicyCount = countWhere(policyFiles, (file) => /Maghreb|Morocco|Algeria|Tunisia/i.test(file.title));

const gapTracker = [
  {
    id: "gap-egypt-cross-volume",
    priority: "Critical",
    status: "Open",
    lane: "North Africa",
    title: "Separate Egypt-Africa records from Arab-Israeli and Gulf crisis records",
    evidence: `${egyptCount} of ${records.length} current Volume XX conversation rows are Egypt records; several 1990-1991 Mubarak calls are Gulf crisis markers or partial releases.`,
    problem:
      "Egypt is geographically in Volume XX, but much of the Bush-Mubarak documentary traffic belongs analytically to Arab-Israeli diplomacy or the Persian Gulf crisis.",
    needed:
      "A cross-volume selection matrix that tags every Egypt row as Volume XX core, Volume XIV overlap, Persian Gulf overlap, counterterrorism overlap, or retain-only chronology.",
    nextActions: [
      "Compare every Egypt row against FRUS Volume XIV, the Persian Gulf crisis volumes, and Volume XXVIII terrorism records.",
      "Mark Gulf crisis telcons from August 1990-March 1991 for duplicate or excerpt review.",
      "Flag Egypt records with Africa-specific content: Libya, Sudan, Horn, Nile basin, OAU, African regional policy."
    ],
    targetTerms: ["Mubarak", "Egypt", "Libya", "Sudan", "OAU", "Arab-Israeli", "Persian Gulf"],
    sourcePools: ["Bush Library memcons/telcons", "FRUS cross-volume comparator", "NSC files", "State Department central files"]
  },
  {
    id: "gap-libya-pan-am",
    priority: "Critical",
    status: "Open",
    lane: "North Africa",
    title: "Build a real Libya, Pan Am 103, and sanctions source lane",
    evidence: `${libyaPolicyCount} Libya policy file is currently surfaced; there are no Libya country conversation rows in the Bush Library memcon/telcon intake.`,
    problem:
      "Libya should be a central North Africa chapter thread, but the current corpus mostly reaches Libya through public statements and one NSC meeting file.",
    needed:
      "NSC, State, counterterrorism, UN, Treasury/sanctions, intelligence-policy, legal, and allied-consultation records around Libya and Pan Am 103.",
    nextActions: [
      "Harvest NSC and NSC/DC files for Libya, Qadhafi/Gadhafi, Pan Am 103, Lockerbie, sanctions, UN Security Council, and extradition.",
      "Add State Department Legal Adviser, NEA, IO, S/CT, and sanctions-policy search terms.",
      "Create a Libya chronology that separates terrorism/sanctions from broader North Africa diplomacy."
    ],
    targetTerms: ["Libya", "Qadhafi", "Gadhafi", "Pan Am 103", "Lockerbie", "sanctions", "UNSC", "extradition"],
    sourcePools: ["NSC Meeting Files", "NSC/DC Meetings", "WHORM", "State Department central files", "Counterterrorism companion volume"]
  },
  {
    id: "gap-maghreb-western-sahara",
    priority: "High",
    status: "Open",
    lane: "North Africa",
    title: "Expand the Maghreb beyond leader calls",
    evidence: `Current rows: Morocco ${countCountry("Morocco")}, Algeria ${countCountry("Algeria")}, Tunisia ${countCountry("Tunisia")}; ${maghrebPolicyCount} Maghreb policy file is surfaced.`,
    problem:
      "The site has good head-of-state contacts but little policy substance on Western Sahara, Algeria transition, Tunisian politics, regional security, or economic reform.",
    needed:
      "Policy files, embassy reporting, briefing material, and NSC/State records for Morocco, Algeria, Tunisia, Western Sahara, and Maghreb regional policy.",
    nextActions: [
      "Search source pools for Western Sahara, Polisario, Maghreb, Hassan, Bendjedid, Ben Ali, Filali, and Abdelhamid.",
      "Separate ceremonial contacts from policy-bearing records.",
      "Add withdrawal-sheet leads for partially released Morocco and Tunisia memcons."
    ],
    targetTerms: ["Maghreb", "Western Sahara", "Polisario", "Morocco", "Algeria", "Tunisia", "Hassan", "Ben Ali"],
    sourcePools: ["NSR Files", "Scowcroft Papers", "State Department central files", "Presidential Daily File"]
  },
  {
    id: "gap-horn-east-africa",
    priority: "High",
    status: "Open",
    lane: "Horn and East Africa",
    title: "Recover Horn and East Africa policy files",
    evidence: `${countLane("Horn and East Africa")} conversation rows are currently surfaced; Sudan and Ethiopia have no current conversation rows.`,
    problem:
      "Horn and East Africa coverage is far too thin for a volume that should capture Sudan, Ethiopia/Eritrea, Uganda, Kenya, Djibouti, humanitarian questions, and regional security.",
    needed:
      "State, NSC, humanitarian, regional-security, and embassy files for Sudan, Ethiopia, Eritrea, Uganda, Kenya, Djibouti, Nile basin, and refugee issues.",
    nextActions: [
      "Run NSC and State searches for Sudan, Ethiopia, Eritrea, Mengistu, Bashir, Museveni, Moi, Djibouti, Nile, famine, refugees, and humanitarian relief.",
      "Resolve no-document markers for Museveni, Moi, and Buyoya meetings.",
      "Decide whether Somalia-adjacent humanitarian records belong in Volume XX or Volume XXI."
    ],
    targetTerms: ["Sudan", "Ethiopia", "Eritrea", "Uganda", "Kenya", "Djibouti", "Nile", "famine", "refugees"],
    sourcePools: ["State Department central files", "NSC/DC Meetings", "NSR Files", "Presidential Daily File"]
  },
  {
    id: "gap-west-africa-liberia-sahel",
    priority: "High",
    status: "Open",
    lane: "West Africa and Sahel",
    title: "Add Liberia, Nigeria, Senegal, and Sahel policy substance",
    evidence: `${countLane("West Africa and Sahel")} West Africa/Sahel conversation rows are surfaced; Nigeria has ${countCountry("Nigeria")} rows and Liberia has none.`,
    problem:
      "Current West Africa coverage is mostly leader contacts and misses policy-heavy issues such as Liberia, ECOMOG, Nigerian transition, aid, debt, narcotics certification, and Sahel security.",
    needed:
      "Policy and crisis files for Liberia/ECOMOG, Nigeria, Senegal, Sahel, economic assistance, democracy, and narcotics-certification overlap.",
    nextActions: [
      "Search for Liberia, Taylor, Doe, ECOMOG, ECOWAS, Nigeria, Babangida, Senegal, Diouf, Sahel, debt, aid, narcotics certification.",
      "Create a Liberia crisis lead list even if no presidential conversation exists.",
      "Cross-check counternarcotics records so INCSR/certification material is not lost."
    ],
    targetTerms: ["Liberia", "ECOMOG", "ECOWAS", "Nigeria", "Babangida", "Senegal", "Sahel", "narcotics certification"],
    sourcePools: ["State Department central files", "WHORM", "Chief of Staff files", "Counternarcotics companion volume"]
  },
  {
    id: "gap-central-africa-great-lakes",
    priority: "High",
    status: "Open",
    lane: "Central Africa",
    title: "Build Central Africa and Great Lakes coverage",
    evidence: `${countLane("Central Africa")} Central Africa rows are surfaced, including Zaire ${countCountry("Zaire")} and Burundi ${countCountry("Burundi")}; Rwanda has none.`,
    problem:
      "The current record set does not yet capture enough on Zaire democratization, Rwanda/Burundi instability, regional conflict, or human rights before the Clinton-era crises.",
    needed:
      "Zaire, Rwanda, Burundi, Chad, Cameroon, Congo, and Great Lakes policy files from State, NSC, human rights, and humanitarian source pools.",
    nextActions: [
      "Search for Zaire, Mobutu, Rwanda, Habyarimana, Burundi, Buyoya, Great Lakes, democratization, human rights, refugees, and Chad.",
      "Review the no-document Buyoya marker for possible source copies elsewhere.",
      "Cross-check 1993-2000 Rwanda/Central Africa volumes for inherited issues."
    ],
    targetTerms: ["Zaire", "Mobutu", "Rwanda", "Burundi", "Buyoya", "Great Lakes", "human rights", "refugees"],
    sourcePools: ["State Department central files", "NSC files", "Scowcroft Papers", "Human rights source files"]
  },
  {
    id: "gap-1992-africa-policy",
    priority: "Critical",
    status: "Open",
    lane: "Regional and Multilateral",
    title: "Fill the 1992 post-Cold War Africa policy gap",
    evidence: `Only ${yearCount(1992)} conversation rows date from 1992, while NSR-30 and NSD-75 show major Africa-wide policy activity in 1992.`,
    problem:
      "The current chronology underrepresents the key policy review year when the administration reframed Africa policy after the Cold War.",
    needed:
      "NSR-30 backup, NSD-75 implementation files, interagency papers, aid/security policy records, and State Department reaction/implementation traffic.",
    nextActions: [
      "Harvest NSR-30, NSD-75, Deputies Committee, and State implementation files.",
      "Search for American Policy Toward Africa in the 1990s, Sub-Saharan Africa, democracy, aid, conflict, debt, sanctions, and humanitarian intervention.",
      "Create a 1992 policy-review mini-chronology."
    ],
    targetTerms: ["NSR-30", "NSD-75", "Africa in the 1990s", "Sub-Saharan Africa", "democracy", "aid", "debt"],
    sourcePools: ["NSR Files", "NSD Files", "NSC/DC Meetings", "State Department central files"]
  },
  {
    id: "gap-declassification-ledger",
    priority: "High",
    status: "Open",
    lane: "All lanes",
    title: "Create MDR and declassification worklist",
    evidence: `${partialCount} partial releases and ${markerCount} no-document markers are present in the current intake.`,
    problem:
      "The site shows release status but does not yet drive declassification action: withdrawals, possible appeal targets, duplicate source copies, and excerpt decisions.",
    needed:
      "A formal ledger of partials, no-document markers, likely duplicate source copies, and candidate MDR/referral actions.",
    nextActions: [
      "Tag each partial and marker with issue type: national security redaction, no memorandum, missing PDF, duplicate source copy, or cross-volume handling.",
      "Search Scowcroft, PDB/Presidential Daily File, and State files for duplicate source copies.",
      "Prioritize partial records tied to Libya, Maghreb, Sudan/Horn, and Africa-wide policy."
    ],
    targetTerms: ["Partial", "No Memcon", "No Telcon", "withdrawal", "MDR", "referral", "duplicate source"],
    sourcePools: ["Bush Library memcons/telcons", "Scowcroft Papers", "Presidential Daily File", "State Department central files"]
  },
  {
    id: "gap-state-department-base",
    priority: "Critical",
    status: "Open",
    lane: "All lanes",
    title: "Add State Department source base",
    evidence: "The current data model is built from Bush Library/NARA presidential records and companion-volume Public Papers data; State Department central and bureau files are not yet represented.",
    problem:
      "A FRUS volume cannot be compiled from presidential conversations alone. State cables, memoranda, policy papers, briefing books, and bureau files are essential.",
    needed:
      "Central Foreign Policy Files, Bureau of African Affairs files, NEA/Maghreb files, IO/UN records, S/CT Libya records, Policy Planning, Legal Adviser, and Secretary Baker trip/meeting files.",
    nextActions: [
      "Create a State Department collection map with file series, date ranges, and access routes.",
      "Harvest or manually seed A/AF, NEA, IO, S/CT, L, S/P, and Secretary files.",
      "Add source-note templates for State cables and memoranda distinct from presidential records."
    ],
    targetTerms: ["AF", "NEA", "IO", "S/CT", "Legal Adviser", "Policy Planning", "Central Foreign Policy Files", "Baker"],
    sourcePools: ["State Department central files", "Secretary Baker files", "Bureau of African Affairs", "Policy Planning"]
  },
  {
    id: "gap-public-papers-direct-harvest",
    priority: "Medium",
    status: "Open",
    lane: "All lanes",
    title: "Run a direct Volume XX Public Papers harvest",
    evidence: `${publicReferences.length} public references are currently reused from companion-volume harvests; North Africa has ${publicLaneCount("North Africa")} public references.`,
    problem:
      "The public layer is useful but derivative. It may miss Africa-specific statements not captured by the companion-volume term sets.",
    needed:
      "A direct GovInfo/Public Papers pass using Volume XX country, leader, regional, aid, sanctions, humanitarian, and democracy terms.",
    nextActions: [
      "Harvest GovInfo Public Papers for all Volume XX terms.",
      "Separate public statements from actual source-document candidates.",
      "Mark statements as public-line check, chronology anchor, or source-citation support."
    ],
    targetTerms: ["Africa", "Mubarak", "Hassan", "Ben Ali", "Bendjedid", "Mobutu", "Diouf", "Libya", "Sudan"],
    sourcePools: ["GovInfo Public Papers", "Public Papers companion harvests"]
  },
  {
    id: "gap-boundary-protocol",
    priority: "High",
    status: "Open",
    lane: "Boundary",
    title: "Formalize Southern Africa and Somalia handoff protocol",
    evidence: `${boundaryRecords.length} Southern Africa boundary rows are retained, and Somalia policy files are retained as Volume XXI boundary anchors.`,
    problem:
      "Boundary rows are visible but need documentary rules: exclude, excerpt, cross-reference, or share with adjacent volume work.",
    needed:
      "A rule set for Volume XIX Southern Africa, Volume XXI Somalia, Volume XXVIII terrorism/counternarcotics, Volume XIV Arab-Israeli, and Persian Gulf crisis overlaps.",
    nextActions: [
      "Add boundary status to every overlap row: exclude, cite elsewhere, duplicate candidate, or retain in Volume XX.",
      "Create adjacent-volume links for Somalia, Southern Africa, Arab-Israeli, Gulf crisis, and terrorism records.",
      "Use boundary protocol before adding records to the main chronology."
    ],
    targetTerms: ["Somalia", "South Africa", "Angola", "Mozambique", "Volume XIX", "Volume XXI", "Volume XXVIII"],
    sourcePools: ["Southern Africa companion work", "Somalia Volume XXI", "FRUS cross-volume comparator"]
  }
];

const sourcePools = [
  {
    id: "bush-memcons",
    priority: "Active",
    lane: "All lanes",
    title: "Bush Library Memcons and Telcons",
    url: "https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons",
    coverage: "Presidential memoranda of conversation and telephone conversations already harvested.",
    nextUse: "Continue as official chronology intake; use markers and partials for declassification ledger."
  },
  {
    id: "nsc-records",
    priority: "Next",
    lane: "All lanes",
    title: "Records of the National Security Council, George H. W. Bush Administration",
    url: "https://catalog.archives.gov/id/2163580",
    coverage: "Parent NSC collection for African Affairs, regional policy, source packets, and interagency files.",
    nextUse: "Run targeted query sets by gap lane and promote file-unit leads into source-candidate worklists."
  },
  {
    id: "scowcroft-papers",
    priority: "Next",
    lane: "All lanes",
    title: "Brent Scowcroft Papers",
    url: "https://catalog.archives.gov/id/4522156",
    coverage: "Head-of-state correspondence, selected NSC files, memoranda, and book-source material.",
    nextUse: "Search for duplicate source copies of partial or marker conversations and high-level Libya/Maghreb/Africa policy files."
  },
  {
    id: "presidential-daily-file",
    priority: "Next",
    lane: "All lanes",
    title: "Presidential Daily File",
    url: "https://catalog.archives.gov/search-within/595141?availableOnline=true&limit=100",
    coverage: "Daily White House materials, schedules, briefing material, and public/private event packets.",
    nextUse: "Validate state visits, leader meetings, briefing books, and event context around African leaders."
  },
  {
    id: "nsc-meetings",
    priority: "Next",
    lane: "Regional and Multilateral",
    title: "NSC Meeting Files",
    url: "https://catalog.archives.gov/id/312293887",
    coverage: "NSC meeting files; current seeded Libya meeting anchor comes from this lane.",
    nextUse: "Search Libya, Africa policy, sanctions, Somalia boundary, Sudan/Horn, and regional policy."
  },
  {
    id: "nsc-dc",
    priority: "Next",
    lane: "Regional and Multilateral",
    title: "NSC/Deputies Committee Meetings and Follow-Up",
    url: "https://catalog.archives.gov/id/312294079",
    coverage: "Deputies Committee meeting files and follow-up files for interagency policy decisions.",
    nextUse: "Search policy implementation, Somalia boundary, Libya sanctions, humanitarian crises, and NSD follow-up."
  },
  {
    id: "nsr-files",
    priority: "Active",
    lane: "Regional and Multilateral",
    title: "National Security Review Files",
    url: "https://catalog.archives.gov/id/313189297",
    coverage: "NSR-23 Maghreb and NSR-30 Africa-wide policy are already surfaced.",
    nextUse: "Harvest supporting packets, drafts, distribution, and implementation trails."
  },
  {
    id: "nsd-files",
    priority: "Active",
    lane: "Regional and Multilateral",
    title: "National Security Directive Files",
    url: "https://catalog.archives.gov/id/313189290",
    coverage: "NSD-75 Sub-Saharan Africa policy anchor is already surfaced.",
    nextUse: "Harvest NSD-75 drafting, final text, implementation, and State/agency responses."
  },
  {
    id: "whorm",
    priority: "Next",
    lane: "All lanes",
    title: "White House Office of Records Management",
    url: "https://catalog.archives.gov/id/564645",
    coverage: "WHORM case files, correspondence, issue files, and public input around policy topics.",
    nextUse: "Search Libya/Pan Am, sanctions, Africa aid, human rights, narcotics certification, and visits."
  },
  {
    id: "chief-of-staff",
    priority: "Next",
    lane: "All lanes",
    title: "White House Office of the Chief of Staff",
    url: "https://catalog.archives.gov/id/580456",
    coverage: "Senior White House policy coordination, issue files, and staffing material.",
    nextUse: "Search Libya sanctions, Africa policy review, humanitarian crises, and high-level visit preparation."
  },
  {
    id: "state-central",
    priority: "Missing",
    lane: "All lanes",
    title: "State Department Central Foreign Policy and Bureau Files",
    url: "",
    coverage: "Not yet represented in the public site.",
    nextUse: "Map and add Central Foreign Policy Files, Bureau of African Affairs, NEA/Maghreb, IO, S/CT, L, S/P, and Secretary Baker material."
  },
  {
    id: "govinfo-public-papers",
    priority: "Missing",
    lane: "All lanes",
    title: "GovInfo Public Papers direct Volume XX harvest",
    url: "https://www.govinfo.gov/app/collection/PPP",
    coverage: "Current layer is derived from companion-volume harvests.",
    nextUse: "Run a dedicated Volume XX public-line harvest using Africa country, leader, sanctions, humanitarian, and regional-policy terms."
  },
  {
    id: "cross-volume",
    priority: "Next",
    lane: "Boundary",
    title: "FRUS Cross-Volume Comparator",
    url: "https://history.state.gov/historicaldocuments",
    coverage: "Adjacent published and in-progress volumes for Egypt, Gulf, Southern Africa, Somalia, and terrorism overlap.",
    nextUse: "Tag records by primary volume ownership before selecting for Volume XX."
  }
];

writeJsonPair("gap-tracker", "GAP_TRACKER", gapTracker);
writeJsonPair("source-pools", "SOURCE_POOLS", sourcePools);

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(
  path.join(reportDir, "gap-tracker-build.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      gapCount: gapTracker.length,
      sourcePoolCount: sourcePools.length,
      counts: {
        records: records.length,
        boundaryRecords: boundaryRecords.length,
        policyFiles: policyFiles.length,
        publicReferences: publicReferences.length,
        egyptCount,
        partialCount,
        markerCount,
        conversationRows1992: yearCount(1992)
      }
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${gapTracker.length} gap items and ${sourcePools.length} source pools.`);

function writeJsonPair(baseName, variableName, value) {
  const json = JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(dataDir, `${baseName}.json`), `${json}\n`);
  fs.writeFileSync(path.join(dataDir, `${baseName}.js`), `window.${variableName} = ${json};\n`);
}
