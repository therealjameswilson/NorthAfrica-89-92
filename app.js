const meta = window.VOLUME_META || { chapters: [] };
const records = assignCompilerNumbers(window.VOLUME_RECORDS || []);
const boundaryRecords = assignBoundaryNumbers(window.BOUNDARY_RECORDS || []);
const policyFiles = window.POLICY_FILES || [];
const publicReferences = window.PUBLIC_REFERENCES || [];
const gapTracker = window.GAP_TRACKER || [];
const sourcePools = window.SOURCE_POOLS || [];
const sourceCopyLedger = window.SOURCE_COPY_LEDGER || [];
const compilerBrief = window.COMPILER_BRIEF || null;
const sourceNotePacket = window.SOURCE_NOTE_PACKET || null;
const researchRunbook = window.RESEARCH_RUNBOOK || null;
const countryDossiers = window.COUNTRY_DOSSIERS || null;
const draftDocumentList = window.DRAFT_DOCUMENT_LIST || null;
const documentReadinessPacket = window.DOCUMENT_READINESS_PACKET || null;
const blockerResolutionPacket = window.BLOCKER_RESOLUTION_PACKET || null;
const documentStubsPacket = window.DOCUMENT_STUBS_PACKET || null;
const decisionWorksheets = window.DECISION_WORKSHEETS || null;
const chapters = meta.chapters || [];
const selectionMatrix = buildSelectionMatrix();

const state = {
  records: {
    query: "",
    chapter: "",
    country: "",
    release: "",
    availability: ""
  },
  policy: {
    query: "",
    lane: "",
    priority: ""
  },
  public: {
    query: "",
    lane: ""
  },
  selection: {
    query: "",
    recommendation: "",
    lane: "",
    priority: ""
  },
  boundary: {
    query: "",
    country: ""
  },
  gaps: {
    query: "",
    lane: "",
    priority: "",
    status: ""
  },
  sourcePools: {
    query: "",
    lane: "",
    priority: ""
  },
  countryDossiers: {
    query: "",
    lane: "",
    status: ""
  }
};

const nodes = {
  totalRecords: document.querySelector("#total-records"),
  totalPages: document.querySelector("#total-pages"),
  policyCount: document.querySelector("#policy-count"),
  publicCount: document.querySelector("#public-count"),
  boundaryCount: document.querySelector("#boundary-count"),
  compilerBriefRoot: document.querySelector("#compiler-brief-root"),
  sourceNotePacketRoot: document.querySelector("#source-note-packet-root"),
  researchRunbookRoot: document.querySelector("#research-runbook-root"),
  draftDocumentListRoot: document.querySelector("#draft-document-list-root"),
  documentReadinessRoot: document.querySelector("#document-readiness-root"),
  blockerResolutionRoot: document.querySelector("#blocker-resolution-root"),
  documentStubsRoot: document.querySelector("#document-stubs-root"),
  countryDossierRoot: document.querySelector("#country-dossier-root"),
  countryDossierSummary: document.querySelector("#country-dossier-summary"),
  countryDossierSearch: document.querySelector("#country-dossier-search"),
  countryDossierLaneFilter: document.querySelector("#country-dossier-lane-filter"),
  countryDossierStatusFilter: document.querySelector("#country-dossier-status-filter"),
  clearCountryDossierFilters: document.querySelector("#clear-country-dossier-filters"),
  exportCountryDossiers: document.querySelector("#export-country-dossiers"),
  decisionWorksheetsRoot: document.querySelector("#decision-worksheets-root"),
  workbenchRoot: document.querySelector("#workbench-root"),
  chapterGrid: document.querySelector("#chapter-grid"),
  recordsRoot: document.querySelector("#records-root"),
  recordsSummary: document.querySelector("#records-summary"),
  recordSearch: document.querySelector("#record-search"),
  chapterFilter: document.querySelector("#chapter-filter"),
  countryFilter: document.querySelector("#country-filter"),
  releaseFilter: document.querySelector("#release-filter"),
  availabilityFilter: document.querySelector("#availability-filter"),
  clearRecordFilters: document.querySelector("#clear-record-filters"),
  exportRecords: document.querySelector("#export-records"),
  policyRoot: document.querySelector("#policy-root"),
  policySummary: document.querySelector("#policy-summary"),
  policySearch: document.querySelector("#policy-search"),
  policyLaneFilter: document.querySelector("#policy-lane-filter"),
  policyPriorityFilter: document.querySelector("#policy-priority-filter"),
  clearPolicyFilters: document.querySelector("#clear-policy-filters"),
  exportPolicy: document.querySelector("#export-policy"),
  publicRoot: document.querySelector("#public-root"),
  publicSummary: document.querySelector("#public-summary"),
  publicSearch: document.querySelector("#public-search"),
  publicLaneFilter: document.querySelector("#public-lane-filter"),
  clearPublicFilters: document.querySelector("#clear-public-filters"),
  exportPublic: document.querySelector("#export-public"),
  selectionRoot: document.querySelector("#selection-root"),
  selectionDocket: document.querySelector("#selection-docket"),
  selectionSummary: document.querySelector("#selection-summary"),
  selectionSearch: document.querySelector("#selection-search"),
  selectionRecommendationFilter: document.querySelector("#selection-recommendation-filter"),
  selectionLaneFilter: document.querySelector("#selection-lane-filter"),
  selectionPriorityFilter: document.querySelector("#selection-priority-filter"),
  clearSelectionFilters: document.querySelector("#clear-selection-filters"),
  exportSelection: document.querySelector("#export-selection"),
  boundaryRoot: document.querySelector("#boundary-root"),
  boundarySummary: document.querySelector("#boundary-summary"),
  boundarySearch: document.querySelector("#boundary-search"),
  boundaryCountryFilter: document.querySelector("#boundary-country-filter"),
  clearBoundaryFilters: document.querySelector("#clear-boundary-filters"),
  gapRoot: document.querySelector("#gap-root"),
  gapSummary: document.querySelector("#gap-summary"),
  gapSearch: document.querySelector("#gap-search"),
  gapLaneFilter: document.querySelector("#gap-lane-filter"),
  gapPriorityFilter: document.querySelector("#gap-priority-filter"),
  gapStatusFilter: document.querySelector("#gap-status-filter"),
  clearGapFilters: document.querySelector("#clear-gap-filters"),
  exportGaps: document.querySelector("#export-gaps"),
  sourcePoolRoot: document.querySelector("#source-pool-root"),
  sourcePoolSummary: document.querySelector("#source-pool-summary"),
  sourcePoolSearch: document.querySelector("#source-pool-search"),
  sourcePoolLaneFilter: document.querySelector("#source-pool-lane-filter"),
  sourcePoolPriorityFilter: document.querySelector("#source-pool-priority-filter"),
  clearSourcePoolFilters: document.querySelector("#clear-source-pool-filters"),
  exportSourcePools: document.querySelector("#export-source-pools"),
  ledgerRoot: document.querySelector("#ledger-root"),
  ledgerSummary: document.querySelector("#ledger-summary")
};

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
    .sort((a, b) => a.country.localeCompare(b.country) || a.sortDate.localeCompare(b.sortDate))
    .map((item, index) => ({ ...item, compilerNumber: `B-${String(index + 1).padStart(3, "0")}` }));
}

