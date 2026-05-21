# Pères de l'Église · Design Spec

Date: 2026-05-21
Status: Draft for review
Repo: `/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise`

## 1. Vision

A French-first digital anthology of patristic quotations organized topically, in the spirit of churchfathers.org but with better typography, multilingual originals, deeper filtering, and a study panel that surfaces provenance. Standalone, permanent, served from Cloudflare Pages.

Source corpus: `…/for-the-kingdom/fathers/excel/fathers_db.xlsx` (4 sheets: Auteurs 76, Œuvres 320, Sujets 49, Citations 803).

## 2. Stack & conventions

- SvelteKit 2 + Svelte 5 (runes only, `compilerOptions.runes: true`).
- Tailwind 3, TypeScript strict, vitest + playwright, minisearch.
- Cloudflare Pages (`@sveltejs/adapter-cloudflare`).
- Typography: Libre Baskerville (body, heading) + Gotham (UI). Reuse the webfonts and `@font-face` declarations from catechismecatholique.
- Theme tokens: CSS variables identical to catechismecatholique (`--color-bg`, `--color-fg`, `--color-panel`, `--color-accent`, `--color-accent-text`, `--color-muted`, `--color-subtle`, `--color-border`, `--color-heading`). Light + dark. `max-w-reader: 750px`.
- House rules: no em dashes (use middot, comma, parens, or rewrite); no `§` marker in UI copy; no French thousand separators in numerals; user-facing copy is French.

## 3. Information model

Four JSON files in `src/lib/data/`, validated by zod at build time.

### `authors.json` — `Author`
```ts
{
  id: number;            // stable, from xlsx
  slug: string;          // kebab-case, from name
  name: string;          // FR display name
  originalName?: string; // Latin/Greek
  era: string;           // apostolic | ante-nicene | nicene | post-nicene | medieval
  dates?: string;        // free text (e.g. "c. 354 - 430")
  feastDay?: string;     // ISO MM-DD or free text
  function?: string;     // évêque, prêtre, moine, etc.
  language: string[];    // ["latin", "grec", "syriaque"]
  region?: string;       // modern country
  groups?: string[];     // "Pères apostoliques", "Pères du désert"…
  disciples?: number[];  // author ids
  sources: {
    wikipedia?: string;
    wikisource?: string;
    wikimedia?: string;
  };
  status?: string;       // saint, doctor, blessed, none
  bioShort?: string;     // 1-2 paragraph FR bio (v1)
  bioLong?: string;      // Phase 2 — long-form Markdown bio
}
```

### `works.json` — `Work`
```ts
{
  id: number;
  slug: string;
  title: string;             // FR title (or original if no FR exists yet)
  alternativeTitles?: string[];
  authorId: number;
  description?: string;
  link?: string;
  // Phase 2:
  summary?: string;          // Markdown
  compositionDate?: string;
  outline?: string;          // Markdown
  editions?: string[];
}
```

### `topics.json` — `Topic`
```ts
{
  id: number;
  slug: string;
  label: string;           // FR
  section: "I" | "II" | "III" | "IV" | "V" | "VI" | "VII" | "VIII";
  groupe: string;          // 1:1 with section
  description?: string;
}
```

### `quotes.json` — `Quote`
```ts
{
  id: number;
  slug: string;             // for permalink
  title?: string;           // short FR caption (~3-10 words). See §7.1.
  authorId: number;
  workId?: number;
  topicIds: number[];       // 1..n
  reference?: string;       // book/chapter/section
  fr?: string;              // primary display text
  en?: string;              // kept in data but not surfaced in v1 UI
  latin?: string;
  greek?: string;
  context?: string;
  migne?: string;           // "PL 41:436" / "PG 35:1101"
  links: {
    primary?: string;       // "Lien" col
    archive?: string;       // "Lien Archive"
  };
  notes?: string;
  status?: "draft" | "ok";  // editorial status
}
```

## 4. Data pipeline

