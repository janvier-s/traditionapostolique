# Taxonomy redesign — design

**Status:** drafted 2026-05-25, awaiting user review.
**Scope:** rebuild the subject taxonomy as a pure umbrella/leaf tree ("themes" + "aspects"), drop the vestigial `section`/`groupe` axes, fix the save-blocking depth-2 violation, and reclassify all 146 topics into ~28 themes through a dedicated `/admin/migration` workspace. Public-facing pages get a new pillar-column index and a `/themes/{slug}` mini-index route. No public API or external URL contract beyond the site itself.

## Diagnosis

Two related problems prompted this redesign:

1. **Save-blocking bug.** Topic 84 (`la-nouvelle-naissance`) currently sits at depth 2 under 25 (`la-regeneration-baptismale`) under 24 (`bapteme-comme-moyen-de-grace`). The save validator `validateParentRefs` (`src/lib/admin/topic-tree.ts:67`) enforces depth ≤ 1, and it runs against the entire topics array on every PUT — so any edit to any topic fails until #84 is resolved. It's the only depth-2 offender in the file.
2. **Drifted taxonomy.** 47 root topics, three parallel grouping axes (`section`, `groupe`, `pillar`), ~32 roots holding direct quotes alongside their own sub-topics (curator friction: "parent or child?" for every new quote), 16 orphan roots from recent Cyril/Théophile/Aelred imports landing under generic `section: I` / `groupe: Credo`, a handful of inverted parent/child relationships (`Les Saintes Écritures` listed as a *child* of `Le canon des Écritures`; `Le péché` as a child of `Le péché mortel`), and a public `/sujets` index that dumps 104 topics under a single "Dieu" header because section I has become the catch-all.

The fix for both is the same: rebuild the model so every quote has exactly one obvious home, and walk every existing topic through a placement decision in one editorial pass.

## Goals