function byChapterThenDate(a, b) {
  return (
    (a.chapter?.number || 99) - (b.chapter?.number || 99) ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function buildSelectionMatrix() {
  return [
    ...records.map((record) => selectionConversationEntry(record, false)),
    ...boundaryRecords.map((record) => selectionConversationEntry(record, true)),
    ...policyFiles.map(selectionPolicyEntry),
    ...publicReferences.map(selectionPublicEntry)
  ].sort(selectionSort);
}

function selectionConversationEntry(record, isBoundary) {
  const flags = [];
  if (record.diaryReferences?.length) flags.push("Diary/backup matched");
  if (/partial|restricted/i.test(record.releaseStatus || "")) flags.push("Partial/restricted release");
  if (/marker|no memorandum|no public pdf/i.test(record.releaseStatus || "") || !record.documentAvailable) flags.push("Source-copy lead");
  if (record.country === "Egypt") flags.push("Egypt cross-volume screen");
  if (isGulfCrisisEgypt(record)) flags.push("Persian Gulf crisis overlap");
  if (isBoundary) flags.push("Boundary row");

  const recommendation = selectionRecommendationForConversation(record, isBoundary);
  return compactSelection({
    id: `selection-${record.id || record.naid}`,
    sourceId: record.id || "",
    compilerNumber: record.compilerNumber || "",
    recordType: record.type || "Conversation",
    recommendation,
    priority: selectionPriorityForConversation(record, isBoundary, recommendation),
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
    basis: selectionBasisForConversation(record, isBoundary, recommendation),
    nextAction: selectionNextActionForConversation(record, isBoundary, recommendation),
    frusSourceNote: record.frusSourceNote || "",
    sourceNote: record.sourceNote || "",
    diaryReferences: record.diaryReferences || [],
    diaryCrossReferenceNote: record.diaryCrossReferenceNote || ""
  });
}

function selectionPolicyEntry(file) {
  const isBoundary = file.priority === "Boundary" || /Boundary/i.test(file.lane || "");
  const recommendation = isBoundary ? "Boundary handoff" : "Policy anchor candidate";
  return compactSelection({
    id: `selection-${file.id || file.naid}`,
    sourceId: file.id || "",
    recordType: "Policy file",
    recommendation,
    priority: isBoundary ? "Boundary" : file.priority || "High",
    lane: file.lane || "",
    date: file.date || "",
    sortDate: file.sortDate || file.date || "",
    dateText: file.dateText || file.date || "",
    title: file.title || "",
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

function selectionPublicEntry(item) {
  return compactSelection({
    id: `selection-${item.id}`,
    sourceId: item.id || "",
    recordType: item.documentType || "Public Papers reference",
    recommendation: "Public-line/context check",
    priority: "Context",
    lane: item.chapter || "",
    date: item.date || "",
    sortDate: item.sortDate || item.date || "",
    dateText: item.dateText || item.date || "",
    title: item.title || "",
    catalogUrl: item.govinfoUrl || "",
    pdfUrl: item.pdfUrl || "",
    flags: item.matchedTerms || [],
    basis: item.relevance || "Public Papers reference for public-line and chronology checks.",
    nextAction: "Use to verify public posture, public chronology, and whether a private source document needs to be paired with public remarks.",
    frusSourceNote: item.frusSourceNote || "",
    sourceNote: item.sourceNote || item.citation || ""
  });
}

function selectionRecommendationForConversation(record, isBoundary) {
  if (isBoundary) return "Boundary handoff";
  if (/marker|no memorandum/i.test(record.releaseStatus || "") || !record.documentAvailable) return "Source-copy search";
  if (/partial|restricted/i.test(record.releaseStatus || "")) return "Declassification review";
  if (isGulfCrisisEgypt(record) || record.country === "Egypt") return "Cross-volume review";
  return "Candidate core document";
}

function selectionPriorityForConversation(record, isBoundary, recommendation) {
  if (isBoundary) return "Boundary";
  if (recommendation === "Source-copy search") return "Critical";
  if (recommendation === "Declassification review") return "High";
  if (recommendation === "Cross-volume review") return isGulfCrisisEgypt(record) ? "Critical" : "High";
  return "High";
}

function selectionBasisForConversation(record, isBoundary, recommendation) {
  if (isBoundary) return record.boundaryReason || "Adjacent-volume boundary row retained for handoff control.";
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

function selectionNextActionForConversation(record, isBoundary, recommendation) {
  if (isBoundary) return "Confirm exclude, excerpt, cite-elsewhere, or adjacent-volume handoff decision.";
  if (recommendation === "Source-copy search") {
    return "Search Presidential Daily Diary/Backup, Scowcroft files, Presidential Daily File, and State files for duplicate source-copy evidence.";
  }
  if (recommendation === "Declassification review") return "Assess whether redactions block selection; queue MDR/referral or locate cleaner duplicate copies.";
  if (recommendation === "Cross-volume review") return "Tag primary volume ownership before selecting; retain only Africa-specific substance for Volume XX.";
  return "Read for substance, prepare selection/excerpt decision, and verify persons/source notes.";
}

function isGulfCrisisEgypt(record) {
  if (record.country !== "Egypt") return false;
  const date = record.sortDate || record.date || "";
  return date >= "1990-08-02" && date <= "1991-03-03";
}

function selectionSort(a, b) {
  return (
    selectionRecommendationRank(a.recommendation) - selectionRecommendationRank(b.recommendation) ||
    selectionPriorityRank(a.priority) - selectionPriorityRank(b.priority) ||
    (a.lane || "").localeCompare(b.lane || "") ||
    (a.sortDate || "").localeCompare(b.sortDate || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function selectionRecommendationRank(recommendation) {
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

function selectionPriorityRank(priority) {
  return ({ Critical: 1, High: 2, Medium: 3, Active: 4, Boundary: 5, Context: 6 }[priority] || 99);
}

function compactSelection(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return entry !== "" && entry !== null && entry !== undefined;
    })
  );
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function addOptions(select, values, label) {
  if (!select) return;
  select.replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value, value)));
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function searchText(item) {
  return [
    item.compilerNumber,
    item.title,
    item.documentTitle,
    item.country,
    item.chapter?.name,
    item.counterpart,
    item.naid,
    item.type,
    item.releaseStatus,
    item.frusSourceNote,
    item.sourceNote,
    item.diaryCrossReferenceNote,
    item.diaryReferences?.map((reference) => [reference.kind, reference.title, reference.naid, reference.sourceNote].join(" ")).join(" "),
    item.recordType,
    item.recommendation,
    item.basis,
    item.nextAction,
    item.flags?.join(" "),
    item.notes,
    item.lane,
    item.priority,
    item.reason,
    item.problem,
    item.evidence,
    item.needed,
    item.coverage,
    item.nextUse,
    item.status,
    item.citation,
    item.matchedTerms?.join(" "),
    item.nextActions?.join(" "),
    item.targetTerms?.join(" "),
    item.sourcePools?.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(item, query) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.length) return true;
  const haystack = searchText(item);
  return terms.every((term) => haystack.includes(term));
}

function setStats() {
  const pages = records.reduce((sum, record) => sum + (record.pageCount || 0), 0);
  nodes.totalRecords.textContent = records.length.toString();
  nodes.totalPages.textContent = pages.toString();
  nodes.policyCount.textContent = policyFiles.filter((file) => file.priority !== "Boundary").length.toString();
  nodes.publicCount.textContent = publicReferences.length.toString();
  nodes.boundaryCount.textContent = boundaryRecords.length.toString();
}

function renderWorkbench() {
  const pages = records.reduce((sum, record) => sum + (record.pageCount || 0), 0);
  const restricted = records.filter((record) => /partial|restricted|marker/i.test(record.releaseStatus || ""));
  const egypt = records.filter((record) => record.country === "Egypt");
  const nonBoundaryPolicy = policyFiles.filter((file) => file.priority !== "Boundary");
  const policyPages = nonBoundaryPolicy.reduce((sum, file) => sum + (file.pageCount || 0), 0);
  const criticalGaps = gapTracker.filter((gap) => gap.priority === "Critical");
  const sourceMix = topCounts(records, (record) => record.source?.series || "Catalog item")
    .slice(0, 3)
    .map(([label, count]) => `${count} ${label}`)
    .join("; ");

  nodes.workbenchRoot.replaceChildren(
    metricCard("Official rows", records.length, `${pages} PDF pages across Bush Library memcon/telcon rows.`),
    metricCard("Restriction markers", restricted.length, "Partial, restricted, or no-document rows for review."),
    metricCard("Egypt cross-checks", egypt.length, "Rows to compare against Arab-Israeli and Gulf crisis volumes."),
    metricCard("Policy file pages", policyPages, `${nonBoundaryPolicy.length} NSC/NSR/NSD anchors. ${sourceMix}`),
    metricCard("Open critical gaps", criticalGaps.length, `${gapTracker.length} total gap-tracker items now drive the next source harvest.`)
  );
}

function metricCard(label, value, detail) {
  const card = document.createElement("article");
  card.className = "metric-card";
  const strong = document.createElement("strong");
  strong.textContent = value.toString();
  const span = document.createElement("span");
  span.textContent = label;
  const paragraph = document.createElement("p");
  paragraph.textContent = detail;
  card.append(strong, span, paragraph);
  return card;
}

function renderChapters() {
  nodes.chapterGrid.replaceChildren(
    ...chapters.map((chapter) => {
      const chapterRecords = records.filter((record) => record.chapter?.name === chapter.name);
      const pages = chapterRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0);
      const card = document.createElement("a");
      card.className = "chapter-card";
      card.href = "#records";
      card.dataset.chapter = chapter.name;
      const number = document.createElement("p");
      number.className = "chapter-number";
      number.textContent = `Lane ${chapter.number}`;
      const title = document.createElement("h3");
      title.textContent = chapter.name;
      const count = document.createElement("p");
      count.className = "chapter-count";
      count.textContent = `${plural(chapterRecords.length, "row")} / ${plural(pages, "page")}`;
      const description = document.createElement("p");
      description.textContent = chapter.description;
      const action = document.createElement("span");
      action.className = "chapter-action";
      action.textContent = "Filter chronology";
      card.append(number, title, count, description, action);
      card.addEventListener("click", () => {
        state.records.chapter = chapter.name;
        nodes.chapterFilter.value = chapter.name;
        renderRecords();
      });
      return card;
    })
  );
}

function filteredGaps() {
  return gapTracker.filter((gap) => {
    if (!matchesQuery(gap, state.gaps.query)) return false;
    if (state.gaps.lane && gap.lane !== state.gaps.lane) return false;
    if (state.gaps.priority && gap.priority !== state.gaps.priority) return false;
    if (state.gaps.status && gap.status !== state.gaps.status) return false;
    return true;
  });
}

function renderGapTracker() {
  const priorityOrder = new Map([
    ["Critical", 1],
    ["High", 2],
    ["Medium", 3],
    ["Low", 4]
  ]);
  const visible = filteredGaps().sort(
    (a, b) =>
      (priorityOrder.get(a.priority) || 99) - (priorityOrder.get(b.priority) || 99) ||
      a.lane.localeCompare(b.lane) ||
      a.title.localeCompare(b.title)
  );
  nodes.gapSummary.textContent = `${plural(visible.length, "gap")} visible from ${gapTracker.length} compiler gap items.`;
  nodes.gapRoot.replaceChildren(...visible.map(gapCard));
  if (!visible.length) nodes.gapRoot.innerHTML = '<p class="empty">No gap-tracker items match the current filters.</p>';
}

function gapCard(gap) {
  const card = document.createElement("article");
  card.className = `gap-card priority-${gap.priority.toLowerCase()}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(gap.priority), textSpan(gap.status), textSpan(gap.lane));
  const title = document.createElement("h3");
  title.textContent = gap.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const evidence = document.createElement("p");
  evidence.className = "gap-evidence";
  evidence.textContent = gap.evidence;
  const problem = document.createElement("p");
  problem.textContent = gap.problem;
  const needed = document.createElement("p");
  needed.className = "source-note";
  needed.textContent = gap.needed;

  const actions = document.createElement("ol");
  actions.className = "action-list";
  for (const action of gap.nextActions || []) {
    const item = document.createElement("li");
    item.textContent = action;
    actions.append(item);
  }

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const term of (gap.targetTerms || []).slice(0, 8)) chips.append(chip(term, gap.priority === "Critical" ? "warn" : ""));

  const pools = document.createElement("p");
  pools.className = "source-note";
  pools.textContent = `Source pools: ${(gap.sourcePools || []).join("; ")}`;

  card.append(header, evidence, problem, needed, actions, chips, pools);
  return card;
}

function filteredSourcePools() {
  return sourcePools.filter((pool) => {
    if (!matchesQuery(pool, state.sourcePools.query)) return false;
    if (state.sourcePools.lane && pool.lane !== state.sourcePools.lane) return false;
    if (state.sourcePools.priority && pool.priority !== state.sourcePools.priority) return false;
    return true;
  });
}

function renderSourcePools() {
  const priorityOrder = new Map([
    ["Active", 1],
    ["Next", 2],
    ["Missing", 3],
    ["Later", 4]
  ]);
  const visible = filteredSourcePools().sort(
    (a, b) =>
      (priorityOrder.get(a.priority) || 99) - (priorityOrder.get(b.priority) || 99) ||
      a.lane.localeCompare(b.lane) ||
      a.title.localeCompare(b.title)
  );
  nodes.sourcePoolSummary.textContent = `${plural(visible.length, "source pool")} visible from ${sourcePools.length} harvest lanes.`;
  nodes.sourcePoolRoot.replaceChildren(...visible.map(sourcePoolCard));
  if (!visible.length) nodes.sourcePoolRoot.innerHTML = '<p class="empty">No source pools match the current filters.</p>';
}

function renderSourceCopyLedger() {
  const markerCount = sourceCopyLedger.filter((item) => item.issueType === "Marker / no memorandum").length;
  const partialCount = sourceCopyLedger.length - markerCount;
  nodes.ledgerSummary.textContent = `${plural(sourceCopyLedger.length, "row")} in the source-copy ledger: ${plural(markerCount, "marker")} and ${plural(partialCount, "partial/restricted row")}.`;
  nodes.ledgerRoot.replaceChildren(...sourceCopyLedger.map(ledgerCard));
  if (!sourceCopyLedger.length) nodes.ledgerRoot.innerHTML = '<p class="empty">No source-copy ledger rows were generated.</p>';
}

function ledgerCard(item) {
  const card = document.createElement("article");
  card.className = `record-card ledger-card ${item.issueType === "Marker / no memorandum" ? "marker-ledger" : "partial-ledger"}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "record-id";
  meta.append(textSpan(item.issueType), textSpan(item.dateText || item.date), textSpan(item.country), textSpan(item.lane));
  const title = document.createElement("h4");
  title.textContent = item.title;
  titleBlock.append(meta, title);

  const chips = document.createElement("div");
  chips.className = "chips";
  chips.append(
    chip(item.priority, item.issueType === "Marker / no memorandum" ? "warn" : "boundary"),
    chip(`NAID ${item.naid}`),
    chip(item.releaseStatus, "warn")
  );
  header.append(titleBlock, chips);

  const participants = document.createElement("p");
  participants.textContent = (item.participants || []).join(" / ");

  const action = document.createElement("p");
  action.className = "source-note";
  action.textContent = item.action;

  const actions = document.createElement("div");
  actions.className = "record-actions";
  if (item.catalogUrl) actions.append(linkButton("Catalog", item.catalogUrl));
  if (item.pdfUrl) actions.append(linkButton("PDF", item.pdfUrl));
  if (preferredSourceNote(item)) actions.append(copyButton(preferredSourceNote(item)));

  card.append(header, participants, action, actions);
  const details = sourceNoteDetails(item);
  if (details) card.append(details);
  const diaryDetails = diaryReferenceDetails(item);
  if (diaryDetails) card.append(diaryDetails);
  return card;
}

function sourcePoolCard(pool) {
  const card = document.createElement("article");
  card.className = `file-card source-pool-card priority-${pool.priority.toLowerCase()}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(pool.priority), textSpan(pool.lane));
  const title = document.createElement("h3");
  title.textContent = pool.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const coverage = document.createElement("p");
  coverage.textContent = pool.coverage;
  const nextUse = document.createElement("p");
  nextUse.className = "source-note";
  nextUse.textContent = pool.nextUse;
  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (pool.url) actions.append(linkButton("Open source", pool.url));
  card.append(header, chip(pool.priority, pool.priority === "Missing" ? "warn" : "good"), coverage, nextUse, actions);
  return card;
}

function filteredSelectionMatrix() {
  return selectionMatrix.filter((item) => {
    if (!matchesQuery(item, state.selection.query)) return false;
    if (state.selection.recommendation && item.recommendation !== state.selection.recommendation) return false;
    if (state.selection.lane && item.lane !== state.selection.lane) return false;
    if (state.selection.priority && item.priority !== state.selection.priority) return false;
    return true;
  });
}

function renderSelectionMatrix() {
  const visible = filteredSelectionMatrix();
  nodes.selectionSummary.textContent = `${plural(visible.length, "row")} visible from ${selectionMatrix.length} compiler selection decisions.`;
  nodes.selectionRoot.replaceChildren(...visible.map(selectionCard));
  if (!visible.length) nodes.selectionRoot.innerHTML = '<p class="empty">No selection matrix rows match the current filters.</p>';
}

function renderSelectionDocket() {
  const docketItems = [
    {
      label: "Core candidates",
      recommendation: "Candidate core document",
      detail: "Read first for likely Volume XX document selection."
    },
    {
      label: "Source-copy searches",
      recommendation: "Source-copy search",
      detail: "Find duplicate source copies or confirm no memorandum exists."
    },
    {
      label: "Declassification reviews",
      recommendation: "Declassification review",
      detail: "Check redactions, withdrawal sheets, MDR/referral paths."
    },
    {
      label: "Cross-volume screens",
      recommendation: "Cross-volume review",
      detail: "Resolve Egypt, Gulf, Arab-Israeli, and terrorism ownership."
    },
    {
      label: "Boundary handoffs",
      recommendation: "Boundary handoff",
      detail: "Confirm cite-elsewhere, exclude, excerpt, or adjacent-volume handling."
    }
  ];
  nodes.selectionDocket.replaceChildren(...docketItems.map(selectionDocketCard));
}

function renderCompilerBrief() {
  if (!nodes.compilerBriefRoot) return;
  if (!compilerBrief) {
    nodes.compilerBriefRoot.innerHTML = '<p class="empty">Compiler brief data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "compiler-brief-summary";
  summary.append(
    compilerBriefSummaryItem("Selection rows", compilerBrief.summary?.selectionRows),
    compilerBriefSummaryItem("Source notes", compilerBrief.summary?.sourceNoteRows),
    compilerBriefSummaryItem("Diary matches", compilerBrief.summary?.diaryMatchedRows),
    compilerBriefSummaryItem("Critical gaps", compilerBrief.summary?.criticalGaps)
  );

  const actions = document.createElement("div");
  actions.className = "compiler-brief-actions";
  actions.append(...(compilerBrief.startHere || []).map(compilerBriefActionCard));

  const queues = document.createElement("div");
  queues.className = "compiler-queue-grid";
  queues.append(...(compilerBrief.queues || []).map(compilerQueueCard));

  nodes.compilerBriefRoot.replaceChildren(summary, actions, queues);
}

function compilerBriefSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? 0);
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function compilerBriefActionCard(item) {
  const card = document.createElement(item.targetRecommendation ? "button" : "a");
  card.className = "metric-card compiler-action-card";
  if (item.targetRecommendation) {
    card.type = "button";
    card.addEventListener("click", () => openSelectionRecommendation(item.targetRecommendation));
  } else {
    card.href = item.targetHref || "#compiler-brief";
  }

  const strong = document.createElement("strong");
  strong.textContent = item.metric || "0";
  const label = document.createElement("span");
  label.textContent = item.label || "";
  const title = document.createElement("h3");
  title.textContent = item.title || "";
  const body = document.createElement("p");
  body.textContent = item.body || "";
  const action = document.createElement("b");
  action.textContent = item.actionLabel || "Open";
  card.append(strong, label, title, body, action);
  return card;
}

function compilerQueueCard(queue) {
  const card = document.createElement("article");
  card.className = "file-card compiler-queue-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(queue.recommendation), textSpan(`${queue.count} rows`));
  const title = document.createElement("h3");
  title.textContent = queue.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const description = document.createElement("p");
  description.textContent = queue.description;

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of (queue.rows || []).slice(0, 3)) list.append(compilerQueueRow(row));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Open queue";
  button.addEventListener("click", () => openSelectionRecommendation(queue.recommendation));
  actions.append(button);

  card.append(header, description, list, actions);
  return card;
}

function compilerQueueRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.dateText || row.date || "Undated"} - ${row.title}`;
  const nextAction = document.createElement("p");
  nextAction.textContent = row.nextAction || "";
  item.append(title, nextAction);
  const details = sourceNoteDetails(row);
  if (details) item.append(details);
  return item;
}

function openSelectionRecommendation(recommendation) {
  state.selection = { query: "", recommendation, lane: "", priority: "" };
  nodes.selectionSearch.value = "";
  nodes.selectionRecommendationFilter.value = recommendation;
  nodes.selectionLaneFilter.value = "";
  nodes.selectionPriorityFilter.value = "";
  renderSelectionMatrix();
  document.querySelector("#selection-matrix")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSourceNotePacket() {
  if (!nodes.sourceNotePacketRoot) return;
  if (!sourceNotePacket) {
    nodes.sourceNotePacketRoot.innerHTML = '<p class="empty">Source note packet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "source-note-packet-summary";
  summary.append(
    sourceNotePacketSummaryItem("source rows", sourceNotePacket.summary?.sourceRows),
    sourceNotePacketSummaryItem("FRUS notes", sourceNotePacket.summary?.frusSourceNoteRows),
    sourceNotePacketSummaryItem("diary matches", sourceNotePacket.summary?.diaryMatchedRows),
    sourceNotePacketSummaryItem("source-copy rows", sourceNotePacket.summary?.sourceCopySearchRows),
    sourceNotePacketSummaryItem("declass rows", sourceNotePacket.summary?.declassificationReviewRows)
  );

  const packetActions = document.createElement("div");
  packetActions.className = "file-actions packet-actions";
  packetActions.append(
    linkButton("Open Markdown packet", "reports/source-note-packet.md"),
    copyTextButton("Copy all FRUS notes", (sourceNotePacket.groups || []).map((group) => group.sourceNoteText || "").filter(Boolean).join("\n\n"))
  );

  const groups = document.createElement("div");
  groups.className = "source-note-group-grid";
  groups.append(...(sourceNotePacket.groups || []).map(sourceNoteGroupCard));

  nodes.sourceNotePacketRoot.replaceChildren(summary, packetActions, groups);
}

function sourceNotePacketSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? 0);
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function sourceNoteGroupCard(group) {
  const card = document.createElement("article");
  card.className = "file-card source-note-group-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(group.recommendation), textSpan(`${group.count} notes`));
  const title = document.createElement("h3");
  title.textContent = group.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const description = document.createElement("p");
  description.textContent = group.description;

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of (group.rows || []).slice(0, 3)) list.append(sourceNotePacketRow(row));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(
    copyTextButton("Copy queue notes", group.sourceNoteText || ""),
    queueButton("Open queue", group.recommendation)
  );

  card.append(header, description, list, actions);
  return card;
}

function sourceNotePacketRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.compilerNumber || "n/a"} - ${row.dateText || row.date || "Undated"} - ${row.title}`;
  const note = document.createElement("p");
  note.textContent = row.frusSourceNote || row.sourceNote || "";
  item.append(title, note);
  if (row.diaryReferences?.length) {
    const diary = document.createElement("p");
    diary.className = "source-note-packet-diary";
    diary.textContent = `Diary/backup: ${row.diaryReferences.map((reference) => `${reference.kind} NAID ${reference.naid}`).join("; ")}`;
    item.append(diary);
  }
  return item;
}

function queueButton(label, recommendation) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => openSelectionRecommendation(recommendation));
  return button;
}

function filteredCountryDossiers() {
  const dossiers = countryDossiers?.dossiers || [];
  return dossiers.filter((dossier) => {
    if (!matchesQuery(dossier, state.countryDossiers.query)) return false;
    if (state.countryDossiers.lane && !(dossier.lanes || []).includes(state.countryDossiers.lane)) return false;
    if (state.countryDossiers.status && dossier.coverageStatus !== state.countryDossiers.status) return false;
    return true;
  });
}

function renderCountryDossiers() {
  if (!nodes.countryDossierRoot) return;
  if (!countryDossiers) {
    nodes.countryDossierRoot.innerHTML = '<p class="empty">Country dossier data is unavailable.</p>';
    return;
  }

  const visible = filteredCountryDossiers();
  nodes.countryDossierSummary.textContent = `${plural(visible.length, "country dossier")} visible from ${countryDossiers.summary?.dossierCount || 0} Volume XX country desks.`;
  nodes.countryDossierRoot.replaceChildren(...visible.map(countryDossierCard));
  if (!visible.length) nodes.countryDossierRoot.innerHTML = '<p class="empty">No country dossiers match the current filters.</p>';
}

function countryDossierCard(dossier) {
  const card = document.createElement("article");
  card.className = `file-card country-dossier-card status-${slug(dossier.coverageStatus)}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(dossier.coverageStatus), textSpan((dossier.lanes || []).join("; ")));
  const title = document.createElement("h3");
  title.textContent = dossier.country;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  chips.append(
    chip(`${dossier.chronologyRows || 0} chronology rows`, dossier.chronologyRows ? "good" : "warn"),
    chip(`${dossier.conversationPages || 0} pages`),
    chip(`${dossier.runbookQueryCount || 0} queries`, dossier.runbookQueryCount ? "" : "warn")
  );
  if (dossier.sourceCopyRows) chips.append(chip(`${dossier.sourceCopyRows} source-copy rows`, "warn"));
  if (dossier.gapCount) chips.append(chip(`${dossier.gapCount} direct gaps`, dossier.coverageStatus === "Chronology active" ? "" : "warn"));
  if (dossier.publicReferenceCount) chips.append(chip(`${dossier.publicReferenceCount} public refs`));
  if (dossier.policyFileCount) chips.append(chip(`${dossier.policyFileCount} policy files`));

  const note = document.createElement("p");
  note.textContent = dossier.coverageNote || "";

  const actionsList = document.createElement("ol");
  actionsList.className = "action-list";
  for (const action of (dossier.nextActions || []).slice(0, 4)) {
    const item = document.createElement("li");
    item.textContent = action;
    actionsList.append(item);
  }

  const previewGrid = document.createElement("div");
  previewGrid.className = "country-dossier-preview-grid";
  previewGrid.append(
    countryDossierPreviewList("Chronology", dossier.chronologyPreview || [], countryChronologyPreviewRow),
    countryDossierPreviewList("Runbook Queries", dossier.queryRows || [], countryQueryPreviewRow)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (dossier.chronologyRows) actions.append(countryChronologyButton(dossier.country));
  if (dossier.queryRows?.[0]?.sourcePoolSearchUrl) actions.append(linkButton("Open first query", dossier.queryRows[0].sourcePoolSearchUrl));
  actions.append(linkButton("Dossier CSV", "reports/country-dossiers/country-dossiers.csv"));

  card.append(header, chips, note, actionsList, previewGrid, actions);
  return card;
}

function countryDossierPreviewList(title, rows, rowRenderer) {
  const section = document.createElement("section");
  section.className = "country-dossier-preview";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of rows.slice(0, 3)) list.append(rowRenderer(row));
  if (!rows.length) {
    const item = document.createElement("li");
    const empty = document.createElement("p");
    empty.textContent = "No rows yet.";
    item.append(empty);
    list.append(item);
  }
  section.append(heading, list);
  return section;
}

function countryChronologyPreviewRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.dateText || row.date || "Undated"} - ${row.title}`;
  const detail = document.createElement("p");
  detail.textContent = [row.releaseStatus, row.pageCount ? `${row.pageCount} pages` : "", row.diaryReferenceCount ? "diary/backup matched" : ""]
    .filter(Boolean)
    .join(" / ");
  item.append(title, detail);
  return item;
}

function countryQueryPreviewRow(row) {
  const item = document.createElement("li");
  const title = document.createElement("a");
  title.href = row.sourcePoolSearchUrl || row.catalogSearchUrl || "#country-dossiers";
  title.target = "_blank";
  title.rel = "noreferrer";
  title.className = "compiler-row-title";
  title.textContent = `${row.sourcePoolTitle}: ${row.queryLabel}`;
  const detail = document.createElement("p");
  detail.textContent = row.queryTerms || "";
  item.append(title, detail);
  return item;
}

function countryChronologyButton(country) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Filter chronology";
  button.addEventListener("click", () => {
    state.records = { query: "", chapter: "", country, release: "", availability: "" };
    nodes.recordSearch.value = "";
    nodes.chapterFilter.value = "";
    nodes.countryFilter.value = country;
    nodes.releaseFilter.value = "";
    nodes.availabilityFilter.value = "";
    renderRecords();
    document.querySelector("#records")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return button;
}

function renderDraftDocumentList() {
  if (!nodes.draftDocumentListRoot) return;
  if (!draftDocumentList) {
    nodes.draftDocumentListRoot.innerHTML = '<p class="empty">Draft document list data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "draft-document-summary";
  summary.append(
    draftDocumentSummaryItem("proposed", draftDocumentList.summary?.proposedCount),
    draftDocumentSummaryItem("conditional", draftDocumentList.summary?.conditionalCount),
    draftDocumentSummaryItem("source notes", draftDocumentList.summary?.sourceNoteCount),
    draftDocumentSummaryItem("source-copy", draftDocumentList.summary?.sourceCopyBlockers),
    draftDocumentSummaryItem("cross-volume", draftDocumentList.summary?.crossVolumeScreens)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open draft list", "reports/draft-document-list.md"),
    linkButton("Proposed CSV", "reports/draft-document-list/proposed-documents.csv"),
    linkButton("Conditional CSV", "reports/draft-document-list/conditional-documents.csv"),
    linkButton("Chapter gaps CSV", "reports/draft-document-list/chapter-gaps.csv")
  );

  const proposed = document.createElement("div");
  proposed.className = "draft-document-proposed";
  const proposedTitle = document.createElement("h3");
  proposedTitle.textContent = "First Proposed Documents";
  const proposedList = document.createElement("ul");
  proposedList.className = "compiler-row-list";
  for (const row of (draftDocumentList.proposedRows || []).slice(0, 6)) proposedList.append(draftDocumentRow(row));
  proposed.append(proposedTitle, proposedList);

  const chapters = document.createElement("div");
  chapters.className = "draft-chapter-grid";
  chapters.append(...(draftDocumentList.chapterGroups || []).map(draftChapterCard));

  nodes.draftDocumentListRoot.replaceChildren(summary, actions, proposed, chapters);
}

function draftDocumentSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? 0);
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function draftChapterCard(group) {
  const card = document.createElement("article");
  card.className = "file-card draft-chapter-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(`${group.proposedCount} proposed`), textSpan(`${group.conditionalCount} conditional`));
  const title = document.createElement("h3");
  title.textContent = group.lane;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  if (group.sourceCopyBlockers) chips.append(chip(`${group.sourceCopyBlockers} source-copy`, "warn"));
  if (group.declassificationBlockers) chips.append(chip(`${group.declassificationBlockers} declass`, "warn"));
  if (group.crossVolumeScreens) chips.append(chip(`${group.crossVolumeScreens} cross-volume`, "warn"));
  if (group.missingCountries?.length) chips.append(chip(`${group.missingCountries.length} country gaps`, "warn"));

  const proposedList = document.createElement("ul");
  proposedList.className = "compiler-row-list";
  for (const row of (group.proposedRows || []).slice(0, 3)) proposedList.append(draftDocumentRow(row));
  if (!group.proposedRows?.length) proposedList.append(emptyListItem("No proposed rows yet."));

  const conditionalList = document.createElement("ul");
  conditionalList.className = "compiler-row-list";
  for (const row of (group.conditionalRows || []).slice(0, 3)) conditionalList.append(draftDocumentRow(row));
  if (!group.conditionalRows?.length) conditionalList.append(emptyListItem("No conditional rows in this lane."));

  const laneGrid = document.createElement("div");
  laneGrid.className = "country-dossier-preview-grid";
  laneGrid.append(draftMiniSection("Proposed", proposedList), draftMiniSection("Conditional", conditionalList));

  const gaps = document.createElement("ul");
  gaps.className = "compact-list";
  for (const gap of (group.openGaps || []).slice(0, 3)) {
    const item = document.createElement("li");
    item.textContent = `${gap.priority}: ${gap.title}`;
    gaps.append(item);
  }

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(queueButton("Open core queue", "Candidate core document"));
  if (group.conditionalRows?.length) actions.append(queueButton("Open conditional queue", group.conditionalRows[0].recommendation));

  card.append(header, chips, laneGrid);
  if (gaps.children.length) card.append(gaps);
  card.append(actions);
  return card;
}

function draftMiniSection(title, list) {
  const section = document.createElement("section");
  section.className = "country-dossier-preview";
  const heading = document.createElement("h4");
  heading.textContent = title;
  section.append(heading, list);
  return section;
}

function emptyListItem(text) {
  const item = document.createElement("li");
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  item.append(paragraph);
  return item;
}

function draftDocumentRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`;
  const detail = document.createElement("p");
  detail.textContent = [row.editorialStatus, row.country || row.lane, row.releaseStatus].filter(Boolean).join(" / ");
  item.append(title, detail);
  if (row.frusSourceNote) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "FRUS source note";
    const note = document.createElement("p");
    note.className = "source-note";
    note.textContent = row.frusSourceNote;
    details.append(summary, note);
    item.append(details);
  }
  return item;
}