- `scripts/import-xlsx.ts` — one-shot importer. Reads the xlsx (path is configurable via env var; default points to the iCloud location), validates rows, writes `src/lib/data/{authors,works,topics,quotes}.json`. After running once, the xlsx is no longer the source of truth; the JSON files are.
- `scripts/prebuild.ts` — runs in `prebuild`:
  1. Zod-validate all four files; fail the build on schema errors.
  2. Build minisearch index → `static/data/search-index.json`. Indexed fields: quote text (FR + originals), author name, work title, topic label.
  3. Emit **gaps report** to stdout: counts of (a) quotes missing FR, (b) quotes missing all originals, (c) untagged quotes, (d) broken FK refs, (e) authors missing `bioShort`, (f) works missing `description`. Non-fatal warnings.

## 5. Navigation

### Top header
- Brand: "Pères de l'Église".
- Links: `Sujets · Pères · Œuvres · Recherche`.
- Theme toggle.
- Sidebar toggle (mobile).

### Sidebar (persistent, collapsible)
- Reuses the catechismecatholique sidebar (`Sidebar.svelte`, `SidebarItem.svelte`, `SidebarToggle.svelte`) verbatim.
- Open by default on all pages, including homepage. Collapsible; state in localStorage.
- Tree: 8 Sections (I–VIII) → their Sujets (49 leaves). Active sujet highlighted.
- Filter-as-you-type input at the top of the sidebar narrows the tree.

## 6. Routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage. Hero, 8 Section tiles, featured Fathers strip, quote-of-the-page, search field. Sidebar visible. |
| `/sujets` | Full Sections > Sujets browser (mirrors sidebar but full-page). |
| `/sujets/[slug]` | All quotes on a topic. Filter bar + sort selector + quote cards. |
| `/peres` | Author index. Sortable by era / region / alpha. Chronology strip header. |
| `/peres/[slug]` | Author page: bio, era, region, dates, feast day, function, languages, disciples, sources, list of works, list of quotes (topic-filterable). |
| `/oeuvres` | Work index, filterable by author / era. |
| `/oeuvres/[slug]` | Work page: title, author, alt titles, description, link, all quotes from this work. |
| `/recherche` | Minisearch UI across quotes, authors, works, topics. Facet by entity type, era, language. |
| `/citation/[id]` | Single-quote permalink. Opens directly into StudyPanel view. |
| `/a-propos` | About + provenance + contributors. |
| `/mentions-legales` | Legal. |
| `/admin/*` | **Dev-only**, see §9. |

## 7. Quote card + StudyPanel

### Card (default state)
Inspired by the patristic block on douayrheimsbible:

- **Title row** (top): short caption in Gotham small caps uppercase. From `Quote.title` when present; v1 fallback in §7.1.
- **Author row**: author name (Libre Baskerville, semibold) followed by dates in muted parentheses; small reference badge on the right (e.g. "I.1").
- **Body**: French quote in Libre Baskerville.
- **Footer**: topic chip(s), and on the right an italic work title (clickable to `/oeuvres/[slug]`).
- **Buttons** (subtle, at the bottom of the card): **"Plus d'infos"** opens the StudyPanel · copy citation · permalink.

### 7.1 Title fallback (v1)

Real bespoke titles arrive in Phase 2 (see §13). For v1, `Quote.title` is optional and the card derives a display title as follows:

1. If `title` is set, use it as-is.
2. Otherwise, derive from `fr`: first sentence (or first clause cut at the nearest punctuation), truncated to ~80 characters with an ellipsis when cut, rendered uppercase small caps.
3. Otherwise, fall back to the primary topic's label.

The derivation lives in a single helper (`deriveQuoteTitle(quote, topics)`) so when real titles are filled in, the call site doesn't change.

### StudyPanel
Port `StudyPanel.svelte` from douayrheimsbible (convert to runes syntax if not already). Replace the bible-specific tabs with:

| Tab | Content |
| --- | --- |
| **Auteur** | Bio summary, era badge, region, dates, feast day, function, status, link to full author page. |
| **Original** | Latin / Grec / Syriaque side-by-side (whichever exist). Per-language copy button. |
| **Sources** | Migne ref (PL/PG) formatted citation with copy button + external Archive.org / primary source links. |
| **Notes** | Editorial notes + context paragraph. |

