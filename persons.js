const persons = window.PERSONS || [];
const authorityPacket = window.PERSONS_AUTHORITY_PACKET || null;

const state = {
  query: "",
  scope: "",
  source: ""
};

const nodes = {
  authorityRoot: document.querySelector("#persons-authority-root"),
  buildNote: document.querySelector("#persons-build-note"),
  root: document.querySelector("#persons-root"),
  summary: document.querySelector("#person-summary"),
  search: document.querySelector("#person-search"),
  scopeFilter: document.querySelector("#person-scope-filter"),
  sourceFilter: document.querySelector("#person-source-filter"),
  clearFilters: document.querySelector("#clear-person-filters"),
  exportPersons: document.querySelector("#export-persons")
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function addOptions(select, values, label) {
  select.replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value, value)));
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function searchText(person) {
  return [
    person.entry,
    person.displayName,
    person.description,
    person.aliases?.join(" "),
    person.source,
    person.scopes?.join(" "),
    person.places?.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(person) {
  const terms = state.query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.length) return true;
  const haystack = searchText(person);
  return terms.every((term) => haystack.includes(term));
}

function filteredPersons() {
  return persons.filter((person) => {
    if (!matchesQuery(person)) return false;
    if (state.scope && !(person.scopes || []).includes(state.scope)) return false;
    if (state.source && person.source !== state.source) return false;
    return true;
  });
}

function renderPersons() {
  const visible = filteredPersons().sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.entry.localeCompare(b.entry));
  nodes.summary.textContent = `${plural(visible.length, "person")} visible from ${persons.length} Volume XX candidates.`;

  if (!visible.length) {
    nodes.root.innerHTML = '<p class="empty">No persons match the current filters.</p>';
    return;
  }

  const groups = groupBy(visible, (person) => (person.sortKey || person.entry || "#").slice(0, 1).toUpperCase());
  nodes.root.replaceChildren(
    ...[...groups.entries()].map(([letter, group]) => {
      const section = document.createElement("section");
      section.className = "person-letter-section";
      section.id = `person-${letter.toLowerCase()}`;

      const heading = document.createElement("h3");
      heading.textContent = letter;

      const list = document.createElement("ul");
      list.className = "persons-list";
      for (const person of group) list.append(personItem(person));

      section.append(heading, list);
      return section;
    })
  );
}

function renderAuthorityPacket() {
  if (!nodes.authorityRoot) return;
  if (!authorityPacket) {
    nodes.authorityRoot.innerHTML = '<p class="empty">Persons authority packet data is unavailable.</p>';
    return;
  }

  const summary = document.createElement("div");
  summary.className = "persons-authority-summary";
  summary.append(
    summaryItem("selected persons", authorityPacket.summary?.personCount),
    summaryItem("authority matches", authorityPacket.summary?.authorityMatchedCount),
    summaryItem("review rows", authorityPacket.summary?.reviewCount),
    summaryItem("document links", authorityPacket.summary?.documentLinkCount),
    summaryItem("DOCX entries", authorityPacket.authority?.entryCount)
  );

  const actions = document.createElement("div");
  actions.className = "file-actions packet-actions";
  actions.append(
    linkButton("Open packet", "reports/persons-authority-packet.md"),
    linkButton("Review CSV", "reports/persons-authority/authority-review.csv"),
    linkButton("Document links CSV", "reports/persons-authority/person-document-links.csv"),
    copyTextButton("Copy review queue", reviewQueueText(authorityPacket.reviewRows || []))
  );

  const grid = document.createElement("div");
  grid.className = "persons-authority-grid";
  grid.append(...(authorityPacket.reviewRows || []).map(authorityCard));

  nodes.authorityRoot.replaceChildren(summary, actions, grid);
}