- Every quote lives on a leaf topic. No quote ever references a topic that has children.
- Subject pages are uniform: a leaf shows its quote stream; a theme has no public quote stream of its own (its primary aspect carries the theme's content).
- The four CCC pillars remain the primary grouping. `section` and `groupe` go away.
- The admin gets a one-shot recategorization workspace that's reversible per step.
- The migration is data-only — no public URL is grandfathered through redirects; the sitemap will simply update.

## Non-goals

- No multi-pillar topics, no cross-pillar parents.
- No deeper nesting than `theme → aspect`. Sub-themes are explicitly not supported.
- No automated content moves (LLM-assisted reclassification, etc.) — every move is curator-confirmed.
- No migration of authors/works/quotes schemas. Only `topics.json` and the `topicIds`/`mappedTopicIds` references in `quotes.json` and `bercot.json` change.
- No external-link redirect strategy. Slug changes will break inbound links and that's accepted.

## Data model

Schema after the redesign (`src/lib/schema/topic.ts`):

```ts
export const PillarSchema = z.enum(['credo', 'sacrements', 'vie', 'priere']);

export const TopicSchema = z.object({
  id: z.number().int().nonnegative(),
  slug: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  pillar: PillarSchema.optional(),     // present on roots only; aspects inherit
  parentId: z.number().int().nonnegative().optional(),  // null/undef = root
  order: z.number().int().nonnegative().optional(),
  primary: z.boolean().optional()      // children only; exactly one primary per theme
});
```

Removed fields: `section` (replaced by pillar), `groupe` (replaced by theme membership).

The three derived topic shapes — not stored on the record, derived at read time:

| Shape | Predicate | UI label |
|---|---|---|
| Theme | `parentId == null && hasChildren` | « Thème » |
| Aspect — primary | `parentId != null && primary === true` | « Aspect principal » |
| Aspect — specific | `parentId != null && !primary` | « Aspect » |
| Sujet standalone | `parentId == null && !hasChildren` | « Sujet » |

A topic is a theme iff it has at least one child. A topic is a standalone sujet iff it has no parent and no children. These shapes evolve as the topics array changes — no schema migration required to flip.

### Validation invariants (enforced on PUT)

`validateParentRefs` is extended to take both the topics array and the quotes array, and check:

1. `parentId` references an existing topic, is not self, and points at a root (depth ≤ 1). *(existing, kept)*
2. **Theme has zero quotes.** No `quote.topicIds` entry equals a topic id that has children. Cross-collection check — validator now receives both arrays.
3. **Theme has exactly one primary aspect.** For each topic with children, exactly one child has `primary: true`.
4. **Slugs are globally unique** across all topics.
5. *(Soft warning, not error)* Primary aspect's `label` matches its theme's `label`. Allowed to drift, flagged in the editor.

A new helper `validateTopicQuoteCoherence(topics, quotes)` does the cross-array check; the `/admin/api/topics` and `/admin/api/quotes` PUT handlers both call it (because either side can violate invariant #2).

## Public-facing pages

### `/sujets` (index)

Four pillar columns (Credo / Sacrements / Vie en Christ / Prière). Within each:

- Themes render as a header line with their **total descendant quote count**, followed by their aspects indented underneath (the primary aspect is hidden from the indented list — clicking the header lands on it).
- Standalone sujets render as flat items in the same list, alphabetically interleaved with themes.

```
CREDO                                SACREMENTS
  Le seul vrai Dieu             21     Le baptême                  86
  La Trinité                    59       ↳ régénération            18
    ↳ trois Personnes           18       ↳ nécessité               16
    ↳ Filioque                  16       ↳ trinitaire              16
    ↳ Saint-Esprit              10       ↳ baptême des enfants     14
  La divinité du Christ         …        ↳ catéchumères             5
    …                                    ↳ parrains                 3
  Hérésies                       7     La confirmation             23
    ↳ gnosticisme                7       ↳ imposition mains         6
    ↳ Marcion                    0       ↳ onction                  0
    ↳ montanisme                 0     …
    ↳ arianisme                 …
```

### `/sujets/{slug}` (detail)

- **Aspect (any kind) or standalone sujet:** unchanged from today — quotes grouped by author. Page title is the topic's label. For a primary aspect, that label equals the theme's label.
- **Theme:** not directly reachable from sidebar nav. The slug routes to the primary aspect's content (the primary aspect carries the clean slug; the theme record has a separate decorated slug — see below).

The "umbrella" terminology is replaced by **theme** everywhere user-visible (admin badges, mini-index page heading, sidebar markup).

### `/themes/{slug}` (new — mini-index)

A separate route for the theme-level meta page. Shows the theme's label, description, and a list of its aspects with quote counts. Not linked from sidebar nav — reachable by direct URL or by a "Voir tous les aspects de [theme]" link from any of its aspects.

Slug convention:
- Primary aspect: clean slug (e.g. `le-bapteme`) → served at `/sujets/le-bapteme`.
- Theme record: separate slug (e.g. `le-bapteme-theme` or similar — exact convention finalized during migration) → served at `/themes/le-bapteme-theme`. The theme's slug is not user-facing in 99% of navigation.

### Quote counts

The umbrella-line count is **total of all descendant aspects**, so a reader can see at-a-glance how rich a theme is. Aspect counts are per-aspect.

## Admin workflow

### `/admin/sujets` (editor) changes

Sidebar tree stays as today (depth-1 nesting via `flattenTree`). Each row gets a small badge: « THÈME », « ASPECT PRINCIPAL », or unbadged for specific aspects / standalone sujets. A ⚠️ marker appears on rows that violate the invariants (theme with quotes, theme missing a primary, etc.).

Form panel:
- Remove `section` and `groupe` fields.
- Add **Aspect principal** checkbox (visible only when the topic has a parent). Toggling it on auto-toggles it off on the previous primary in the same theme — single-primary invariant maintained in the editor, also enforced by the validator.
- Keep `Description` for everyone (used by the `/themes/{slug}` page when the topic is a theme; ignored for aspects/sujets).
- When the selected topic is a theme: show a read-only "Citations: 0 (must be 0)" line. If non-zero, show a "Déplacer les citations vers l'aspect principal" button.

### `/admin/hierarchie` (read-only) — refresh

Four pillar columns + a "Non classé" pool, as today. Cards now render as themes (with indented aspects) or standalone sujets. The descendant count appears on the theme card; specific aspects show their own count. No behavioral change beyond reflecting the new shape.

### `/admin/migration` (new) — the one-shot workspace

A dev-only page driving the cleanup-as-redesign. It walks through five buckets of work, each surface a *proposed* move with a confirm/override button:

1. **Depth-2 violation.** Surface topic 84 (`la-nouvelle-naissance`) with proposed action "promote to sibling of 25 under 24". One button. *(Unblocks editing immediately on apply.)*
2. **Inverted parent/child.** Detect the 2-3 obvious inversions (Saintes Écritures / canon; péché / péché mortel; etc.) and propose swap. One button per case.
3. **Orphan placement.** For each of the ~16 orphan roots (gnosticisme, Marcion, montanisme, novatianisme, arianisme, idolâtrie, jeûne, ascèse, l'âme, etc.) propose a target theme (creating the theme if it doesn't exist yet). Dropdown to override.
4. **Theme designation (the bulk of the work).** For each of the ~32 roots currently holding direct quotes, propose:
   - Theme label (default = current root label; override freely)
   - Primary aspect label (default = current root label) and slug (default = current root slug)
   - The current root's existing children, if any, are auto-listed as sibling aspects of the new primary.
   - Apply button: creates the new primary aspect, rewrites every `quote.topicIds` entry referencing the old root id to instead reference the new primary's id, same for `bercot.mappedTopicIds`, and flags the old root as a theme.
5. **Pillar review.** A final pass walks each theme and confirms its pillar — surfacing the cases where the current pillar is unset or ambiguous.

Each step records `applied: true` and is skipped on subsequent runs. Reverting a step is `git checkout` on the affected JSON files (or `git reset` on the whole migration commit).

Each apply is a single transaction through a new `POST /admin/api/migration/apply-step/+server.ts` endpoint that:
1. Reads the current topics + quotes + bercot.
2. Computes the modified arrays in memory.
3. Runs the extended `validateParentRefs(topics, quotes)`.
4. If valid, atomic-writes all three files (using the existing `atomicWriteJson` helper, sequenced).
5. Returns the new state.

If validation fails, the step is rejected with a structured error — the UI surfaces the violation so the user can adjust before re-trying.

### No separate proposal document

The migration UI carries its own suggestions inline; there's no companion `MIGRATION_PROPOSAL.md` to maintain in parallel. Editorial iteration happens in the UI.

## Recategorization framework (rough sizing)

The migration will produce approximately:

| Pillar | Themes | Notes |
|---|---|---|
| Credo | ~14 | Dieu, Trinité, Christ, Création, Écriture, Tradition, Église, Papauté, Hérésies, Marie, Saints/martyrs, Miracles, Salut/grâce, Mort/Jugement, Antéchrist |
| Sacrements | ~8 | Baptême, Confirmation, Eucharistie, Confession, Ordre, Mariage, Liturgie, Calendrier |
| Vie en Christ | ~4 | Morale sexuelle, Superstition, Discipline chrétienne, Loi morale & justice |
| Prière | ~2 | Prière, Intercession des saints |

Total: ~28 themes. With ~110-120 aspects underneath (incl. ~25 new "primary aspect" children created from current parent quotes), the topics array grows from 146 to ~140-150 records.

Theme names are renamed freely as part of the migration (e.g. theme "L'Eucharistie" with primary aspect "La présence réelle" is fine — the current root label drops to an aspect role).

The migration UI surfaces concrete proposals for every move. The user accepts, rejects, or edits each one inline.

## Mechanics

### Atomic per-step transaction

Each migration step that touches references must rewrite topics + quotes + bercot in lock-step. Sequenced atomic writes (already supported by `atomicWriteJson`); cross-array validation runs before any file is written.

### Bercot retargeting

`bercot.json` entries reference topics via `mappedTopicIds: number[]`. When a root is converted to a theme:

1. New primary aspect created (new id N).
2. Every `quote.topicIds` containing the old root id has that id replaced with N.
3. Every `bercot.mappedTopicIds` containing the old root id has that id replaced with N.
4. Old root keeps its id; its meaning shifts from leaf-with-quotes to theme-with-children.
5. Validation passes: theme (old root) is referenced by 0 quotes/bercot entries.

The 81 Bercot entries already auto-mapped to current roots will all retarget correctly under this rule.

### Idempotency

Each step in `/admin/migration` records `applied: true` once committed. Re-running the migration page skips applied steps. The step-applier endpoint also no-ops when the proposed move is already in effect (e.g. the depth-2 violation step checks whether 84 still has parent=25, and silently passes if not).

### Schema version & rollback

- Pre-migration commit: `git tag pre-taxonomy-redesign` (manual).
- User commits manually after each applied step (or batches several steps before committing) — the server endpoint does not invoke git. Each commit's message describes the move ("Migration: convert root 24 to theme; create primary aspect 200 `le-bapteme`; rewrite N quote refs, M bercot refs"). This gives per-step rollback granularity.
- No runtime version field on JSON files — the schema change is sharp, and rollback is via git.

## Files touched

**Schema:**
- `src/lib/schema/topic.ts` — drop `section`, `groupe`; add `primary`; remove `SectionSchema` export.
- `src/lib/schema/index.ts` — update exports.
- `src/lib/schema/schema.test.ts` — adjust fixtures.

**Data layer:**
- `src/lib/data/index.ts` — rewrite `buildTopicTree` to group by pillar (no section axis); add helpers `isTheme(topicId)` / `aspectsOf(themeId)` / `primaryAspectOf(themeId)` / `themeOf(aspectId)`.
- `src/lib/data/topics.json` — content edited by the migration.
- `src/lib/data/quotes.json` — `topicIds` rewrites by the migration.
- `src/lib/data/bercot.json` — `mappedTopicIds` rewrites by the migration.

**Admin validation:**
- `src/lib/admin/topic-tree.ts` — extend `validateParentRefs` to take `(topics, quotes)`; add invariants 2-4 above; add `validateTopicQuoteCoherence` helper.
- `src/lib/admin/topic-tree.test.ts` — new test cases.

**Admin UI:**
- `src/routes/admin/sujets/+page.svelte` — remove section/groupe, add primary checkbox + badges + theme-quotes warning.
- `src/routes/admin/hierarchie/+page.svelte` — render new theme/aspect shape.
- `src/routes/admin/migration/+page.svelte` — new workspace.
- `src/routes/admin/migration/+page.ts` — new loader.
- `src/routes/admin/+layout.svelte` — add "Migration" nav link.
- `src/routes/admin/api/[entity]/+server.ts` — call extended validator with both arrays.
- `src/routes/admin/api/migration/apply-step/+server.ts` — new endpoint, transactional step applier.

**Public UI:**
- `src/routes/sujets/+page.svelte` — switch from section-grouped to pillar-column layout.
- `src/routes/sujets/[slug]/+page.svelte` — pass-through; behavior already matches leaf semantics.
- `src/routes/themes/[slug]/+page.svelte` — new mini-index page.
- `src/routes/themes/[slug]/+page.ts` — new loader.

**Tests:**
- `src/lib/admin/topic-tree.test.ts` — invariants 2, 3, 4 coverage.
- New: `e2e` (Playwright) flow for the migration UI walkthrough.

## Risks

1. **Bercot rewrites not naturally idempotent.** Mitigated by step-level `applied` markers + endpoint-side no-op detection.
2. **Schema change is sharp.** Code reading the old fields breaks at the moment the JSON is written. Mitigation: implement the schema change + the data migration in the same commit; deploy them together; pre-migration git tag for rollback.
3. **No separately documented proposal.** The proposed moves live only in the migration UI's logic + the user's per-step decisions. There's no written audit trail beyond the git history. Mitigation: user-authored commit messages describe each move (see Mechanics → Schema version & rollback).
4. **Public layout change is visible.** The `/sujets` index changes shape on deploy. Confirm pre-deploy.

## Open questions

- Theme slug convention — `{label-slug}-theme`? Or something else? Decide during migration (UI lets you set it per theme).
- Whether to keep the `description` field on aspects, or only on themes (and primary aspects inherit theme's description for SEO). Default: keep on all topics, no enforcement.
- Whether `/admin/migration` ships behind a kill-switch after the migration runs (so it's not accidentally re-opened). Default: leave it in place; idempotent steps make accidental re-runs harmless.