A permalink `/citation/[id]` mounts the StudyPanel open by default.

## 8. /sujets/[slug] filter bar + sort selector

- **Filter** (multi-select chips): Ère, Région, Langue, Père.
- **Sort selector**: Date (oldest → newest, default) · Date (newest → oldest) · Auteur (A–Z) · Œuvre · Ordre canonique (data order). A quote's effective date is derived from its author's `dates` (or era midpoint when `dates` is missing); the derivation lives in a single helper so the rule stays consistent across the site.
- Filter + sort state is reflected in the URL query (`?ere=…&sort=…`) for shareable links and back-button correctness.

## 9. Admin editor (`/admin/*`)

- Mounted **only when `import.meta.env.DEV`**. `+layout.server.ts` throws 404 in production builds; admin endpoints refuse to register outside dev.
- Tabs: **Auteurs · Œuvres · Sujets · Citations · Gaps**.
- Each entity tab: searchable/sortable list view + detail form. Forms reflect the zod schema:
  - dropdowns for `authorId`/`workId`,
  - multi-select for `topicIds`,
  - separate textareas per language (FR, EN, Latin, Greek, Syriac),
  - status field,
  - Phase 2 fields (`bioLong`, work `summary`, etc.) surfaced from day one as optional "Enhance" sections so they can be filled progressively.
- Server endpoints under `/admin/api/*` write the JSON files atomically (write to temp file, fsync, rename). Each write triggers a re-validation pass and shows the resulting gaps delta in the UI.
- **Gaps tab**: live list of records needing attention. Click → jump to that record's detail form.

## 10. Components inventory

`src/lib/components/`

- `ui/` — reused/adapted from catechismecatholique: `Sidebar`, `SidebarItem`, `SidebarToggle`, `ThemeToggle`, `PageHeader`, `MetaTags`, `EmptyState`, `FilterChip`, `SortSelect`.
- `peres/` — domain-specific:
  - `QuoteCard.svelte`
  - `StudyPanel.svelte` (port from douayrheimsbible, tabs reworked)
  - `AuthorBio.svelte`
  - `WorkSummary.svelte`
  - `TopicChip.svelte`
  - `EraBadge.svelte`
  - `ChronologyStrip.svelte`
  - `SectionTile.svelte` (homepage)
- `admin/` — dev-only forms: `AuthorForm`, `WorkForm`, `TopicForm`, `QuoteForm`, `GapsList`, `JsonStatus`.

## 11. Testing

- **vitest**: zod schema validation, slug stability across import re-runs, citation formatter (Migne format), filter + sort reducer, atomic-write helper (mocked fs).
- **playwright**: sidebar toggle + persistence, topic page filter + sort, "Plus d'infos" panel open/close + tab switching, search results, citation copy + permalink, `/admin` returns 404 in a production build.

## 12. SEO

- Per-page MetaTags (title, description, OG image generated by a `scripts/generate-og-image.mjs` similar to catechismecatholique).
- `sitemap.xml` enumerating all topics, authors, works, citation permalinks.
- `llms.txt` describing the public corpus structure.

## 13. Phase 2 (planned, not v1, schema-ready)

- **Author bio enhancement** (`bioLong`): long-form FR biography, portrait, era/region context paragraph, disciples graph, related-council mentions. Admin editor exposes the field; gaps report counts missing values.
- **Work page enhancement** (`summary`, `compositionDate`, `outline`, `editions`): composition date, FR title gloss, structural outline, manuscript provenance, key editions.
- **Bespoke quote titles** (`Quote.title`): a short FR caption per quote, generated/curated alongside bio + work work. Until then the card uses the derivation in §7.1. Gaps report counts quotes lacking a real `title`.

## 14. Phase 3 (tail of data enhancement)

Pursued only after Phase 2 is largely complete. Both items are pipelines, not UI features.

### 14.1 Scriptural references inside quotes