function summaryItem(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = Number(value || 0).toLocaleString();
  const span = document.createElement("span");
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function authorityCard(person) {
  const card = document.createElement("article");
  card.className = `file-card persons-authority-card priority-${(person.reviewPriority || "none").toLowerCase()}`;

  const header = document.createElement("div");
  header.className = "card-header";
  const title = document.createElement("h3");
  title.textContent = person.entry || person.name;
  const meta = document.createElement("p");
  meta.textContent = [
    `${person.reviewPriority} review`,
    plural(person.documentCount || 0, "document link"),
    person.proposedDocumentCount ? `${person.proposedDocumentCount} proposed` : "",
    person.conditionalDocumentCount ? `${person.conditionalDocumentCount} conditional` : "",
    person.gapMentionCount ? `${person.gapMentionCount} gap` : ""
  ]
    .filter(Boolean)
    .join(" | ");
  header.append(title, meta);

  const reason = document.createElement("p");
  reason.className = "source-note";
  reason.textContent = person.reviewReason || "Authority form needs compiler confirmation.";

  const details = document.createElement("ul");
  details.className = "compact-list";
  for (const line of [
    person.nextAction,
    (person.scopes || []).length ? `Scopes: ${person.scopes.join("; ")}` : "",
    (person.places || []).length ? `Places: ${person.places.join("; ")}` : "",
    (person.aliases || []).length ? `Aliases: ${person.aliases.join("; ")}` : ""
  ].filter(Boolean)) {
    const item = document.createElement("li");
    item.textContent = line;
    details.append(item);
  }

  const documents = document.createElement("div");
  documents.className = "authority-document-preview";
  const documentsTitle = document.createElement("h4");
  documentsTitle.textContent = "Document Touchpoints";
  const documentList = document.createElement("ol");
  documentList.className = "compact-list";
  for (const link of (person.documentLinks || []).slice(0, 3)) documentList.append(documentItem(link));
  if (!documentList.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No chronology/draft document link yet; use the gap/source lane first.";
    documents.append(documentsTitle, empty);
  } else {
    documents.append(documentsTitle, documentList);
  }

  if ((person.gapMentions || []).length) {
    const gapList = document.createElement("ul");
    gapList.className = "compact-list authority-gap-list";
    for (const gap of person.gapMentions.slice(0, 3)) {
      const item = document.createElement("li");
      item.textContent = `${gap.priority}: ${gap.title}`;
      gapList.append(item);
    }
    documents.append(gapList);
  }

  const actions = document.createElement("div");
  actions.className = "file-actions";
  if (person.documentLinks?.some((link) => link.frusSourceNote)) {
    actions.append(copyTextButton("Copy source notes", person.documentLinks.map((link) => link.frusSourceNote).filter(Boolean).join("\n\n")));
  }
  actions.append(linkButton("Review CSV", "reports/persons-authority/authority-review.csv"));

  card.append(header, reason, details, documents, actions);
  return card;
}

function documentItem(link) {
  const item = document.createElement("li");
  const title = document.createElement("span");
  title.textContent = [link.draftNumber || link.context, link.dateText || link.date, link.title].filter(Boolean).join(" - ");
  item.append(title);
  const actions = document.createElement("div");
  actions.className = "file-actions authority-document-actions";
  if (link.catalogUrl) actions.append(linkButton("Catalog", link.catalogUrl));
  if (link.pdfUrl) actions.append(linkButton("PDF", link.pdfUrl));
  if (link.frusSourceNote) actions.append(copyTextButton("Copy note", link.frusSourceNote));
  item.append(actions);
  return item;
}

function personItem(person) {
  const item = document.createElement("li");

  const entry = document.createElement("p");
  entry.className = "person-entry";
  const name = document.createElement("strong");
  name.textContent = person.displayName || person.entry;
  entry.append(name);
  if (person.description) entry.append(`, ${person.description}`);

  const meta = document.createElement("p");
  meta.className = "person-meta";
  meta.textContent = [
    (person.scopes || []).join("; "),
    (person.places || []).join("; "),
    person.aliases?.length ? `aliases: ${person.aliases.join("; ")}` : "",
    person.needsReview ? "compiler normalization" : "authority match"
  ]
    .filter(Boolean)
    .join(" | ");

  item.append(entry, meta);
  return item;
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

function linkButton(label, href) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function copyTextButton(label, value) {
  const button = document.createElement("button");
  button.className = "copy-note";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await copyText(value || "");
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = label;
    }, 1200);
  });
  return button;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}

function reviewQueueText(rows) {
  return rows
    .map((person) =>
      [
        person.entry,
        `Priority: ${person.reviewPriority}`,
        `Reason: ${person.reviewReason || "n/a"}`,
        `Next action: ${person.nextAction || "n/a"}`,
        `Documents: ${(person.documentLinks || []).map((link) => [link.draftNumber || link.context, link.date, link.title, link.naid ? `NAID ${link.naid}` : ""].filter(Boolean).join(" - ")).join("; ")}`
      ].join("\n")
    )
    .join("\n\n");
}

function setupEvents() {
  nodes.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderPersons();
  });
  nodes.scopeFilter.addEventListener("change", (event) => {
    state.scope = event.target.value;
    renderPersons();
  });
  nodes.sourceFilter.addEventListener("change", (event) => {
    state.source = event.target.value;
    renderPersons();
  });
  nodes.clearFilters.addEventListener("click", () => {
    state.query = "";
    state.scope = "";
    state.source = "";
    nodes.search.value = "";
    nodes.scopeFilter.value = "";
    nodes.sourceFilter.value = "";
    renderPersons();
  });
  nodes.exportPersons.addEventListener("click", () => {
    downloadCsv(
      "frus-volume20-persons.csv",
      toCsv(filteredPersons(), [
        { label: "Name", value: (person) => person.displayName },
        { label: "Description", value: (person) => person.description },
        { label: "Entry", value: (person) => person.entry },
        { label: "Aliases", value: (person) => (person.aliases || []).join("; ") },
        { label: "Scopes", value: (person) => (person.scopes || []).join("; ") },
        { label: "Places", value: (person) => (person.places || []).join("; ") },
        { label: "Source", value: (person) => person.source },
        { label: "Authority Status", value: (person) => person.authorityStatus },
        { label: "Needs Review", value: (person) => (person.needsReview ? "Yes" : "No") },
        { label: "Review Reason", value: (person) => person.reviewReason }
      ])
    );
  });
}

function init() {
  const authorityCount = persons.filter((person) => person.source === "Bush Comprehensive Names List").length;
  const reviewCount = persons.filter((person) => person.needsReview).length;
  nodes.buildNote.textContent = `${plural(authorityCount, "entry", "entries")} matched the Bush names authority list; ${plural(reviewCount, "entry", "entries")} use Volume XX compiler normalization or fallback text.`;
  renderAuthorityPacket();
  addOptions(nodes.scopeFilter, uniqueSorted(persons.flatMap((person) => person.scopes || [])), "All scopes");
  addOptions(nodes.sourceFilter, uniqueSorted(persons.map((person) => person.source)), "All sources");
  renderPersons();
  setupEvents();
}

init();