function renderDocumentReadiness() {
  if (!nodes.documentReadinessRoot) return;
  if (!documentReadinessPacket) {
    nodes.documentReadinessRoot.innerHTML = '<p class="empty">Document readiness packet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "document-readiness-summary";
  summary.append(
    documentReadinessSummaryItem("draft rows", documentReadinessPacket.summary?.documentCount),
    documentReadinessSummaryItem("ready now", documentReadinessPacket.summary?.readyForReadCount),
    documentReadinessSummaryItem("authority check", documentReadinessPacket.summary?.readyWithAuthorityCheckCount),
    documentReadinessSummaryItem("blocked", documentReadinessPacket.summary?.blockerCount),
    documentReadinessSummaryItem("diary matched", documentReadinessPacket.summary?.diaryMatchedCount)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open readiness packet", "reports/document-readiness-packet.md"),
    linkButton("All rows CSV", "reports/document-readiness/document-readiness.csv"),
    linkButton("Ready CSV", "reports/document-readiness/ready-first-pass.csv"),
    linkButton("Blockers CSV", "reports/document-readiness/blockers.csv"),
    linkButton("Authority CSV", "reports/document-readiness/authority-checks.csv")
  );

  const queue = document.createElement("div");
  queue.className = "document-readiness-board";
  queue.append(
    readinessQueueCard("Ready for First-Pass Read", documentReadinessPacket.readyRows || [], "ready"),
    readinessQueueCard("Ready with Authority Check", documentReadinessPacket.authorityRows || [], "authority"),
    readinessQueueCard("Blocked / Conditional", documentReadinessPacket.blockerRows || [], "blocked")
  );

  const chapters = document.createElement("div");
  chapters.className = "document-readiness-chapter-grid";
  chapters.append(...(documentReadinessPacket.chapterGroups || []).map(readinessChapterCard));

  nodes.documentReadinessRoot.replaceChildren(summary, actions, queue, chapters);
}

function documentReadinessSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = Number(value || 0).toLocaleString();
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function readinessQueueCard(title, rows, tone) {
  const card = document.createElement("article");
  card.className = `file-card document-readiness-card tone-${tone}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(`${rows.length} rows`));
  const heading = document.createElement("h3");
  heading.textContent = title;
  titleBlock.append(meta, heading);
  header.append(titleBlock);

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of rows.slice(0, 6)) list.append(readinessDocumentRow(row));
  if (!rows.length) list.append(emptyListItem("No rows in this queue."));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (tone === "ready") actions.append(linkButton("Download queue", "reports/document-readiness/ready-first-pass.csv"));
  if (tone === "authority") actions.append(linkButton("Download queue", "reports/document-readiness/authority-checks.csv"));
  if (tone === "blocked") actions.append(linkButton("Download queue", "reports/document-readiness/blockers.csv"));

  card.append(header, list, actions);
  return card;
}

function readinessChapterCard(group) {
  const card = document.createElement("article");
  card.className = "file-card document-readiness-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(`${group.readyForReadCount} ready`), textSpan(`${group.readyWithAuthorityCheckCount} authority`), textSpan(`${group.blockerCount} blocked`));
  const title = document.createElement("h3");
  title.textContent = group.lane;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  if (group.sourceCopyCount) chips.append(chip(`${group.sourceCopyCount} source-copy`, "warn"));
  if (group.declassificationCount) chips.append(chip(`${group.declassificationCount} declass`, "warn"));
  if (group.crossVolumeCount) chips.append(chip(`${group.crossVolumeCount} cross-volume`, "warn"));
  if (!chips.children.length) chips.append(chip("no blockers", "good"));

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of (group.rows || []).slice(0, 4)) list.append(readinessDocumentRow(row));

  card.append(header, chips, list);
  return card;
}

function readinessDocumentRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`;
  const detail = document.createElement("p");
  detail.textContent = [row.readinessStatus, row.country || row.lane, row.releaseStatus].filter(Boolean).join(" / ");
  item.append(title, detail);

  if (row.blockers?.length || row.authorityReviewEntries?.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const blocker of row.blockers || []) chips.append(chip(blocker, "warn"));
    for (const authority of (row.authorityReviewEntries || []).slice(0, 2)) chips.append(chip(authority, "boundary"));
    item.append(chips);
  }

  const action = document.createElement("p");
  action.className = "source-note";
  action.textContent = row.nextAction || row.decisionNeeded || "";
  item.append(action);

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (row.pdfUrl) actions.append(linkButton("PDF", row.pdfUrl));
  if (row.frusSourceNote) actions.append(copyTextButton("Copy note", row.frusSourceNote));
  item.append(actions);

  const sourceDetails = sourceNoteDetails(row);
  if (sourceDetails) item.append(sourceDetails);
  const diaryDetails = diaryReferenceDetails(row);
  if (diaryDetails) item.append(diaryDetails);

  return item;
}

