# Bercot Dictionary Harvest

**Status:** approved 2026-05-25 — no site data is changed by this work; output lives under `docs/bercot-harvest/`.

## Source

`A Dictionary of Early Christian Beliefs` — David W. Bercot (Hendrickson, 2014 eBook). Local EPUB at
`~/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/epubs/A dictionary of early Christian beliefs...epub`.

The book is an alphabetical dictionary. Each entry has the same shape:

1. `ALL-CAPS HEADING` (matches `toc.ncx`, ~815 entries total).
2. Optional intro paragraph(s) from Bercot.
3. A sequence of attributed quotes from Ante-Nicene Fathers (and occasional Scripture). Every Father quote ends with the pattern `Author (date, region), volume.page.` — e.g. `Tertullian (c. 197, W), 3.25.`.
4. Optional `SEE ALSO ...` cross-reference line.

## Goal

Produce a reviewable corpus the human can curate into the site later. Three deliverables, all under `docs/bercot-harvest/`:

| Part | Deliverable | Purpose |
| --- | --- | --- |
| 1 | `topics/NN-slug.md` × 49 | Quotes per existing site topic |
| 2 | `candidates.md` | TOC entries that could become new site topics |
| 3 | inline dedup tags in Part 1 files | Show which harvested quotes already exist in `quotes.json` |

## Non-goals

- No edits to `src/lib/data/quotes.json`, `topics.json`, `authors.json`, `works.json`.
- No translation to French.
- No site UI work.
- No staging into `quotes.json` with `status: draft`.

## Output layout

```
docs/bercot-harvest/
  README.md            ← how the harvest was built, mapping table, totals
  topics/
    01-seul-vrai-dieu.md
    02-dieu-n-a-pas-de-corps.md
    ...
    49-antechrist.md
  candidates.md
```

Numeric prefix matches `id` in `topics.json` so files sort like the site.

### Per-topic Markdown shape

```markdown
# 20 · L'avortement  (avortement)

**Site group:** La morale
**Mapped dictionary entries:** ABORTION, INFANTICIDE
**Mapping confidence:** high
**Quotes harvested:** 17 (3 already on site)

> Bercot intro paragraph, blockquoted.

---

## from ABORTION, INFANTICIDE

### Quote 1  `[already on site → quote #142]`
> You shall not kill the child by obtaining an abortion. Nor, again, shall you destroy him after he is born.

**Attribution:** Barnabas (c. 70–130, E), 1.148.

### Quote 2
> ...

**Attribution:** Didache (c. 80–140, E), 1.377.

...

_See also: ABRAHAM, ADOPTION OF CHILDREN, ..._
```

- Topics with **low/uncertain** confidence get a `> ⚠️ Review mapping` callout at the top.
- For topics that share a dictionary entry (e.g. the baptism trio all map to `BAPTISM`), the entry's quotes are duplicated into each target file. The human curator decides which file keeps which quote later.

### candidates.md shape

```markdown
# Candidate new topics from Bercot

Generated <date>. Filter: doctrines + Catholic practice/spirituality.
TOC entries already consumed by the 49 site topics are excluded.

| TOC entry | Quotes | Why it fits | Bercot 1-line intro |
| --- | ---: | --- | --- |
| RELICS, VENERATION OF | 8 | Distinctively Catholic devotion ... | Bercot's intro snippet here |
| SIGN OF THE CROSS | 6 | Early Catholic practice ... | ... |
```

Candidates are filtered by two hand-built allowlists embedded in the script:

- **doctrines** — distinctively Catholic doctrinal entries (RELICS, IMAGES, FASTING, ORDERS, EXTREME UNCTION, INTERCESSION OF SAINTS, NATURAL LAW, ...)
- **practice** — early-Church practice/spirituality shared with Catholicism today (LITURGY, SIGN OF THE CROSS, KISS OF PEACE, VIRGINS ORDER OF, MARTYRS, FASTING, ...)

A TOC entry must match one allowlist to appear. Pure biography/geography/history (e.g. `ALEXANDER THE GREAT`, `ARABIA`) is dropped.

## Extraction pipeline

One self-contained script at `scripts/bercot-harvest.mjs` (Node, no new deps — uses built-ins + `node:fs`, `node:zlib` via `unzip` shell). Or `.py` if Node EPUB handling is awkward; choice made at implementation time. The script is kept after the run.

Steps:

1. Unzip the EPUB to a temp dir.
2. Read `toc.ncx`, build the canonical TOC list (~815 entries) with order preserved.
3. Concatenate `text/*.html` in part-number order, strip tags, decode entities, normalize whitespace.
4. Slice the concatenated text into entries by walking the TOC list in order and finding each heading as the next ALL-CAPS line.
5. For each entry, separate intro paragraph(s) from attributed quotes. A "quote" = a paragraph whose tail matches the regex `~ /[A-Z][a-zA-Z .']+(?:\s+\([^)]*\))?,\s*\d+\.\d+(?:[–-]\d+(?:\.\d+)?)?\.\s*$/`. (Validated against the ABORTION entry — pattern is rigorously consistent.)
6. Apply a hand-built topic→entries mapping table (embedded in the script, with `confidence: 'high' | 'medium' | 'low'`).
7. Render Part 1: `docs/bercot-harvest/topics/NN-slug.md`.
8. Render Part 2: `docs/bercot-harvest/candidates.md`.
9. Run dedup pass:
   - Build a normalized index of `quotes.json` `en` field (lowercase, collapse whitespace, strip `[bracketed editorial]`, strip trailing citations).
   - For each harvested quote, compute the same normalization on its English text.
   - A hit = the harvested normalized text is a substring of an existing normalized `en` (or vice versa) with at least 80% character overlap on the shorter side. (Tunable; conservative is fine — false negatives just mean the curator re-checks.)
   - Annotate matches inline in the per-topic Markdown with `[already on site → quote #N]`.
10. Render `docs/bercot-harvest/README.md` with the mapping table, totals (#quotes per topic, #candidates), and the date.

## Risks / open questions

- **TOC splitting accuracy.** A few entries with embedded ALL-CAPS sub-headers (e.g. `BAPTISM` has `I.`, `II.`, etc. — TBD on inspection) may need a second pass. The script will log any entry it cannot cleanly slice so the human can decide.
- **Dedup threshold.** 80% overlap is a guess. We'll inspect the first few annotated files and tune.
- **Multi-entry duplication.** Baptism-trio files will repeat the same `BAPTISM` block 3×. Acceptable for a research artifact; the curator is the dedup.

## Out of scope (explicit)

- Mapping into `authors.json` IDs. Attributions stay as raw strings.
- Latin originals — the EPUB doesn't ship them.
- French translation.
- Any change to the running site.
