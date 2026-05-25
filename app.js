const meta = window.VOLUME_META || { chapters: [] };
const records = assignCompilerNumbers(window.VOLUME_RECORDS || []);
const boundaryRecords = assignBoundaryNumbers(window.BOUNDARY_RECORDS || []);
const policyFiles = window.POLICY_FILES || [];
const publicReferences = window.PUBLIC_REFERENCES || [];
const gapTracker = window.GAP_TRACKER || [];
const sourcePools = window.SOURCE_POOLS || [];
const sourceCopyLedger = window.SOURCE_COPY_LEDGER || [];
const chapters = meta.chapters || [];

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
  }
};

const nodes = {
  totalRecords: document.querySelector("#total-records"),
  totalPages: document.querySelector("#total-pages"),
  policyCount: document.querySelector("#policy-count"),
  publicCount: document.querySelector("#public-count"),
  boundaryCount: document.querySelector("#boundary-count"),
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

function populateFilters() {
  addOptions(nodes.chapterFilter, chapters.map((chapter) => chapter.name), "All lanes");
  addOptions(nodes.countryFilter, uniqueSorted(records.map((record) => record.country)), "All countries");
  addOptions(nodes.releaseFilter, uniqueSorted(records.map((record) => record.releaseStatus)), "All releases");
  addOptions(nodes.availabilityFilter, ["Online PDF", "Marker / no public PDF"], "All documents");
  addOptions(nodes.policyLaneFilter, uniqueSorted(policyFiles.map((file) => file.lane)), "All lanes");
  addOptions(nodes.policyPriorityFilter, uniqueSorted(policyFiles.map((file) => file.priority)), "All priorities");
  addOptions(nodes.publicLaneFilter, uniqueSorted(publicReferences.map((item) => item.chapter)), "All lanes");
  addOptions(nodes.boundaryCountryFilter, uniqueSorted(boundaryRecords.map((record) => record.country)), "All countries");
  addOptions(nodes.gapLaneFilter, uniqueSorted(gapTracker.map((gap) => gap.lane)), "All lanes");
  addOptions(nodes.gapPriorityFilter, uniqueSorted(gapTracker.map((gap) => gap.priority)), "All priorities");
  addOptions(nodes.gapStatusFilter, uniqueSorted(gapTracker.map((gap) => gap.status)), "All statuses");
  addOptions(nodes.sourcePoolLaneFilter, uniqueSorted(sourcePools.map((pool) => pool.lane)), "All lanes");
  addOptions(nodes.sourcePoolPriorityFilter, uniqueSorted(sourcePools.map((pool) => pool.priority)), "All priorities");
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
  const button = document.createElement("button");
  button.className = "copy-note";
  button.type = "button";
  button.textContent = "Copy note";
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(value || "");
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy note";
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
        { label: "Catalog Source Note", value: (record) => record.sourceNote }
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
  renderWorkbench();
  renderGapTracker();
  renderSourcePools();
  renderSourceCopyLedger();
  renderChapters();
  populateFilters();
  renderRecords();
  renderPolicyFiles();
  renderPublicReferences();
  renderBoundaryRecords();
  setupEvents();
}

init();