function renderBlockerResolution() {
  if (!nodes.blockerResolutionRoot) return;
  if (!blockerResolutionPacket) {
    nodes.blockerResolutionRoot.innerHTML = '<p class="empty">Blocker resolution packet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "blocker-resolution-summary";
  summary.append(
    blockerResolutionSummaryItem("blockers", blockerResolutionPacket.summary?.blockerCount),
    blockerResolutionSummaryItem("source-copy", blockerResolutionPacket.summary?.sourceCopyCount),
    blockerResolutionSummaryItem("declass", blockerResolutionPacket.summary?.declassificationCount),
    blockerResolutionSummaryItem("cross-volume", blockerResolutionPacket.summary?.crossVolumeCount),
    blockerResolutionSummaryItem("query linked", blockerResolutionPacket.summary?.queryLinkedCount)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open blocker packet", "reports/blocker-resolution-packet.md"),
    linkButton("All blockers CSV", "reports/blocker-resolution/all-blockers.csv"),
    linkButton("Source-copy CSV", "reports/blocker-resolution/source-copy-actions.csv"),
    linkButton("Declass CSV", "reports/blocker-resolution/declassification-actions.csv"),
    linkButton("Cross-volume CSV", "reports/blocker-resolution/cross-volume-actions.csv")
  );

  const board = document.createElement("div");
  board.className = "blocker-resolution-board";
  board.append(
    blockerQueueCard("Source-Copy Searches", blockerResolutionPacket.sourceCopyRows || [], "source-copy", "reports/blocker-resolution/source-copy-actions.csv"),
    blockerQueueCard("Declassification Reviews", blockerResolutionPacket.declassificationRows || [], "declass", "reports/blocker-resolution/declassification-actions.csv"),
    blockerQueueCard("Cross-Volume Ownership", blockerResolutionPacket.crossVolumeRows || [], "cross-volume", "reports/blocker-resolution/cross-volume-actions.csv")
  );

  const comparators = document.createElement("article");
  comparators.className = "file-card blocker-comparator-card";
  const comparatorHeader = document.createElement("header");
  const comparatorTitle = document.createElement("h3");
  comparatorTitle.textContent = "Cross-Volume Comparators";
  comparatorHeader.append(comparatorTitle);
  const comparatorList = document.createElement("ul");
  comparatorList.className = "compact-list";
  for (const volume of blockerResolutionPacket.comparatorVolumes || []) {
    const item = document.createElement("li");
    const link = linkButton(volume.title, volume.url);
    const use = document.createElement("span");
    use.textContent = ` ${volume.use}`;
    item.append(link, use);
    comparatorList.append(item);
  }
  comparators.append(comparatorHeader, comparatorList);

  nodes.blockerResolutionRoot.replaceChildren(summary, actions, board, comparators);
}

function blockerResolutionSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = Number(value || 0).toLocaleString();
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function blockerQueueCard(title, rows, tone, csvPath) {
  const card = document.createElement("article");
  card.className = `file-card blocker-resolution-card tone-${tone}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(`${rows.length} rows`));
  const heading = document.createElement("h3");
  heading.textContent = title;
  titleBlock.append(meta, heading);
  header.append(titleBlock);

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of rows.slice(0, 5)) list.append(blockerResolutionRow(row));
  if (!rows.length) list.append(emptyListItem("No blockers in this queue."));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(linkButton("Download queue", csvPath));

  card.append(header, list, actions);
  return card;
}

function blockerResolutionRow(row) {
  const item = document.createElement("li");
  const title = row.catalogUrl ? document.createElement("a") : document.createElement("span");
  if (row.catalogUrl) {
    title.href = row.catalogUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  title.className = "compiler-row-title";
  title.textContent = `${row.draftNumber} - ${row.dateText || row.date || "Undated"} - ${row.title}`;
  const detail = document.createElement("p");
  detail.textContent = [row.resolutionType, row.country || row.lane, row.releaseStatus].filter(Boolean).join(" / ");
  item.append(title, detail);

  const action = document.createElement("p");
  action.className = "source-note";
  action.textContent = row.nextAction || row.handoffNote || "";
  item.append(action);

  const steps = document.createElement("details");
  const stepsSummary = document.createElement("summary");
  stepsSummary.textContent = "Resolution steps";
  const stepList = document.createElement("ol");
  stepList.className = "compact-list";
  for (const step of row.actionSteps || []) {
    const stepItem = document.createElement("li");
    stepItem.textContent = step;
    stepList.append(stepItem);
  }
  steps.append(stepsSummary, stepList);
  item.append(steps);

  if (row.comparatorVolumes?.length) {
    const comparatorList = document.createElement("ul");
    comparatorList.className = "compact-list";
    for (const volume of row.comparatorVolumes) {
      const comparator = document.createElement("li");
      comparator.append(linkButton(volume.title, volume.url));
      comparatorList.append(comparator);
    }
    item.append(comparatorList);
  }

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (row.pdfUrl) actions.append(linkButton("PDF", row.pdfUrl));
  if (row.catalogSearchUrl) actions.append(linkButton("Search", row.catalogSearchUrl));
  if (row.frusSourceNote) actions.append(copyTextButton("Copy note", row.frusSourceNote));
  actions.append(copyTextButton("Copy handoff", blockerHandoffText(row)));
  item.append(actions);

  const sourceDetails = sourceNoteDetails({ ...row, sourceNote: row.catalogProvenance });
  if (sourceDetails) item.append(sourceDetails);
  const diaryDetails = diaryReferenceDetails(row);
  if (diaryDetails) item.append(diaryDetails);

  return item;
}

function blockerHandoffText(row) {
  return [
    `${row.draftNumber} - ${row.title}`,
    `Resolution type: ${row.resolutionType}`,
    `Recommended field: ${row.recommendedDecisionField}`,
    `Next action: ${row.nextAction}`,
    `Search terms: ${row.searchTerms}`,
    `Catalog: ${row.catalogUrl}`,
    `PDF: ${row.pdfUrl}`,
    `Source note: ${row.frusSourceNote}`
  ]
    .filter(Boolean)
    .join("\n");
}

function renderDocumentStubs() {
  if (!nodes.documentStubsRoot) return;
  if (!documentStubsPacket) {
    nodes.documentStubsRoot.innerHTML = '<p class="empty">Document stubs packet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "document-stubs-summary";
  summary.append(
    documentStubsSummaryItem("stubs", documentStubsPacket.summary?.stubCount),
    documentStubsSummaryItem("ready", documentStubsPacket.summary?.readyStubCount),
    documentStubsSummaryItem("authority", documentStubsPacket.summary?.authorityStubCount),
    documentStubsSummaryItem("blockers", documentStubsPacket.summary?.blockerStubCount),
    documentStubsSummaryItem("source notes", documentStubsPacket.summary?.sourceNoteStubCount)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open stubs packet", "reports/document-stubs-packet.md"),
    linkButton("Stub index CSV", "reports/document-stubs/document-stub-index.csv"),
    linkButton("First ready stub", documentStubsPacket.readyRows?.[0]?.stubPath || "reports/document-stubs-packet.md"),
    linkButton("First blocker stub", documentStubsPacket.blockerRows?.[0]?.stubPath || "reports/document-stubs-packet.md")
  );

  const board = document.createElement("div");
  board.className = "document-stubs-board";
  board.append(
    documentStubQueueCard("Ready Stubs", documentStubsPacket.readyRows || [], "ready"),
    documentStubQueueCard("Authority-Check Stubs", documentStubsPacket.authorityRows || [], "authority"),
    documentStubQueueCard("Blocker Stubs", documentStubsPacket.blockerRows || [], "blocked")
  );

  nodes.documentStubsRoot.replaceChildren(summary, actions, board);
}

function documentStubsSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = Number(value || 0).toLocaleString();
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function documentStubQueueCard(title, rows, tone) {
  const card = document.createElement("article");
  card.className = `file-card document-stubs-card tone-${tone}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(`${rows.length} files`));
  const heading = document.createElement("h3");
  heading.textContent = title;
  titleBlock.append(meta, heading);
  header.append(titleBlock);

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of rows.slice(0, 8)) list.append(documentStubRow(row));
  if (!rows.length) list.append(emptyListItem("No stubs in this queue."));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(linkButton("Index CSV", "reports/document-stubs/document-stub-index.csv"));

  card.append(header, list, actions);
  return card;
}

