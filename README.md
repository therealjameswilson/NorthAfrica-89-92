# FRUS 1989-1992 Volume XX Assist

GitHub Pages research assistant for *Foreign Relations of the United States,
1989-1992, Volume XX, North Africa; Sub-Saharan Africa*.

The page is built as a compiler workbench rather than a general exhibit. It
combines:

- official Bush Library memcon/telcon rows for Volume XX countries
- NARA Catalog enrichment, direct PDFs, and page counts
- high-value NSC, NSR, and NSD policy-file anchors
- a Public Papers reference layer reused from companion-volume harvests
- a boundary-control lane for Southern Africa and Somalia handoff records
- an explicit compiler gap tracker and next-harvest source-pool queue

## Current Harvest

The committed data currently contains:

- `100` Volume XX conversation rows
- `370` counted conversation PDF pages
- `9` NSC/NSR/NSD policy or boundary file anchors
- `43` Public Papers references
- `34` Southern Africa boundary rows
- `11` compiler gap-tracker items
- `13` next-harvest source pools
- `37` source-copy ledger rows for markers, partials, and restricted releases
- `51` Volume XX persons-list candidates, with `33` direct Bush names-list authority matches

The official History.state.gov page lists the volume status as **Being
Researched**.

## Research Lanes

1. North Africa
2. Horn and East Africa
3. West Africa and Sahel
4. Central Africa
5. Regional and Multilateral

Southern Africa records are retained as boundary rows for Volume XIX. Somalia
policy files are retained as boundary rows for Volume XXI.

## Refresh Data

Run:

```bash
node scripts/harvest-volume20.js
```

The script writes:

- `data/records.json` and `data/records.js`
- `data/boundary-records.json` and `data/boundary-records.js`
- `data/policy-files.json` and `data/policy-files.js`
- `data/public-references.json` and `data/public-references.js`
- `data/volume-meta.json` and `data/volume-meta.js`
- `reports/volume20-harvest.json`

Build the compiler gap tracker and source-pool queue with:

```bash
node scripts/build-gap-tracker.js
```

This writes:

- `data/gap-tracker.json` and `data/gap-tracker.js`
- `data/source-pools.json` and `data/source-pools.js`
- `data/source-copy-ledger.json` and `data/source-copy-ledger.js`
- `reports/gap-tracker-build.json`

Build the persons list from the Bush comprehensive names authority document with:

```bash
BUSH_NAMES_DOCX="/path/to/Bush Comprehensive Names List.docx" node scripts/build-persons-list.js
```

When `BUSH_NAMES_DOCX` is omitted, the script looks for
`sources/Bush Comprehensive Names List.docx`. If the DOCX is unavailable, it
reuses the selected authority entries already committed in `data/persons.json`
so aliases and review metadata can still be regenerated. It writes:

- `data/persons.json` and `data/persons.js`
- `reports/persons-list-build.json`

The Public Papers layer is generated from local companion-volume harvests when
they are present in the same workspace. The committed `data/public-references.*`
files keep the site self-contained for GitHub Pages.

Run the coverage audit with:

```bash
node scripts/audit-gaps.js
```

This writes `reports/gap-audit.json` and fails if chronology participants,
boundary participants, or tracked gap person terms are missing from the persons
list.

## Local Preview

Open with a local static server:

```bash
python3 -m http.server 4194
```

Then visit <http://127.0.0.1:4194/>.

## Source Anchors

- FRUS Volume XX: <https://history.state.gov/historicaldocuments/frus1989-92v20>
- Status of the FRUS series: <https://history.state.gov/historicaldocuments/status-of-the-series>
- Bush Library Memcons and Telcons: <https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons>
- Records of the National Security Council, George H. W. Bush Administration: <https://catalog.archives.gov/id/2163580>
- NSC0034 - Libya: <https://catalog.archives.gov/id/470760928>
- NSR-23 - U.S. Policy Towards the Maghreb: <https://catalog.archives.gov/id/446394969>
- NSR-30 - American Policy Toward Africa in the 1990s: <https://catalog.archives.gov/id/446394987>
- NSD-75 - American Policy toward Sub-Saharan Africa in the 1990s: <https://catalog.archives.gov/id/446396910>
