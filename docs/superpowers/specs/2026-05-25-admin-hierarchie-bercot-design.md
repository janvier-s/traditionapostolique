# Admin Hiérarchie + Bercot — design

**Status:** drafted 2026-05-25, awaiting user review.
**Scope:** two new dev-only admin sections — a pillar classifier for the existing 49 topics (modelled on the four parts of the *Catechism of the Catholic Church*), and a curation workspace for the 2,746 harvested Bercot quotes. No public-facing UI changes.

## Goal

Give the user a clean, ergonomic editor they will spend months in to (a) re-architect the topic taxonomy along the CCC's four-pillar structure (Credo / Sacrements / Vie en Christ / Prière) and (b) curate ~2,746 harvested patristic quotes into the site one at a time — translating to French, finding original sources, deciding what's worth publishing.

## Hiérarchie section

### Data model

Extend `TopicSchema` (`src/lib/schema/topic.ts`) with two new optional fields — a pillar (only meaningful on top-level topics) and a parent reference (for sub-topics):

```ts
export const PillarSchema = z.enum(['credo', 'sacrements', 'vie', 'priere']);
export type Pillar = z.infer<typeof PillarSchema>;

export const TopicSchema = z.object({
  // … existing fields …
  pillar: PillarSchema.optional(),       // top-level only; sub-topics inherit from their root ancestor
  parentId: z.number().int().nonnegative().optional(),  // null/undef = top-level
  order: z.number().int().optional(),    // display ordering among siblings; falls back to id
});
```

Validation rule (enforced in the API write path): a topic with `parentId` set must point at a top-level topic (parent must itself have no `parentId`). One level of nesting only — keeps the UI flat and prevents over-engineering. If a future need arises, deeper nesting can be added without a schema break.

A sub-topic's effective pillar is its parent's `pillar`. Setting `pillar` on a sub-topic is allowed by the schema but the UI hides the field for sub-topics.

The four pillars are the four parts of the *Catechism of the Catholic Church*:

| Pillar | French label | CCC part | Meaning |
| --- | --- | --- | --- |
| `credo` | Credo | I. La profession de la foi | What we believe — Trinity, Christ, Église, sources de la foi, Marie, fins dernières (most of the current site) |
| `sacrements` | Sacrements et liturgie | II. La célébration du mystère chrétien | How we celebrate — baptême, eucharistie, ordres, mariage, sabbat/dimanche |
| `vie` | Vie en Christ | III. La vie dans le Christ | How we live — morale, péché, vertus, vocations, lois |
| `priere` | Prière | IV. La prière chrétienne | How we pray — intercession des saints, prière pour les morts, Notre Père, postures et discipline |

### UI

- `/admin/sujets` (existing): the topic editor form grows three things:
  - **Parent topic** select (autocomplete against top-level topics; "_(racine)_" option = top-level)
  - **Pillar** select (only shown when parent is unset / topic is top-level): Credo / Sacrements / Vie / Prière / _(non classé)_
  - **Ordre** number input (small)
  The sidebar list switches from flat alphabetical to a **tree view**: top-level topics in display order, sub-topics indented under their parent. Existing search still works (matches at any depth).
- `/admin/hierarchie` (new): read-only visualization.
  - Four columns (Credo / Sacrements / Vie / Prière) + a fifth `Non classé` pool.
  - Each column shows top-level topics as cards; sub-topics nest under their parent with a left rule indent. Cards show label + groupe + quote count (own + descendants).
  - Column header shows pillar name + CCC reference (e.g. "Credo — *Profession de la foi* (CCC I)").
  - Click a card → jumps to `/admin/sujets#row-{id}`.
  - No drag-and-drop in v1.
- Sidebar nav adds "Hiérarchie" between Sujets and Citations.

### Initial classification & migration