function documentStubRow(row) {
  const item = document.createElement("li");
  const title = linkButton(`${row.draftNumber} - ${row.title}`, row.stubPath);
  title.className = "compiler-row-title";
  const detail = document.createElement("p");
  detail.textContent = [row.stubStatus, row.country || row.lane, row.readinessStatus].filter(Boolean).join(" / ");
  item.append(title, detail);
  if (row.authorityReviewCount || row.resolutionType) {
    const chips = document.createElement("div");
    chips.className = "chips";
    if (row.authorityReviewCount) chips.append(chip(`${row.authorityReviewCount} authority`, "boundary"));
    if (row.resolutionType) chips.append(chip(row.resolutionType, "warn"));
    item.append(chips);
  }
  return item;
}

function renderResearchRunbook() {
  if (!nodes.researchRunbookRoot) return;
  if (!researchRunbook) {
    nodes.researchRunbookRoot.innerHTML = '<p class="empty">Research runbook data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "research-runbook-summary";
  summary.append(
    researchRunbookSummaryItem("gap worklists", researchRunbook.summary?.gapCount),
    researchRunbookSummaryItem("critical gaps", researchRunbook.summary?.criticalGapCount),
    researchRunbookSummaryItem("query rows", researchRunbook.summary?.queryCount),
    researchRunbookSummaryItem("State rows", researchRunbook.summary?.stateDepartmentQueryCount),
    researchRunbookSummaryItem("missing pools", researchRunbook.summary?.missingSourcePoolCount)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open runbook", "reports/research-runbook.md"),
    linkButton("All query CSV", "reports/research-runbook/all-gap-queries.csv"),
    linkButton("Priority CSV", "reports/research-runbook/priority-gap-queries.csv")
  );

  const grid = document.createElement("div");
  grid.className = "research-runbook-grid";
  grid.append(...(researchRunbook.gaps || []).map(researchRunbookCard));

  nodes.researchRunbookRoot.replaceChildren(summary, actions, grid);
}

function researchRunbookSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? 0);
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function researchRunbookCard(gap) {
  const card = document.createElement("article");
  card.className = `file-card research-runbook-card priority-${String(gap.priority || "medium").toLowerCase()}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(gap.priority), textSpan(gap.lane), textSpan(`${gap.queries?.length || 0} queries`));
  const title = document.createElement("h3");
  title.textContent = gap.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const evidence = document.createElement("p");
  evidence.textContent = gap.evidence || "";
  const needed = document.createElement("p");
  needed.className = "source-note";
  needed.textContent = gap.needed || "";

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const term of (gap.targetTerms || []).slice(0, 7)) chips.append(chip(term, gap.priority === "Critical" ? "warn" : ""));

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const query of (gap.queries || []).slice(0, 4)) list.append(researchRunbookQueryRow(query));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  for (const query of (gap.queries || []).slice(0, 2)) {
    actions.append(linkButton(query.sourcePoolPriority === "Missing" ? "Map source" : "Open query", query.sourcePoolSearchUrl));
  }

  card.append(header, evidence, needed, chips, list, actions);
  return card;
}

function researchRunbookQueryRow(query) {
  const item = document.createElement("li");
  const title = document.createElement("a");
  title.href = query.sourcePoolSearchUrl;
  title.target = "_blank";
  title.rel = "noreferrer";
  title.className = "compiler-row-title";
  title.textContent = `${query.sourcePoolTitle}: ${query.queryLabel}`;
  const terms = document.createElement("p");
  terms.textContent = query.queryTerms || "";
  const nextAction = document.createElement("p");
  nextAction.textContent = query.nextAction || "";
  item.append(title, terms, nextAction);
  return item;
}

function renderDecisionWorksheets() {
  if (!nodes.decisionWorksheetsRoot) return;
  if (!decisionWorksheets) {
    nodes.decisionWorksheetsRoot.innerHTML = '<p class="empty">Decision worksheet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "decision-worksheets-summary";
  summary.append(
    worksheetSummaryItem("worksheets", decisionWorksheets.summary?.worksheetCount),
    worksheetSummaryItem("selection rows", decisionWorksheets.summary?.selectionDecisionRows),
    worksheetSummaryItem("authority rows", decisionWorksheets.summary?.authorityReviewRows),
    worksheetSummaryItem("worksheet rows", decisionWorksheets.summary?.worksheetRows)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(linkButton("Open worksheet guide", "reports/decision-worksheets.md"));

  const grid = document.createElement("div");
  grid.className = "decision-worksheet-grid";
  grid.append(...(decisionWorksheets.worksheets || []).map(decisionWorksheetCard));

  nodes.decisionWorksheetsRoot.replaceChildren(summary, actions, grid);
}

function worksheetSummaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? 0);
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function decisionWorksheetCard(worksheet) {
  const card = document.createElement("article");
  card.className = "file-card decision-worksheet-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(worksheet.kind), textSpan(`${worksheet.count} rows`));
  const title = document.createElement("h3");
  title.textContent = worksheet.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const description = document.createElement("p");
  description.textContent = worksheet.description;

  const list = document.createElement("ul");
  list.className = "compiler-row-list";
  for (const row of (worksheet.previewRows || []).slice(0, 3)) list.append(decisionWorksheetPreviewRow(row));

  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(linkButton("Download CSV", worksheet.csvPath));
  if (worksheet.kind === "selection" && worksheet.previewRows?.[0]?.recommendation) {
    actions.append(queueButton("Open queue", worksheet.previewRows[0].recommendation));
  }

  card.append(header, description, list, actions);
  return card;
}

function decisionWorksheetPreviewRow(row) {
  const item = document.createElement("li");
  const title = document.createElement("span");
  title.className = "compiler-row-title";
  title.textContent = row.title || row.name || row.finalAuthorityForm || "Decision row";
  const detail = document.createElement("p");
  detail.textContent = row.nextAction || row.reviewReason || row.description || row.recommendation || "Review.";
  item.append(title, detail);
  return item;
}

function selectionDocketCard(item) {
  const count = selectionMatrix.filter((row) => row.recommendation === item.recommendation).length;
  const button = document.createElement("button");
  button.className = "metric-card docket-card";
  button.type = "button";
  const strong = document.createElement("strong");
  strong.textContent = count.toString();
  const span = document.createElement("span");
  span.textContent = item.label;
  const paragraph = document.createElement("p");
  paragraph.textContent = item.detail;
  button.append(strong, span, paragraph);
  button.addEventListener("click", () => {
    state.selection.recommendation = item.recommendation;
    state.selection.query = "";
    state.selection.lane = "";
    state.selection.priority = "";
    nodes.selectionSearch.value = "";
    nodes.selectionRecommendationFilter.value = item.recommendation;
    nodes.selectionLaneFilter.value = "";
    nodes.selectionPriorityFilter.value = "";
    renderSelectionMatrix();
    document.querySelector("#selection-matrix")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return button;
}

function selectionCard(item) {
  const card = document.createElement("article");
  card.className = `file-card selection-card priority-${String(item.priority || "context").toLowerCase()}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(item.recommendation), textSpan(item.priority), textSpan(item.lane), textSpan(item.dateText || item.date));
  const title = document.createElement("h3");
  title.textContent = item.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  if (item.compilerNumber) chips.append(chip(item.compilerNumber));
  chips.append(chip(item.recordType));
  if (item.country) chips.append(chip(item.country));
  if (item.releaseStatus) chips.append(chip(item.releaseStatus, /partial|restricted|marker|no memorandum/i.test(item.releaseStatus) ? "warn" : ""));
  for (const flag of (item.flags || []).slice(0, 5)) chips.append(chip(flag));

  const basis = document.createElement("p");
  basis.textContent = item.basis || "";
  const nextAction = document.createElement("p");
  nextAction.className = "source-note";
  nextAction.textContent = item.nextAction || "";

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (item.catalogUrl) actions.append(linkButton(item.naid ? "Catalog" : "Open source", item.catalogUrl));
  if (item.pdfUrl) actions.append(linkButton("PDF", item.pdfUrl));
  if (preferredSourceNote(item)) actions.append(copyButton(preferredSourceNote(item)));

  card.append(header, chips, basis, nextAction, actions);
  const sourceDetails = sourceNoteDetails(item);
  if (sourceDetails) card.append(sourceDetails);
  const diaryDetails = diaryReferenceDetails(item);
  if (diaryDetails) card.append(diaryDetails);
  return card;
}

