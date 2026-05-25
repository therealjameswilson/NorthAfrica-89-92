const persons = window.PERSONS || [];

const state = {
  query: "",
  scope: "",
  source: ""
};

const nodes = {
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
  addOptions(nodes.scopeFilter, uniqueSorted(persons.flatMap((person) => person.scopes || [])), "All scopes");
  addOptions(nodes.sourceFilter, uniqueSorted(persons.map((person) => person.source)), "All sources");
  renderPersons();
  setupEvents();
}

init();