- All 49 existing topics start with no pillar set and no parent (they're top-level). User assigns pillars by walking through `/admin/sujets`.
- Rough expected distribution (for the user's reference, not auto-applied):
  - **Credo** (~38 topics): everything in *Dieu*, *La Création*, *Les sources de la foi*, *L'Église et le Pape*, *Marie les saints le miraculeux* (except intercession), *Les fins dernières*.
  - **Sacrements** (~12 topics): everything in *Les sacrements et le culte*, plus *régénération baptismale* etc.
  - **Vie** (~5 topics): everything in *La morale* (avortement, contraception, homosexualité, astrologie, péché mortel).
  - **Prière** (~1-2 topics today): *intercession des saints*, possibly *révélation privée*. The Bercot harvest will significantly populate this pillar via candidates (PRAYER, LORD'S PRAYER, MORNING AND EVENING PRAYER, KNEELING, FASTING, etc.).
- New sub-topics get created by the user as needed — either through `/admin/sujets` (manual creation, pick a parent) or through the Bercot **Ungrouped view** (the "Créer un sujet" flow gains a "Parent" picker).
- The existing `groupe` field is kept untouched for backward compatibility. Over time `pillar` + `parentId` will supersede `groupe`, but no migration in v1 — the user decides per-topic when to remove the old grouping.

## Bercot section

### Data ingestion (one-time + re-runnable)

`scripts/bercot-harvest.py` grows a flag `--emit-json` that produces `src/lib/data/bercot.json` from the parsed entries + the mapping table. The MD files stay as the committed research snapshot but are **no longer regenerated** in the default run. Add an `--emit-md` flag for opt-in regeneration.

Default behaviour going forward: `python3 scripts/bercot-harvest.py` (or `--emit-json`) updates `bercot.json` only.

Re-runs are **idempotent** in identity: each Bercot quote has a stable `id` derived from `sha1(entry + subsection + attribution + en_text)[:12]` so the JSON can be regenerated without losing existing user-entered French/notes/status. On re-run, the ingestion **merges** — preserves user fields, refreshes EN text / attribution / topic mapping.

### Schema (`src/lib/schema/bercot.ts`)

```ts
export const BercotStatusSchema = z.enum(['pending', 'kept', 'rejected', 'published']);

export const BercotEntrySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/),     // sha1 prefix, stable across re-runs
  sourceEntry: z.string(),                     // e.g. "BAPTISM"
  subsection: z.string().optional(),           // e.g. "I. Meaning of baptism"
  attribution: z.string(),                     // raw "Tertullian (c. 197, W), 3.156" line
  en: z.string(),                              // English text (Bercot)

  // user-curated fields
  fr: z.string().optional(),                   // French translation
  authorId: z.number().int().nonnegative().optional(),   // resolved against authors.json
  sourceUrl: z.string().url().optional(),      // CCEL / wikisource / archive.org link
  notes: z.string().optional(),

  // mapping
  mappedTopicIds: z.array(z.number().int().nonnegative()).default([]),  // pre-filled from MAPPING
  siteQuoteId: z.number().int().nonnegative().optional(),  // populated on publish or dedup hit

  // lifecycle
  status: BercotStatusSchema.default('pending'),
  dedupMatch: z.number().int().nonnegative().optional(),   // populated by harvest dedup
});
export type BercotEntry = z.infer<typeof BercotEntrySchema>;
```

### Lifecycle

```
pending  ─┬─→ rejected   (user decides not to use)
          ├─→ kept       (translated, sourced, ready to publish)
          └─→ published  (promoted to quotes.json — siteQuoteId set)
```

`kept` is intentional: it's the "I want this but haven't finished it" parking lot. `published` means a `Quote` exists in `quotes.json` linked back via `siteQuoteId`.

### Routes

- `/admin/bercot` (new) — **topic-centric workspace** (default view).
  - Top: topic picker (search-filterable, same pattern as Sujets sidebar).
  - For a selected topic:
    - **Existing site quotes** section — collapsible list of current `quotes.json` quotes for this topic (read-only summary, links to `/admin/citations#{id}`).
    - **Bercot candidates** section — grid of cards, one per Bercot entry whose `mappedTopicIds` includes this topic. Filterable by status (pending / kept / rejected / published / all). Cards show: EN preview (truncated), attribution, status badge, dedup hint if applicable.
    - Click a card → opens the **detail editor** in a modal/side-panel (within the same page, no route change — keeps state).

- `/admin/bercot?view=ungrouped` — **Ungrouped view**.
  - Lists Bercot entries with `mappedTopicIds: []` (came from a non-mapped TOC entry — i.e., the `candidates.md` material).
  - Grouped by `sourceEntry` (e.g. all HYPOSTATIC UNION quotes together).
  - Action per group: **"Créer un sujet à partir de cette entrée"** — opens a new-topic form pre-filled with the entry name. The form lets the user choose either:
    - **Top-level** topic — must pick a pillar + groupe + write French label/description; or
    - **Sub-topic** of an existing top-level topic — picks a parent (pillar is inherited).
    After save, all quotes in the group get the new topic id appended to their `mappedTopicIds`.

### Detail editor (card → editor flow)

Layout: 2 columns inside a side-panel or modal.

**Left column (read-only context):**
- `sourceEntry` and `subsection` (e.g. "BAPTISM § III. The question of infant baptism")
- Raw `attribution` (e.g. "Cyprian (c. 250, W), 5.343")
- English text in full

**Right column (editable):**
- French textarea (large, prominent — the main work surface)
- Author dropdown (autocomplete against `authors.json`; pre-filtered by name match if Bercot's attribution starts with a known last name)
- Source URL field (single text input)
- Notes textarea (small)
- Mapped topics (multi-select chips — pre-filled from `mappedTopicIds`, editable). The picker shows topics as a **tree**: top-level topics with their sub-topics indented underneath, so the user can pin a quote to either a parent or a more-specific child. Selecting a sub-topic does **not** auto-select its parent — they are independent assignments.
- Status radio: pending / kept / rejected / published

**Footer actions:**
- `← Précédent` / `Suivant →` — navigate within the current topic's filtered list (preserves filters)
- `Enregistrer` (⌘/Ctrl-S)
- `Publier sur le site` — only enabled when: French is non-empty, author is selected, status is `kept`. Creates a new `Quote` in `quotes.json` with `status: 'draft'`, copies `fr` / `en` / `authorId` / `topicIds` / `sourceUrl → links.primary` / `attribution → reference`, sets the Bercot entry's `status: 'published'` and `siteQuoteId` to the new quote's id.

### Filters and counts in sidebar

Above the topic picker on `/admin/bercot`:
- Stats: total candidates / pending / kept / rejected / published (links toggle filter)
- Status filter chip row
- Free-text search across EN text

### Promotion: how a Bercot entry becomes a site Quote

POST `/admin/api/bercot/{id}/publish`:

1. Validate: `fr` present, `authorId` set, `mappedTopicIds` non-empty, status === `kept`.
2. Build a new `Quote`: next free id, slug `citation-{id}`, copy fields above. `status: 'draft'`.
3. Append to `quotes.json` (atomic write).
4. Update the Bercot entry: `status: 'published'`, `siteQuoteId: <new>`.
5. Return both.

Reverse path (`published → kept`) is allowed: it nulls `siteQuoteId` but does **not** delete the Quote from `quotes.json` (the curator can decide). A toast warns "Le Quote #N existe toujours dans quotes.json — supprimez-le manuellement si nécessaire."

### Sub-topic handling

Sub-topics are first-class in v1 (see Hiérarchie data model). The intended workflow:

1. Open a topic in `/admin/bercot`, see how many candidates landed there.
2. If the topic is getting too many heterogeneous candidates (e.g. `bapteme-comme-moyen-de-grace` accumulating distinct themes), the user can create sub-topics in `/admin/sujets` (parent = current topic) and re-assign individual Bercot cards from the parent to a sub-topic via the topic chips picker.
3. Bercot quote topic assignments are independent of parent/child: a quote can be on a parent OR on a sub-topic OR both (the user decides what shows where on the public site later).

## Files touched

**New:**
- `src/routes/admin/hierarchie/+page.svelte` — pillar visualization
- `src/routes/admin/bercot/+page.svelte` — curation workspace
- `src/routes/admin/bercot/+page.ts` — load bercot.json + topics + authors
- `src/lib/schema/bercot.ts` — Zod schema
- `src/lib/schema/pillar.ts` (or extend `topic.ts`) — Pillar enum
- `src/lib/data/bercot.json` — ingested data (generated by harvest script)

**Modified:**
- `src/routes/admin/+layout.svelte` — add 2 nav links
- `src/routes/admin/sujets/+page.svelte` — add Pillar / Parent / Ordre fields, tree-view sidebar
- `src/routes/admin/api/[entity]/+server.ts` — register `bercot` entity
- `src/lib/schema/topic.ts` — add `pillar?`, `parentId?`, `order?` fields
- `src/lib/schema/index.ts` — export new schema
- `scripts/bercot-harvest.py` — add `--emit-json` (default), `--emit-md` (opt-in), idempotent merge that preserves user fields on re-run

**New endpoint:**
- `src/routes/admin/api/bercot/[id]/publish/+server.ts` — promote to quotes.json

## Non-goals

- No public site changes (the public nav stays on the old `groupe`/`section` until you decide to switch)
- No LLM in the loop (manual translation only)
- No automated CCEL / wikisource link generation
- No drag-and-drop pillar assignment in v1 (use the Pillar dropdown in Sujets)
- Only one level of sub-topic nesting (parent → sub-topic; no sub-sub-topics)

## Risks / open questions

- **JSON file size:** 2,746 entries × ~600 bytes each ≈ 1.6 MB. Acceptable in dev (admin only loads it client-side). If it bites we can paginate the API.
- **Migration of existing `quotes.json`:** the 81 dedup-matched Bercot entries should be auto-set to `status: 'published'` with `siteQuoteId` pointing at the matched quote. The ingestion step does this.
- **Visual polish for the Bercot card workflow:** the user explicitly asked for something "nice AND practical/ergonomic." Once the spec is approved and the data layer is in place, I'll use the `frontend-design` subagent specifically for the Bercot detail-editor visual treatment (typography hierarchy, card density, status badge color system, keyboard shortcuts, panel transitions). Everything else stays consistent with the existing admin look.