function populateFilters() {
  addOptions(nodes.chapterFilter, chapters.map((chapter) => chapter.name), "All lanes");
  addOptions(nodes.countryFilter, uniqueSorted(records.map((record) => record.country)), "All countries");
  addOptions(nodes.releaseFilter, uniqueSorted(records.map((record) => record.releaseStatus)), "All releases");
  addOptions(nodes.availabilityFilter, ["Online PDF", "Marker / no public PDF"], "All documents");
  addOptions(nodes.policyLaneFilter, uniqueSorted(policyFiles.map((file) => file.lane)), "All lanes");
  addOptions(nodes.policyPriorityFilter, uniqueSorted(policyFiles.map((file) => file.priority)), "All priorities");
  addOptions(nodes.publicLaneFilter, uniqueSorted(publicReferences.map((item) => item.chapter)), "All lanes");
  addOptions(nodes.selectionRecommendationFilter, uniqueSorted(selectionMatrix.map((item) => item.recommendation)), "All recommendations");
  addOptions(nodes.selectionLaneFilter, uniqueSorted(selectionMatrix.map((item) => item.lane)), "All lanes");
  addOptions(nodes.selectionPriorityFilter, uniqueSorted(selectionMatrix.map((item) => item.priority)), "All priorities");
  addOptions(nodes.boundaryCountryFilter, uniqueSorted(boundaryRecords.map((record) => record.country)), "All countries");
  addOptions(nodes.gapLaneFilter, uniqueSorted(gapTracker.map((gap) => gap.lane)), "All lanes");
  addOptions(nodes.gapPriorityFilter, uniqueSorted(gapTracker.map((gap) => gap.priority)), "All priorities");
  addOptions(nodes.gapStatusFilter, uniqueSorted(gapTracker.map((gap) => gap.status)), "All statuses");
  addOptions(nodes.sourcePoolLaneFilter, uniqueSorted(sourcePools.map((pool) => pool.lane)), "All lanes");
  addOptions(nodes.sourcePoolPriorityFilter, uniqueSorted(sourcePools.map((pool) => pool.priority)), "All priorities");
  addOptions(nodes.countryDossierLaneFilter, uniqueSorted((countryDossiers?.dossiers || []).flatMap((dossier) => dossier.lanes || [])), "All lanes");
  addOptions(nodes.countryDossierStatusFilter, uniqueSorted((countryDossiers?.dossiers || []).map((dossier) => dossier.coverageStatus)), "All statuses");
}

function filteredRecords() {
  return records.filter((record) => {
    if (!matchesQuery(record, state.records.query)) return false;
    if (state.records.chapter && record.chapter?.name !== state.records.chapter) return false;
    if (state.records.country && record.country !== state.records.country) return false;
    if (state.records.release && record.releaseStatus !== state.records.release) return false;
    if (state.records.availability === "Online PDF" && !record.documentAvailable) return false;
    if (state.records.availability === "Marker / no public PDF" && record.documentAvailable) return false;
    return true;
  });
}

function renderRecords() {
  const visible = filteredRecords().sort(byChapterThenDate);
  nodes.recordsSummary.textContent = `${plural(visible.length, "row")} visible from ${records.length} Volume XX rows.`;
  if (!visible.length) {
    nodes.recordsRoot.innerHTML = '<p class="empty">No conversation records match the current filters.</p>';
    return;
  }

  const grouped = groupBy(visible, (record) => record.chapter?.name || "Regional and Multilateral");
  const sections = chapters
    .filter((chapter) => grouped.has(chapter.name))
    .map((chapter) => recordChapterSection(chapter.name, grouped.get(chapter.name)));
  nodes.recordsRoot.replaceChildren(...sections);
}