Inspired by the patristic block on douayrheimsbible: numbered superscripts inside the quote body link to a scripture footnote list under the quote.

- **Schema** (`Quote`):
  ```ts
  scriptureRefs?: Array<{
    marker: number;          // 1, 2, 3… in display order
    ref: string;             // canonical, e.g. "1Tim 4:10" or "Jn 1:1-3"
    osis?: string;           // optional OSIS form for cross-linking later
  }>
  ```
- **Quote body inline markers**: the `fr` text gains inline placeholders `[[1]]`, `[[2]]` etc., rendered as superscript footnote markers by a single renderer (`renderQuoteWithRefs(fr, refs)`). The raw `fr` stays human-readable.
- **Pipeline** (`scripts/extract-scripture-refs.ts`):
  1. Detect candidate citations in `fr` (regex over book name vocabulary + chapter:verse).
  2. Normalize to canonical refs.
  3. Propose insertions; human review in `/admin` (a dedicated "Scripture" gap tab) before persisting.
  4. Write `scriptureRefs` and inject `[[n]]` markers atomically.
- **UI**: when `scriptureRefs.length > 0`, the QuoteCard shows a thin footnote rule + numbered list under the body, identical in spirit to the douayrheimsbible block. The StudyPanel "Notes" tab also surfaces the same list. (No live linking to an external bible site in this phase; that's a follow-up if/when a target is chosen.)
- Gaps report counts quotes whose `fr` likely contains scripture references but has no `scriptureRefs` yet (regex pre-screen).

### 14.2 Programmatic archive-link generation

Most `links.archive` values are missing in the source xlsx. This pipeline backfills them.

- **Schema** (`Quote.links`):
  ```ts
  links: {
    primary?: string;
    archive?: string;
    archiveStatus?: "missing" | "candidate" | "verified";
    archiveCandidates?: string[];   // top-k suggestions awaiting review
  }
  ```
- **Pipeline** (`scripts/find-archive-links.ts`):
  1. For each quote with `archiveStatus !== "verified"`, build search queries from (`Work.title`, alternate titles, `Author.name`, `Author.originalName`, Migne ref).
  2. Query Archive.org's search API; rank candidates by title overlap, language, and presence of full text.
  3. Persist top-k as `archiveCandidates` and set `archiveStatus = "candidate"`.
  4. Human review in `/admin` (an "Archive" gap tab): pick the right candidate → promotes to `archive` and `archiveStatus = "verified"`; or skip; or paste a manual URL.
- **Caching + rate limits**: the script caches its API responses in `.cache/archive-lookup/` keyed by query hash, so re-running is cheap and respectful of the API.
- **Caveat**: Archive.org coverage is partial and noisy; some quotes will never resolve. The status field makes that gap visible without being a build failure.
- Workflow: schema reserves these fields from v1 so the editor surfaces them immediately; population is incremental, not blocking.

## 15. Decisions log

- Stack: identical to catechismecatholique (matches user's existing toolchain).
- Standalone repo, permanent.
- Topic-first navigation with Fathers and Works as peer entry points.
- xlsx → JSON one-shot migration; JSON canonical thereafter.
- Sidebar pattern: persistent + collapsible like the CEC sidebar (not a slide-in drawer).
- Quote display: small card + "Plus d'infos" → StudyPanel with tabs Auteur, Original, Sources, Notes (no separate English tab; EN remains in data but not surfaced in v1 UI).
- Sort selector added to topic pages.
- Phase 2 schema fields reserved from v1 to keep the editor forward-compatible.
- Quote cards display a title (small caps) inspired by the douayrheimsbible patristic block. `Quote.title` is optional in v1 with a deterministic derivation (first sentence / topic label) so bespoke titles can be filled in Phase 2 without touching call sites.
- Phase 3 (tail end of data enhancement) carries two pipelines: scripture-reference extraction inside quotes (with `[[n]]` markers, footnote rendering, human review in `/admin`) and archive-link backfill via Archive.org search with a `archiveStatus` + candidates field reviewed in `/admin`.