function recordChapterSection(chapterName, items) {
  const section = document.createElement("section");
  section.className = "chapter-section";
  section.id = `chapter-${slug(chapterName)}`;
  const heading = document.createElement("div");
  heading.className = "chapter-title-row";
  const title = document.createElement("h3");
  title.textContent = chapterName;
  const count = document.createElement("span");
  const pages = items.reduce((sum, item) => sum + (item.pageCount || 0), 0);
  count.textContent = `${plural(items.length, "row")} / ${plural(pages, "page")}`;
  heading.append(title, count);
  section.append(heading, ...items.map(recordCard));
  return section;
}

function recordCard(record) {
  const card = document.createElement("article");
  card.className = "record-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "record-id";
  meta.append(textSpan(record.compilerNumber), textSpan(record.dateText || record.date), textSpan(record.type), textSpan(record.country));
  const title = document.createElement("h4");
  title.textContent = record.title;
  titleBlock.append(meta, title);
  const chips = document.createElement("div");
  chips.className = "chips";
  chips.append(
    chip(record.releaseStatus, /full/i.test(record.releaseStatus) ? "good" : "warn"),
    chip(record.documentAvailable ? "Online PDF" : "No public PDF", record.documentAvailable ? "good" : "warn"),
    chip(`${record.pageCount || 0} pages`)
  );
  header.append(titleBlock, chips);

  const participants = document.createElement("p");
  participants.textContent = record.participants?.join(" / ") || record.counterpart || "";

  const actions = document.createElement("div");
  actions.className = "record-actions";
  actions.append(linkButton("Catalog", record.catalogUrl));
  if (record.pdfUrl) actions.append(linkButton("PDF", record.pdfUrl));
  if (preferredSourceNote(record)) actions.append(copyButton(preferredSourceNote(record)));

  const details = sourceNoteDetails(record);

  card.append(header, participants, actions);
  if (details) card.append(details);
  const diaryDetails = diaryReferenceDetails(record);
  if (diaryDetails) card.append(diaryDetails);
  if (record.notes) {
    const warning = document.createElement("p");
    warning.className = "source-note";
    warning.textContent = record.notes;
    card.append(warning);
  }
  return card;
}

function filteredPolicyFiles() {
  return policyFiles.filter((file) => {
    if (!matchesQuery(file, state.policy.query)) return false;
    if (state.policy.lane && file.lane !== state.policy.lane) return false;
    if (state.policy.priority && file.priority !== state.policy.priority) return false;
    return true;
  });
}

function renderPolicyFiles() {
  const visible = filteredPolicyFiles().sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title));
  nodes.policySummary.textContent = `${plural(visible.length, "file")} visible from ${policyFiles.length} policy and boundary file anchors.`;
  nodes.policyRoot.replaceChildren(...visible.map(policyCard));
  if (!visible.length) nodes.policyRoot.innerHTML = '<p class="empty">No policy files match the current filters.</p>';
}

function policyCard(file) {
  const card = document.createElement("article");
  card.className = `file-card priority-${file.priority.toLowerCase()}`;

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(file.dateText || file.date), textSpan(`NAID ${file.naid}`), textSpan(file.priority));
  const title = document.createElement("h3");
  title.textContent = file.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  chips.append(chip(file.lane, file.priority === "Boundary" ? "boundary" : ""), chip(`${file.pageCount || 0} pages`), chip(file.accessRestriction || "Status not stated"));

  const reason = document.createElement("p");
  reason.textContent = file.reason;
  const actions = document.createElement("div");
  actions.className = "file-actions";
  actions.append(linkButton("Catalog", file.catalogUrl));
  if (file.pdfUrl) actions.append(linkButton("PDF", file.pdfUrl));
  if (preferredSourceNote(file)) actions.append(copyButton(preferredSourceNote(file)));
  card.append(header, chips, reason, actions);
  const details = sourceNoteDetails(file);
  if (details) card.append(details);
  return card;
}

function filteredPublicReferences() {
  return publicReferences.filter((item) => {
    if (!matchesQuery(item, state.public.query)) return false;
    if (state.public.lane && item.chapter !== state.public.lane) return false;
    return true;
  });
}

function renderPublicReferences() {
  const visible = filteredPublicReferences().sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title));
  nodes.publicSummary.textContent = `${plural(visible.length, "reference")} visible from ${publicReferences.length} Public Papers references.`;
  nodes.publicRoot.replaceChildren(...visible.map(publicCard));
  if (!visible.length) nodes.publicRoot.innerHTML = '<p class="empty">No public references match the current filters.</p>';
}

function publicCard(item) {
  const card = document.createElement("article");
  card.className = "file-card";
  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.append(textSpan(item.dateText || item.date), textSpan(item.documentType), textSpan(item.chapter));
  const title = document.createElement("h3");
  title.textContent = item.title;
  titleBlock.append(meta, title);
  header.append(titleBlock);

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const term of item.matchedTerms.slice(0, 5)) chips.append(chip(term));
  const citation = document.createElement("p");
  citation.className = "source-note";
  citation.textContent = preferredSourceNote(item) || "Public Papers reference.";
  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (item.govinfoUrl) actions.append(linkButton("GovInfo", item.govinfoUrl));
  if (item.pdfUrl) actions.append(linkButton("PDF", item.pdfUrl));
  if (preferredSourceNote(item)) actions.append(copyButton(preferredSourceNote(item)));
  card.append(header, chips, citation, actions);
  return card;
}

function filteredBoundaryRecords() {
  return boundaryRecords.filter((record) => {
    if (!matchesQuery(record, state.boundary.query)) return false;
    if (state.boundary.country && record.country !== state.boundary.country) return false;
    return true;
  });
}

function renderBoundaryRecords() {
  const visible = filteredBoundaryRecords();
  nodes.boundarySummary.textContent = `${plural(visible.length, "row")} visible from ${boundaryRecords.length} handoff rows.`;
  nodes.boundaryRoot.replaceChildren(...visible.map(boundaryCard));
  if (!visible.length) nodes.boundaryRoot.innerHTML = '<p class="empty">No boundary rows match the current filters.</p>';
}

function boundaryCard(record) {
  const card = recordCard(record);
  const note = document.createElement("p");
  note.className = "source-note";
  note.textContent = record.boundaryReason;
  card.append(note);
  return card;
}

function chip(label, mode = "") {
  const span = document.createElement("span");
  span.className = `chip ${mode}`.trim();
  span.textContent = label || "Unspecified";
  return span;
}

function textSpan(value) {
  const span = document.createElement("span");
  span.textContent = value || "";
  return span;
}

function linkButton(label, href) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function copyButton(value) {
  return copyTextButton("Copy note", value);
}

function copyTextButton(label, value) {
  const button = document.createElement("button");
  button.className = "copy-note";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(value || "");
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = label;
    }, 1200);
  });
  return button;
}

function preferredSourceNote(item) {
  return item.frusSourceNote || item.sourceNote || item.citation || "";
}

function sourceNoteDetails(item) {
  const frusNote = item.frusSourceNote || "";
  const fallbackNote = item.sourceNote || item.citation || "";
  const note = frusNote || fallbackNote;
  if (!note) return null;

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = frusNote ? "FRUS source note" : "Source note";
  const sourceNote = document.createElement("p");
  sourceNote.className = "source-note";
  sourceNote.textContent = note;
  details.append(summary, sourceNote);

  if (frusNote && fallbackNote && fallbackNote !== frusNote) {
    const catalogNote = document.createElement("p");
    catalogNote.className = "source-note";
    catalogNote.textContent = `Catalog provenance: ${fallbackNote}`;
    details.append(catalogNote);
  }

  return details;
}

function diaryReferenceDetails(item) {
  const references = item.diaryReferences || [];
  if (!references.length) return null;

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Daily diary / backup references";
  const note = document.createElement("p");
  note.className = "source-note";
  note.textContent =
    item.diaryCrossReferenceNote ||
    "Date-matched Presidential Daily Diary/Backup lead for time, location, attendees, call status, and scheduling context.";
  const list = document.createElement("ul");
  list.className = "compact-list";
  for (const reference of references) {
    const entry = document.createElement("li");
    const link = document.createElement("a");
    link.href = reference.catalogUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `${reference.kind}: ${reference.title}`;
    entry.append(link, textSpan(` NAID ${reference.naid}`));
    list.append(entry);
  }
  details.append(summary, note, list);
  return details;
}

function formatDiaryReferences(item) {
  return (item.diaryReferences || []).map((reference) => `${reference.kind}: ${reference.title} (${reference.catalogUrl})`).join("; ");
}

function groupBy(items, getter) {
  const groups = new Map();
  for (const item of items) {
    const key = getter(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function topCounts(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const key = getter(item) || "Unspecified";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toCsv(items, columns) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.map((column) => escape(column.label)).join(",")]
    .concat(items.map((item) => columns.map((column) => escape(column.value(item))).join(",")))
    .join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setupEvents() {
  nodes.countryDossierSearch.addEventListener("input", (event) => {
    state.countryDossiers.query = event.target.value;
    renderCountryDossiers();
  });
  nodes.countryDossierLaneFilter.addEventListener("change", (event) => {
    state.countryDossiers.lane = event.target.value;
    renderCountryDossiers();
  });
  nodes.countryDossierStatusFilter.addEventListener("change", (event) => {
    state.countryDossiers.status = event.target.value;
    renderCountryDossiers();
  });
  nodes.clearCountryDossierFilters.addEventListener("click", () => {
    state.countryDossiers = { query: "", lane: "", status: "" };
    nodes.countryDossierSearch.value = "";
    nodes.countryDossierLaneFilter.value = "";
    nodes.countryDossierStatusFilter.value = "";
    renderCountryDossiers();
  });
  nodes.exportCountryDossiers.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-country-dossiers.csv",
      toCsv(filteredCountryDossiers(), [
        { label: "Country", value: (dossier) => dossier.country },
        { label: "Lanes", value: (dossier) => (dossier.lanes || []).join("; ") },
        { label: "Coverage Status", value: (dossier) => dossier.coverageStatus },
        { label: "Coverage Note", value: (dossier) => dossier.coverageNote },
        { label: "Chronology Rows", value: (dossier) => dossier.chronologyRows },
        { label: "Conversation Pages", value: (dossier) => dossier.conversationPages },
        { label: "First Date", value: (dossier) => dossier.firstDate },
        { label: "Last Date", value: (dossier) => dossier.lastDate },
        { label: "Source-Copy Rows", value: (dossier) => dossier.sourceCopyRows },
        { label: "Diary-Matched Rows", value: (dossier) => dossier.diaryMatchedRows },
        { label: "Policy Files", value: (dossier) => dossier.policyFileCount },
        { label: "Public References", value: (dossier) => dossier.publicReferenceCount },
        { label: "Direct Gaps", value: (dossier) => dossier.gapCount },
        { label: "Runbook Queries", value: (dossier) => dossier.runbookQueryCount },
        { label: "Persons", value: (dossier) => dossier.personCount },
        { label: "Next Actions", value: (dossier) => (dossier.nextActions || []).join("; ") }
      ])
    );
  });

  nodes.gapSearch.addEventListener("input", (event) => {
    state.gaps.query = event.target.value;
    renderGapTracker();
  });
  nodes.gapLaneFilter.addEventListener("change", (event) => {
    state.gaps.lane = event.target.value;
    renderGapTracker();
  });
  nodes.gapPriorityFilter.addEventListener("change", (event) => {
    state.gaps.priority = event.target.value;
    renderGapTracker();
  });
  nodes.gapStatusFilter.addEventListener("change", (event) => {
    state.gaps.status = event.target.value;
    renderGapTracker();
  });
  nodes.clearGapFilters.addEventListener("click", () => {
    state.gaps = { query: "", lane: "", priority: "", status: "" };
    nodes.gapSearch.value = "";
    nodes.gapLaneFilter.value = "";
    nodes.gapPriorityFilter.value = "";
    nodes.gapStatusFilter.value = "";
    renderGapTracker();
  });
  nodes.exportGaps.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-gap-tracker.csv",
      toCsv(filteredGaps(), [
        { label: "Priority", value: (gap) => gap.priority },
        { label: "Status", value: (gap) => gap.status },
        { label: "Lane", value: (gap) => gap.lane },
        { label: "Title", value: (gap) => gap.title },
        { label: "Evidence", value: (gap) => gap.evidence },
        { label: "Problem", value: (gap) => gap.problem },
        { label: "Needed", value: (gap) => gap.needed },
        { label: "Next Actions", value: (gap) => (gap.nextActions || []).join("; ") },
        { label: "Target Terms", value: (gap) => (gap.targetTerms || []).join("; ") },
        { label: "Source Pools", value: (gap) => (gap.sourcePools || []).join("; ") }
      ])
    );
  });

  nodes.sourcePoolSearch.addEventListener("input", (event) => {
    state.sourcePools.query = event.target.value;
    renderSourcePools();
  });
  nodes.sourcePoolLaneFilter.addEventListener("change", (event) => {
    state.sourcePools.lane = event.target.value;
    renderSourcePools();
  });
  nodes.sourcePoolPriorityFilter.addEventListener("change", (event) => {
    state.sourcePools.priority = event.target.value;
    renderSourcePools();
  });
  nodes.clearSourcePoolFilters.addEventListener("click", () => {
    state.sourcePools = { query: "", lane: "", priority: "" };
    nodes.sourcePoolSearch.value = "";
    nodes.sourcePoolLaneFilter.value = "";
    nodes.sourcePoolPriorityFilter.value = "";
    renderSourcePools();
  });
  nodes.exportSourcePools.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-source-pools.csv",
      toCsv(filteredSourcePools(), [
        { label: "Priority", value: (pool) => pool.priority },
        { label: "Lane", value: (pool) => pool.lane },
        { label: "Title", value: (pool) => pool.title },
        { label: "URL", value: (pool) => pool.url },
        { label: "Coverage", value: (pool) => pool.coverage },
        { label: "Next Use", value: (pool) => pool.nextUse }
      ])
    );
  });

  nodes.selectionSearch.addEventListener("input", (event) => {
    state.selection.query = event.target.value;
    renderSelectionMatrix();
  });
  nodes.selectionRecommendationFilter.addEventListener("change", (event) => {
    state.selection.recommendation = event.target.value;
    renderSelectionMatrix();
  });
  nodes.selectionLaneFilter.addEventListener("change", (event) => {
    state.selection.lane = event.target.value;
    renderSelectionMatrix();
  });
  nodes.selectionPriorityFilter.addEventListener("change", (event) => {
    state.selection.priority = event.target.value;
    renderSelectionMatrix();
  });
  nodes.clearSelectionFilters.addEventListener("click", () => {
    state.selection = { query: "", recommendation: "", lane: "", priority: "" };
    nodes.selectionSearch.value = "";
    nodes.selectionRecommendationFilter.value = "";
    nodes.selectionLaneFilter.value = "";
    nodes.selectionPriorityFilter.value = "";
    renderSelectionMatrix();
  });
  nodes.exportSelection.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-selection-matrix.csv",
      toCsv(filteredSelectionMatrix(), [
        { label: "Recommendation", value: (item) => item.recommendation },
        { label: "Priority", value: (item) => item.priority },
        { label: "Record Type", value: (item) => item.recordType },
        { label: "Compiler ID", value: (item) => item.compilerNumber },
        { label: "Date", value: (item) => item.date },
        { label: "Lane", value: (item) => item.lane },
        { label: "Country", value: (item) => item.country },
        { label: "Title", value: (item) => item.title },
        { label: "Participants", value: (item) => (item.participants || []).join("; ") },
        { label: "Release", value: (item) => item.releaseStatus },
        { label: "NAID", value: (item) => item.naid },
        { label: "Catalog URL", value: (item) => item.catalogUrl },
        { label: "PDF URL", value: (item) => item.pdfUrl },
        { label: "Flags", value: (item) => (item.flags || []).join("; ") },
        { label: "Basis", value: (item) => item.basis },
        { label: "Next Action", value: (item) => item.nextAction },
        { label: "FRUS Source Note", value: (item) => item.frusSourceNote },
        { label: "Daily Diary/Backup References", value: formatDiaryReferences }
      ])
    );
  });

  nodes.recordSearch.addEventListener("input", (event) => {
    state.records.query = event.target.value;
    renderRecords();
  });
  nodes.chapterFilter.addEventListener("change", (event) => {
    state.records.chapter = event.target.value;
    renderRecords();
  });
  nodes.countryFilter.addEventListener("change", (event) => {
    state.records.country = event.target.value;
    renderRecords();
  });
  nodes.releaseFilter.addEventListener("change", (event) => {
    state.records.release = event.target.value;
    renderRecords();
  });
  nodes.availabilityFilter.addEventListener("change", (event) => {
    state.records.availability = event.target.value;
    renderRecords();
  });
  nodes.clearRecordFilters.addEventListener("click", () => {
    state.records = { query: "", chapter: "", country: "", release: "", availability: "" };
    nodes.recordSearch.value = "";
    nodes.chapterFilter.value = "";
    nodes.countryFilter.value = "";
    nodes.releaseFilter.value = "";
    nodes.availabilityFilter.value = "";
    renderRecords();
  });
  nodes.exportRecords.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-records.csv",
      toCsv(filteredRecords(), [
        { label: "Compiler ID", value: (record) => record.compilerNumber },
        { label: "Date", value: (record) => record.date },
        { label: "Lane", value: (record) => record.chapter?.name },
        { label: "Country", value: (record) => record.country },
        { label: "Type", value: (record) => record.type },
        { label: "Release", value: (record) => record.releaseStatus },
        { label: "Title", value: (record) => record.title },
        { label: "NAID", value: (record) => record.naid },
        { label: "Catalog URL", value: (record) => record.catalogUrl },
        { label: "PDF URL", value: (record) => record.pdfUrl },
        { label: "FRUS Source Note", value: (record) => record.frusSourceNote },
        { label: "Catalog Source Note", value: (record) => record.sourceNote },
        { label: "Daily Diary/Backup References", value: formatDiaryReferences }
      ])
    );
  });

  nodes.policySearch.addEventListener("input", (event) => {
    state.policy.query = event.target.value;
    renderPolicyFiles();
  });
  nodes.policyLaneFilter.addEventListener("change", (event) => {
    state.policy.lane = event.target.value;
    renderPolicyFiles();
  });
  nodes.policyPriorityFilter.addEventListener("change", (event) => {
    state.policy.priority = event.target.value;
    renderPolicyFiles();
  });
  nodes.clearPolicyFilters.addEventListener("click", () => {
    state.policy = { query: "", lane: "", priority: "" };
    nodes.policySearch.value = "";
    nodes.policyLaneFilter.value = "";
    nodes.policyPriorityFilter.value = "";
    renderPolicyFiles();
  });
  nodes.exportPolicy.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-policy-files.csv",
      toCsv(filteredPolicyFiles(), [
        { label: "Date", value: (file) => file.date },
        { label: "Lane", value: (file) => file.lane },
        { label: "Priority", value: (file) => file.priority },
        { label: "Title", value: (file) => file.title },
        { label: "NAID", value: (file) => file.naid },
        { label: "Catalog URL", value: (file) => file.catalogUrl },
        { label: "PDF URL", value: (file) => file.pdfUrl },
        { label: "FRUS Source Note", value: (file) => file.frusSourceNote },
        { label: "Catalog Source Note", value: (file) => file.sourceNote }
      ])
    );
  });

  nodes.publicSearch.addEventListener("input", (event) => {
    state.public.query = event.target.value;
    renderPublicReferences();
  });
  nodes.publicLaneFilter.addEventListener("change", (event) => {
    state.public.lane = event.target.value;
    renderPublicReferences();
  });
  nodes.clearPublicFilters.addEventListener("click", () => {
    state.public = { query: "", lane: "" };
    nodes.publicSearch.value = "";
    nodes.publicLaneFilter.value = "";
    renderPublicReferences();
  });
  nodes.exportPublic.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-public-references.csv",
      toCsv(filteredPublicReferences(), [
        { label: "Date", value: (item) => item.date },
        { label: "Lane", value: (item) => item.chapter },
        { label: "Type", value: (item) => item.documentType },
        { label: "Title", value: (item) => item.title },
        { label: "Matched Terms", value: (item) => item.matchedTerms.join("; ") },
        { label: "URL", value: (item) => item.govinfoUrl || item.pdfUrl },
        { label: "FRUS Source Note", value: (item) => item.frusSourceNote },
        { label: "Source Note", value: (item) => item.sourceNote }
      ])
    );
  });

  nodes.boundarySearch.addEventListener("input", (event) => {
    state.boundary.query = event.target.value;
    renderBoundaryRecords();
  });
  nodes.boundaryCountryFilter.addEventListener("change", (event) => {
    state.boundary.country = event.target.value;
    renderBoundaryRecords();
  });
  nodes.clearBoundaryFilters.addEventListener("click", () => {
    state.boundary = { query: "", country: "" };
    nodes.boundarySearch.value = "";
    nodes.boundaryCountryFilter.value = "";
    renderBoundaryRecords();
  });
}

function init() {
  setStats();
  renderCountryDossiers();
  renderDraftDocumentList();
  renderDocumentReadiness();
  renderBlockerResolution();
  renderDocumentStubs();
  renderCompilerBrief();
  renderSourceNotePacket();
  renderResearchRunbook();
  renderDecisionWorksheets();
  renderWorkbench();
  renderGapTracker();
  renderSourcePools();
  renderSourceCopyLedger();
  renderSelectionDocket();
  renderSelectionMatrix();
  renderChapters();
  populateFilters();
  renderRecords();
  renderPolicyFiles();
  renderPublicReferences();
  renderBoundaryRecords();
  setupEvents();
}

init();
