# Taxonomy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Section/Groupe/Pillar three-axis topic taxonomy with a pure two-level Theme→Aspect model, fix the save-blocking depth-2 violation, and ship a dedicated `/admin/migration` workspace so the user can walk every existing topic through a placement decision in a single editorial pass.

**Architecture:** Schema gets a new `primary?: boolean` field on `Topic`, loses `section` and `groupe`. A topic with children is a _theme_ (must have zero direct quote refs and exactly one primary child). A leaf is an _aspect_ (or a standalone _sujet_ at root). Cross-collection invariants run on every save via an extended `validateParentRefs` that takes both topics and quotes. The migration workspace is a five-bucket walkthrough page that calls a transactional `POST /admin/api/migration/apply-step` endpoint, which rewrites `topics.json` + `quotes.json` + `bercot.json` atomically per step.

**Tech Stack:** Svelte 5 (runes: `$state`/`$props`/`$derived`/`$effect`), SvelteKit 2, TypeScript, Zod for schema, Vitest for unit tests, `atomicWriteJson` helper for safe disk writes.

---

## File structure

**Schema (`src/lib/schema/`)**

- `topic.ts` — drop `SectionSchema`+`section`, drop `groupe`, add `primary: boolean.optional()`
- `index.ts` — update exports (remove `Section`/`SectionSchema`)

**Data layer (`src/lib/data/`)**

- `index.ts` — rewrite `buildTopicTree` (group by pillar, not by section); add `isTheme`/`primaryAspectOf`/`themeOf`/`aspectsOf` helpers
- `topics.json` — strip `section`+`groupe` from every record (data cleanup)
- `quotes.json`, `bercot.json` — untouched here; modified later by migration runs

**Admin lib (`src/lib/admin/`)**

- `topic-tree.ts` — extend `validateParentRefs` to also take quotes and check (theme-has-no-quotes, exactly-one-primary-per-theme)
- `topic-tree.test.ts` — add cases for the new invariants

**Admin UI (`src/routes/admin/`)**

- `+layout.svelte` — add `<a href="/admin/migration">Migration</a>` to the nav
- `sujets/+page.svelte` — drop section/groupe form fields, add primary checkbox + badges + theme-quote warning
- `hierarchie/+page.svelte` — re-render to surface theme/aspect/sujet shapes
- `migration/+page.svelte` — new five-bucket walkthrough
- `migration/+page.ts` — new loader
- `api/[entity]/+server.ts` — pass both topics and quotes to extended validator
- `api/migration/apply-step/+server.ts` — new transactional endpoint

**Public UI (`src/routes/`)**

- `sujets/+page.svelte` — switch from section-grouped to pillar-column layout
- `sujets/[slug]/+page.svelte` — handle leaf vs theme rendering
- `themes/[slug]/+page.svelte` — new mini-index page
- `themes/[slug]/+page.ts` — new loader

---

## Task 1: Unblock editing (fix topic 84 depth-2 violation)

**Files:**

- Modify: `src/lib/data/topics.json` (one record only)

- [ ] **Step 1: Tag pre-migration state for rollback**

```bash
git tag pre-taxonomy-redesign
```

Expected: tag created on the current commit. `git tag -l pre-taxonomy-redesign` prints it back.

- [ ] **Step 2: Locate topic 84 in `src/lib/data/topics.json`**

Use the Edit tool to find the record (`"id": 84` with `"parentId": 25`) and confirm context. Expected current state:

```json
{
	"id": 84,
	"slug": "la-nouvelle-naissance",
	"label": "La nouvelle naissance",
	"section": "I",
	"groupe": "Credo",
	"pillar": "credo",
	"parentId": 25
}
```

- [ ] **Step 3: Re-parent topic 84 from 25 to 24**

Edit the record so `parentId` is `24` instead of `25`:

```json
{
	"id": 84,
	"slug": "la-nouvelle-naissance",
	"label": "La nouvelle naissance",
	"section": "I",
	"groupe": "Credo",
	"pillar": "credo",
	"parentId": 24
}
```

(Topic 84 becomes a sibling of "régénération baptismale" under the "Le baptême" parent — semantically fine and resolves the validator violation.)

- [ ] **Step 4: Run validator test to confirm topics.json now passes**

```bash
node -e "import('./src/lib/data/topics.json', { assert: { type: 'json' } }).then(m => { const { validateParentRefs } = require('./src/lib/admin/topic-tree.ts'); console.log(validateParentRefs(m.default)); })" 2>&1 | head -5
```

Note: that one-liner may fail under SvelteKit's import resolver. Alternative: run the existing vitest suite — it should already pass without code changes.

```bash
npm test -- --run src/lib/admin/topic-tree.test.ts
```

Expected: existing 4 tests still pass. (This task doesn't add tests; it fixes data so the existing validator no longer rejects production data.)

- [ ] **Step 5: Manually verify in the admin**

Run the dev server: `npm run dev`. Open `/admin/sujets`. Edit any topic (e.g. topic 24 "Le baptême comme moyen de grâce") and try to save. Expected: save succeeds (no 400 error).

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/topics.json
git commit -m "fix(topics): re-parent 'La nouvelle naissance' to 24, unblocks admin save

Topic 84 was depth-2 (parent=25 'régénération' which has parent=24 'baptême').
Validator enforces depth ≤ 1 — any save of topics.json failed until this
violation was resolved. 84 is now a sibling of 25 under 24."
```

---

## Task 2: Schema — drop section/groupe, add primary

**Files:**

- Modify: `src/lib/schema/topic.ts`
- Modify: `src/lib/schema/index.ts`
- Modify: `src/lib/schema/schema.test.ts` (if it references section/groupe)

- [ ] **Step 1: Read existing schema test**

```bash
grep -n "section\|groupe" src/lib/schema/schema.test.ts
```

Note: any references will fail after Step 2. Plan to update those references in this task.

- [ ] **Step 2: Update `src/lib/schema/topic.ts`**

Replace the entire file with:

```ts
import { z } from 'zod';

export const PillarSchema = z.enum(['credo', 'sacrements', 'vie', 'priere']);
export type Pillar = z.infer<typeof PillarSchema>;

export const TopicSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
	pillar: PillarSchema.optional(),
	parentId: z.number().int().nonnegative().optional(),
	order: z.number().int().nonnegative().optional(),
	primary: z.boolean().optional()
});
export type Topic = z.infer<typeof TopicSchema>;
```

- [ ] **Step 3: Update `src/lib/schema/index.ts`**

Remove the `Section` / `SectionSchema` exports. Keep `Pillar`, `PillarSchema`, `Topic`, `TopicSchema`. If there are other re-exports in the file, preserve them.

```bash
grep -n "Section\|section" src/lib/schema/index.ts
```

Remove any `Section`/`SectionSchema` lines.

- [ ] **Step 4: Update any schema-test references**

If `src/lib/schema/schema.test.ts` had `Section`/`section`/`groupe` references, edit them to use only valid fields (drop the old fields from fixture objects).

- [ ] **Step 5: Run schema tests**

```bash
npm test -- --run src/lib/schema/schema.test.ts
```

Expected: passes.

- [ ] **Step 6: Run typecheck**

```bash
npx svelte-check 2>&1 | head -50
```

Expected: many type errors in files that still import `Section` or use `topic.section`/`topic.groupe`. These will be fixed in Tasks 3, 4, 9, 10. Do NOT fix them now — they're handled by their respective tasks. Note the count for reference.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema/topic.ts src/lib/schema/index.ts src/lib/schema/schema.test.ts
git commit -m "feat(schema): drop section+groupe from Topic, add primary

Section is replaced by pillar (already exists). Groupe is replaced by
theme membership (parent topic). Primary identifies the aspect that
carries the theme's name and is the click-target from the sidebar."
```

---

## Task 3: Strip section/groupe from topics.json

**Files:**

- Modify: `src/lib/data/topics.json` (every record)

- [ ] **Step 1: Write a one-shot strip script**

Create `scripts/strip-section-groupe.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
const p = 'src/lib/data/topics.json';
const data = JSON.parse(readFileSync(p, 'utf-8'));
for (const t of data) {
	delete t.section;
	delete t.groupe;
}
writeFileSync(p, JSON.stringify(data, null, '\t') + '\n');
console.log(`Stripped section+groupe from ${data.length} topics`);
```

- [ ] **Step 2: Run it**

```bash
node scripts/strip-section-groupe.mjs
```

Expected: `Stripped section+groupe from 146 topics`.

- [ ] **Step 3: Verify topics.json parses against the new schema**

```bash
npm test -- --run src/lib/data
```

Expected: `src/lib/data/index.test.ts` (or wherever the parse happens) passes. If `src/lib/data/index.ts` `parseAll('topics', TopicSchema, topicsRaw)` throws, the data still has stale fields — re-run Step 2.

- [ ] **Step 4: Remove the throwaway script (one-shot, no need to commit)**

```bash
rm scripts/strip-section-groupe.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/topics.json
git commit -m "feat(data): strip section+groupe from topics.json (146 records)"
```

---

## Task 4: Helpers — isTheme, primaryAspectOf, themeOf, aspectsOf

**Files:**

- Create: `src/lib/data/topic-helpers.ts`
- Create: `src/lib/data/topic-helpers.test.ts`

- [ ] **Step 1: Write failing tests in `src/lib/data/topic-helpers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { Topic } from '$lib/schema';
import { isTheme, primaryAspectOf, themeOf, aspectsOf } from './topic-helpers';

const mk = (id: number, extras: Partial<Topic> = {}): Topic => ({
	id,
	slug: `t${id}`,
	label: `T${id}`,
	...extras
});

describe('isTheme', () => {
	it('true for a root with children', () => {
		const all = [mk(1), mk(2, { parentId: 1 })];
		expect(isTheme(1, all)).toBe(true);
	});
	it('false for a standalone root (no children)', () => {
		expect(isTheme(1, [mk(1)])).toBe(false);
	});
	it('false for a child topic', () => {
		expect(isTheme(2, [mk(1), mk(2, { parentId: 1 })])).toBe(false);
	});
});

describe('primaryAspectOf', () => {
	it('returns the child with primary:true', () => {
		const all = [mk(1), mk(2, { parentId: 1 }), mk(3, { parentId: 1, primary: true })];
		expect(primaryAspectOf(1, all)?.id).toBe(3);
	});
	it('returns undefined when no primary is set', () => {
		expect(primaryAspectOf(1, [mk(1), mk(2, { parentId: 1 })])).toBeUndefined();
	});
});

describe('themeOf', () => {
	it('returns the parent topic of an aspect', () => {
		const all = [mk(1), mk(2, { parentId: 1 })];
		expect(themeOf(2, all)?.id).toBe(1);
	});
	it('returns undefined for a root topic', () => {
		expect(themeOf(1, [mk(1)])).toBeUndefined();
	});
});

describe('aspectsOf', () => {
	it('returns all children of a theme', () => {
		const all = [mk(1), mk(2, { parentId: 1 }), mk(3, { parentId: 1 }), mk(4)];
		const result = aspectsOf(1, all)
			.map((t) => t.id)
			.sort();
		expect(result).toEqual([2, 3]);
	});
	it('returns [] for a standalone root', () => {
		expect(aspectsOf(1, [mk(1)])).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --run src/lib/data/topic-helpers.test.ts
```

Expected: FAIL — `topic-helpers.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/data/topic-helpers.ts`**

```ts
import type { Topic } from '$lib/schema';

export function isTheme(topicId: number, allTopics: readonly Topic[]): boolean {
	return allTopics.some((t) => t.parentId === topicId);
}

export function aspectsOf(themeId: number, allTopics: readonly Topic[]): Topic[] {
	return allTopics.filter((t) => t.parentId === themeId);
}

export function primaryAspectOf(themeId: number, allTopics: readonly Topic[]): Topic | undefined {
	return allTopics.find((t) => t.parentId === themeId && t.primary === true);
}

export function themeOf(aspectId: number, allTopics: readonly Topic[]): Topic | undefined {
	const aspect = allTopics.find((t) => t.id === aspectId);
	if (!aspect || aspect.parentId == null) return undefined;
	return allTopics.find((t) => t.id === aspect.parentId);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- --run src/lib/data/topic-helpers.test.ts
```

Expected: PASS (12 assertions across 8 `it` blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/topic-helpers.ts src/lib/data/topic-helpers.test.ts
git commit -m "feat(data): topic-helpers — isTheme, primaryAspectOf, themeOf, aspectsOf"
```

---

## Task 5: Extended validator (cross-collection invariants)

**Files:**

- Modify: `src/lib/admin/topic-tree.ts`
- Modify: `src/lib/admin/topic-tree.test.ts`
- Modify: `src/routes/admin/api/[entity]/+server.ts` (call site)

- [ ] **Step 1: Update existing test fixture to drop section/groupe**

In `src/lib/admin/topic-tree.test.ts`, update the `t()` helper (line ~5) — remove `section: 'I'` and `groupe: 'g'`:

```ts
const t = (id: number, label: string, extras: Partial<Topic> = {}): Topic => ({
	id,
	slug: `t${id}`,
	label,
	...extras
});
```

- [ ] **Step 2: Add failing tests for new cross-collection invariants**

Append to `src/lib/admin/topic-tree.test.ts`:

```ts
import type { Quote } from '$lib/schema';

const q = (id: number, topicIds: number[]): Quote => ({
	id,
	slug: `q${id}`,
	authorId: 1,
	workId: 1,
	topicIds,
	fr: 'x',
	en: 'x',
	reference: 'x',
	status: 'published'
});

describe('validateParentRefs (with quotes)', () => {
	it('fails when a theme (topic with children) has direct quote refs', () => {
		const topics = [t(1, 'Theme'), t(2, 'Aspect', { parentId: 1, primary: true })];
		const quotes = [q(100, [1])]; // quote refs the theme, not the aspect — illegal
		const r = validateParentRefs(topics, quotes);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/theme/i);
	});
	it('passes when theme is referenced 0 times and aspect carries all quotes', () => {
		const topics = [t(1, 'Theme'), t(2, 'Primary', { parentId: 1, primary: true })];
		const quotes = [q(100, [2])];
		expect(validateParentRefs(topics, quotes).ok).toBe(true);
	});
	it('fails when a theme has zero primary aspects', () => {
		const topics = [t(1, 'Theme'), t(2, 'A', { parentId: 1 }), t(3, 'B', { parentId: 1 })];
		const r = validateParentRefs(topics, []);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/primary/i);
	});
	it('fails when a theme has two primary aspects', () => {
		const topics = [
			t(1, 'Theme'),
			t(2, 'A', { parentId: 1, primary: true }),
			t(3, 'B', { parentId: 1, primary: true })
		];
		const r = validateParentRefs(topics, []);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/primary/i);
	});
	it('passes when quotes arg is omitted (back-compat for legacy callers)', () => {
		const topics = [t(1, 'A'), t(2, 'A1', { parentId: 1 })];
		expect(validateParentRefs(topics).ok).toBe(true);
	});
	it('fails on duplicate slug among non-themes (aspects + sujets share namespace)', () => {
		const topics = [t(1, 'A'), t(2, 'B', { slug: 'shared' }), t(3, 'C', { slug: 'shared' })];
		const r = validateParentRefs(topics, []);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/slug/i);
	});
	it('passes when theme and its primary aspect share a slug (different namespaces)', () => {
		const topics = [
			t(1, 'Theme', { slug: 'le-bapteme' }),
			t(2, 'Primary', { slug: 'le-bapteme', parentId: 1, primary: true })
		];
		expect(validateParentRefs(topics, []).ok).toBe(true);
	});
	it('fails on duplicate slug among themes', () => {
		// Two themes with same slug
		const topics = [
			t(1, 'T1', { slug: 'x' }),
			t(2, 'P1', { parentId: 1, primary: true }),
			t(3, 'T2', { slug: 'x' }),
			t(4, 'P2', { parentId: 3, primary: true })
		];
		const r = validateParentRefs(topics, []);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/slug/i);
	});
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- --run src/lib/admin/topic-tree.test.ts
```

Expected: 4 new tests FAIL (the legacy 4 still pass).

- [ ] **Step 4: Extend `validateParentRefs` in `src/lib/admin/topic-tree.ts`**

Replace the function with this version:

```ts
import type { Topic, Quote } from '$lib/schema';

// (keep existing siblingSort, buildTopicTree, flattenTree, ValidateResult — unchanged)

export function validateParentRefs(topics: Topic[], quotes?: Quote[]): ValidateResult {
	const byId = new Map<number, Topic>();
	for (const t of topics) byId.set(t.id, t);

	// Invariant 1: parent refs and depth ≤ 1
	for (const t of topics) {
		if (t.parentId == null) continue;
		if (t.parentId === t.id) {
			return { ok: false, error: `Topic ${t.id} (${t.slug}) cannot be its own parent` };
		}
		const parent = byId.get(t.parentId);
		if (!parent) {
			return { ok: false, error: `Topic ${t.id} (${t.slug}) has unknown parentId ${t.parentId}` };
		}
		if (parent.parentId != null) {
			return {
				ok: false,
				error: `Topic ${t.id} (${t.slug}) cannot nest under a sub-topic (parent ${parent.id} is itself a sub-topic)`
			};
		}
	}

	// Compute which topics are themes (have children)
	const childrenByParent = new Map<number, Topic[]>();
	for (const t of topics) {
		if (t.parentId != null) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		}
	}
	const themeIds = new Set(childrenByParent.keys());

	// Invariant 2: theme has zero direct quote refs (cross-collection check)
	if (quotes) {
		for (const q of quotes) {
			for (const tid of q.topicIds) {
				if (themeIds.has(tid)) {
					const theme = byId.get(tid)!;
					return {
						ok: false,
						error: `Quote ${q.id} references theme ${theme.id} (${theme.slug}) directly — themes cannot hold quotes; move to an aspect`
					};
				}
			}
		}
	}

	// Invariant 3: each theme has exactly one primary aspect
	for (const [themeId, children] of childrenByParent) {
		const primaries = children.filter((c) => c.primary === true);
		if (primaries.length === 0) {
			const theme = byId.get(themeId)!;
			return {
				ok: false,
				error: `Theme ${themeId} (${theme.slug}) has no primary aspect — exactly one child must have primary: true`
			};
		}
		if (primaries.length > 1) {
			const theme = byId.get(themeId)!;
			return {
				ok: false,
				error: `Theme ${themeId} (${theme.slug}) has ${primaries.length} primary aspects — only one is allowed`
			};
		}
	}

	// Invariant 4: slug uniqueness within route namespace. Themes live in /themes/;
	// aspects + standalone sujets live in /sujets/. A theme MAY share its slug with
	// its primary aspect (different namespaces). Within a namespace, slugs must be unique.
	const sujetsSlugs = new Set<string>();
	const themesSlugs = new Set<string>();
	for (const t of topics) {
		const inThemes = themeIds.has(t.id);
		const bucket = inThemes ? themesSlugs : sujetsSlugs;
		if (bucket.has(t.slug)) {
			return {
				ok: false,
				error: `Duplicate slug "${t.slug}" within ${inThemes ? '/themes/' : '/sujets/'} namespace`
			};
		}
		bucket.add(t.slug);
	}

	return { ok: true };
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- --run src/lib/admin/topic-tree.test.ts
```

Expected: all 12 tests pass (4 legacy + 5 cross-collection + 3 slug uniqueness).

- [ ] **Step 6: Update the API endpoint to pass quotes to the validator (but stay lenient for now)**

Edit `src/routes/admin/api/[entity]/+server.ts`. The current call at line ~63:

```ts
if (params.entity === 'topics') {
	const refs = validateParentRefs(parsed.data as Topic[]);
	if (!refs.ok) throw error(400, refs.error);
}
```

Stays unchanged (one-arg call → lenient → only depth-1 check). The migration apply-step endpoint (Task 12) will pass both arguments for strict validation. After migration completes, a follow-up change will pass quotes here too.

(No edit needed in this step. Documenting that the call site stays lenient on purpose.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/topic-tree.ts src/lib/admin/topic-tree.test.ts
git commit -m "feat(validator): cross-collection invariants for theme/aspect model

validateParentRefs now optionally accepts quotes[] and checks:
- themes (topics with children) have zero direct quote refs
- every theme has exactly one primary aspect
- back-compat: omitting quotes runs only legacy parent-ref check"
```

---

## Task 6: Public `/sujets` — pillar columns

**Files:**

- Modify: `src/lib/data/index.ts` (rewrite `buildTopicTree`)
- Modify: `src/routes/sujets/+page.svelte`

- [ ] **Step 1: Replace `buildTopicTree` and `TopicTreeNode` in `src/lib/data/index.ts`**

The existing `buildTopicTree` (at line ~57) references `t.section` and `t.groupe` — neither field exists after Task 2/3, so this function would fail TypeScript. **Delete** the existing `TopicTreeNode` interface (line ~50) and `buildTopicTree` function entirely, and replace with the new types + function below:

```ts
import type { Pillar } from '$lib/schema';

export interface PublicAspect {
	id: number;
	slug: string;
	label: string;
	href: string;
	count: number;
	isTheme: boolean;
	parentLabel?: string; // for indented display: the theme name above
}

export interface PublicPillarColumn {
	pillar: Pillar | 'none';
	label: string;
	subtitle: string;
	items: PublicAspect[]; // ordered, themes followed by their aspects intermixed by `order`
}

const PILLAR_META: Record<Pillar, { label: string; subtitle: string }> = {
	credo: { label: 'Credo', subtitle: 'Profession de la foi (CCC I)' },
	sacrements: { label: 'Sacrements', subtitle: 'Célébration du mystère chrétien (CCC II)' },
	vie: { label: 'Vie en Christ', subtitle: 'La vie dans le Christ (CCC III)' },
	priere: { label: 'Prière', subtitle: 'La prière chrétienne (CCC IV)' }
};

export function buildPublicTree(): PublicPillarColumn[] {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);

	const childrenByParent = new Map<number, typeof topics>();
	for (const t of topics) {
		if (t.parentId != null) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		}
	}

	function descendantCount(themeId: number): number {
		let n = counts.get(themeId) ?? 0;
		for (const c of childrenByParent.get(themeId) ?? []) n += descendantCount(c.id);
		return n;
	}

	const pillars: Array<Pillar | 'none'> = ['credo', 'sacrements', 'vie', 'priere'];
	const columns: PublicPillarColumn[] = pillars.map((p) => {
		const roots = topics
			.filter((t) => t.parentId == null && (t.pillar ?? 'none') === p)
			.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
		const items: PublicAspect[] = [];
		for (const root of roots) {
			const children = childrenByParent.get(root.id) ?? [];
			const isTheme = children.length > 0;
			items.push({
				id: root.id,
				slug: root.slug,
				label: root.label,
				href: `/sujets/${root.slug}`,
				count: isTheme ? descendantCount(root.id) : (counts.get(root.id) ?? 0),
				isTheme
			});
			if (isTheme) {
				const sortedChildren = children
					.slice()
					.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
				for (const child of sortedChildren) {
					// Hide the primary aspect from the indented list — clicking the theme line lands on it
					if (child.primary === true) continue;
					items.push({
						id: child.id,
						slug: child.slug,
						label: child.label,
						href: `/sujets/${child.slug}`,
						count: counts.get(child.id) ?? 0,
						isTheme: false,
						parentLabel: root.label
					});
				}
			}
		}
		const meta =
			p === 'none' ? { label: 'Non classé', subtitle: 'Sujets sans pilier' } : PILLAR_META[p];
		return { pillar: p, ...meta, items };
	});

	// Add a 'none' column at the end if there are unclassified roots
	const nonePillar: Pillar | 'none' = 'none';
	const noneRoots = topics.filter((t) => t.parentId == null && t.pillar == null);
	if (noneRoots.length > 0) {
		const items = noneRoots.map((t) => ({
			id: t.id,
			slug: t.slug,
			label: t.label,
			href: `/sujets/${t.slug}`,
			count: counts.get(t.id) ?? 0,
			isTheme: (childrenByParent.get(t.id)?.length ?? 0) > 0
		}));
		columns.push({
			pillar: nonePillar,
			label: 'Non classé',
			subtitle: 'Sujets sans pilier',
			items
		});
	}

	return columns;
}

// Keep the legacy buildTopicTree as a thin wrapper for any caller that still imports it.
// (Removed once all callers migrate.)
```

Note: there is a _different_ `buildTopicTree` in `src/lib/admin/topic-tree.ts` used by admin routes. That one is unrelated and stays untouched. Only the one in `src/lib/data/index.ts` is replaced here.

- [ ] **Step 2: Confirm no other consumer of legacy data-side `buildTopicTree`**

```bash
grep -rn "from '\$lib/data'" src/ --include="*.svelte" --include="*.ts" | grep -v ".svelte-kit" | xargs grep -l "buildTopicTree" 2>/dev/null
```

Expected: only `src/routes/sujets/+page.svelte`. Confirm before proceeding.

- [ ] **Step 3: Rewrite `src/routes/sujets/+page.svelte`**

Replace the file with:

```svelte
<script lang="ts">
	import { buildPublicTree } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const columns = buildPublicTree();
	const totalTopics = columns.reduce((n, c) => n + c.items.length, 0);
</script>

<MetaTags
	title="Sujets"
	fullTitle="Les sujets traités dans la Tradition Apostolique"
	description="Index thématique de la Tradition Apostolique : les principaux articles de la foi chrétienne traités par les Pères de l'Église — Dieu, le Christ, l'Église, les sacrements, la morale, la fin des temps."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<header
		class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]"
	>
		<div></div>
		<div>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				Les Sujets
			</h1>
			<p class="mt-3 label-meta">{totalTopics} sujets</p>
			<p class="mt-3 max-w-prose font-body text-base leading-[1.6] text-foreground">
				Cet index thématique rassemble les principaux articles de la foi chrétienne tels que les ont
				traités les Pères de l'Église : Dieu, le Christ, l'Église, les sacrements, la morale, la fin
				des temps.
			</p>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-12 md:grid-cols-2 xl:grid-cols-4">
		{#each columns as col (col.pillar)}
			<section id={`pillar-${col.pillar}`}>
				<h2 class="font-heading italic text-accent leading-[1.1]" style="font-size: 1.5rem;">
					{col.label}
				</h2>
				<p class="label-meta mt-1">{col.subtitle}</p>
				<ul class="mt-4 space-y-1">
					{#each col.items as item (item.id)}
						<li class="flex items-baseline justify-between gap-2" class:pl-4={item.parentLabel}>
							<a
								href={item.href}
								class="min-w-0 font-body text-foreground hover:text-accent"
								class:font-semibold={item.isTheme}
							>
								{#if item.parentLabel}<span class="text-muted" aria-hidden="true">↳ </span>{/if}
								{item.label}
							</a>
							<span
								class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted"
							>
								{item.count || '—'}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</article>
```

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:5173/sujets`. Expected:

- Four columns (Credo / Sacrements / Vie en Christ / Prière) — possibly a fifth "Non classé" if any root lacks a pillar.
- Themes (roots with children) appear bold; their non-primary children indent below.
- Quote counts on the right.
- No section/groupe references anywhere.

If the page errors out, check that `buildPublicTree` is exported from `src/lib/data/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/index.ts src/routes/sujets/+page.svelte
git commit -m "feat(sujets): pillar-column layout, theme/aspect rendering

buildPublicTree groups topics by pillar (not by section). Themes show
their descendant count and hide their primary aspect from the indented
list — the theme line itself is the click target for the primary."
```

---

## Task 7: `/themes/{slug}` mini-index route

**Files:**

- Create: `src/routes/themes/[slug]/+page.svelte`
- Create: `src/routes/themes/[slug]/+page.ts`

- [ ] **Step 1: Create the loader**

`src/routes/themes/[slug]/+page.ts`:

```ts
import { topics, quotes, topicBySlug } from '$lib/data';
import { isTheme, aspectsOf, primaryAspectOf } from '$lib/data/topic-helpers';
import { error } from '@sveltejs/kit';

export const prerender = true;

export function entries() {
	return topics
		.filter((t) => topics.some((x) => x.parentId === t.id))
		.map((t) => ({ slug: t.slug }));
}

export function load({ params }) {
	const theme = topicBySlug(params.slug);
	if (!theme || !isTheme(theme.id, topics)) {
		throw error(404, 'Thème introuvable');
	}
	const counts = new Map<number, number>();
	for (const q of quotes) for (const tid of q.topicIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
	const aspects = aspectsOf(theme.id, topics)
		.slice()
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id)
		.map((a) => ({
			id: a.id,
			slug: a.slug,
			label: a.label,
			description: a.description,
			isPrimary: a.primary === true,
			count: counts.get(a.id) ?? 0
		}));
	const primary = primaryAspectOf(theme.id, topics);
	return {
		theme: {
			id: theme.id,
			slug: theme.slug,
			label: theme.label,
			description: theme.description,
			pillar: theme.pillar
		},
		aspects,
		primarySlug: primary?.slug
	};
}
```

- [ ] **Step 2: Create the page**

`src/routes/themes/[slug]/+page.svelte`:

```svelte
<script lang="ts">
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	let { data } = $props();
	const totalCount = $derived(
		data.aspects.reduce((n: number, a: { count: number }) => n + a.count, 0)
	);
</script>

<MetaTags
	title={data.theme.label}
	fullTitle={`${data.theme.label} — aperçu thématique`}
	description={data.theme.description ??
		`Tous les aspects du thème « ${data.theme.label} » traités par les Pères de l'Église.`}
/>

<article class="mx-auto max-w-3xl px-6 py-12">
	<header class="mb-8">
		<p class="label-meta">Thème</p>
		<h1
			class="font-heading italic text-accent leading-[1.1]"
			style="font-size: clamp(2rem, 3.2vw, 2.75rem);"
		>
			{data.theme.label}
		</h1>
		<p class="mt-3 text-sm text-muted">{data.aspects.length} aspects · {totalCount} citations</p>
		{#if data.theme.description}
			<p class="mt-4 max-w-prose font-body text-base leading-[1.6] text-foreground">
				{data.theme.description}
			</p>
		{/if}
	</header>

	<ul class="space-y-3">
		{#each data.aspects as a (a.id)}
			<li class="border-b border-border pb-3">
				<a href={`/sujets/${a.slug}`} class="block hover:text-accent">
					<span class="flex items-baseline justify-between gap-2">
						<span class="font-body text-base">
							{a.label}
							{#if a.isPrimary}<span class="ml-2 text-[10px] uppercase tracking-wider text-muted"
									>principal</span
								>{/if}
						</span>
						<span class="font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
							{a.count || '—'}
						</span>
					</span>
					{#if a.description}
						<span class="mt-1 block text-sm text-muted">{a.description}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</article>
```

- [ ] **Step 3: Verify manually**

Start dev server. There are currently no themes (every root with children still has direct quotes), so we need to test with a synthetic case. After Task 9 lands the migration UI, we'll have real themes. For now:

```bash
# pick any root that currently has children — e.g. 24 'bapteme-comme-moyen-de-grace'
open http://localhost:5173/themes/bapteme-comme-moyen-de-grace
```

Expected: page renders with the children listed. (It will still have direct quotes today, so `count` on the children won't sum to 100% — that's expected pre-migration.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/themes
git commit -m "feat(themes): mini-index route at /themes/{slug}

Lists a theme's aspects with quote counts. Primary aspect is flagged.
Reachable by direct URL only — not linked from sidebar. Helps SEO/
discovery without cluttering the main nav."
```

---

## Task 8: `/sujets/[slug]` — handle theme case

**Files:**

- Modify: `src/routes/sujets/[slug]/+page.ts` (probably exists; check)
- Modify: `src/routes/sujets/[slug]/+page.svelte`

`src/routes/sujets/[slug]/+page.ts` already exists. Add theme-detection + redirect logic at the start of its `load` function.

- [ ] **Step 1: Read the existing loader**

```bash
cat "src/routes/sujets/[slug]/+page.ts"
```

Note how it resolves the topic (likely via `topicBySlug`) and what it returns.

- [ ] **Step 2: Add theme-detection redirect at the start of `load`**

Add this block before any other logic in the `load` function:

```ts
import { redirect } from '@sveltejs/kit';
import { topics, topicBySlug } from '$lib/data';
import { isTheme, primaryAspectOf } from '$lib/data/topic-helpers';

// At the top of the load function — before any existing logic:
const _t = topicBySlug(params.slug);
if (_t && isTheme(_t.id, topics)) {
	const primary = primaryAspectOf(_t.id, topics);
	if (primary) throw redirect(307, `/sujets/${primary.slug}`);
	throw redirect(307, `/themes/${_t.slug}`);
}
// ...existing logic continues...
```

Keep the rest of the existing `load` function unchanged.

- [ ] **Step 3: Verify manually**

Pre-migration: there are no themes yet (all "umbrellas" still have direct quotes). So visiting `/sujets/bapteme-comme-moyen-de-grace` should still render the topic's quote stream — same as today. The redirect kicks in only AFTER migration creates primary aspects.

```bash
open http://localhost:5173/sujets/bapteme-comme-moyen-de-grace
```

Expected: renders as today (no redirect).

- [ ] **Step 4: Commit**

```bash
git add src/routes/sujets
git commit -m "feat(sujets): redirect theme slugs to their primary aspect

When a /sujets/{slug} URL resolves to a topic that has children
(a theme), redirect to its primary aspect's URL. Falls back to
/themes/{slug} mini-index if no primary is set."
```

---

## Task 9: Admin sujets editor — primary checkbox, badges, theme-quote warning

**Files:**

- Modify: `src/routes/admin/sujets/+page.svelte`

- [ ] **Step 1: Remove section/groupe form fields**

Find and delete the Section `<label>` block (currently lines ~167-177) and the Groupe `<label>` block (currently lines ~178-185). Also remove the `SECTIONS` constant and any imports of `Section`.

- [ ] **Step 2: Add helper-derived state**

Near the top of the `<script>` block (after `const selected = ...`), add:

```ts
import { isTheme as isThemeFn } from '$lib/data/topic-helpers';

const selectedIsTheme = $derived(selected ? isThemeFn(selected.id, items) : false);
const selectedDirectQuoteCount = $derived(
	selected ? quotes.filter((q) => q.topicIds.includes(selected.id)).length : 0
);
const selectedSiblings = $derived(
	selected?.parentId != null
		? items.filter((t) => t.parentId === selected!.parentId && t.id !== selected!.id)
		: []
);
```

- [ ] **Step 3: Add the Aspect Principal checkbox (only for child topics)**

Inside the `<form>`, after the Parent dropdown and before the Pillar dropdown:

```svelte
{#if selected.parentId != null}
  <label class="flex items-center gap-2">
    <input
      type="checkbox"
      checked={selected.primary === true}
      onchange={(e) => {
        const checked = (e.currentTarget as HTMLInputElement).checked;
        if (checked) {
          // Unset primary on all siblings, set on this one
          for (const s of selectedSiblings) {
            const idx = items.findIndex((t) => t.id === s.id);
            if (idx >= 0 && items[idx].primary) items[idx] = { ...items[idx], primary: undefined };
          }
          update('primary', true);
        } else {
          update('primary', undefined);
        }
      }}
    />
    <span class="text-sm">Aspect principal (porte le nom du thème)</span>
  </label>
{/if}
```

- [ ] **Step 4: Add theme/aspect badges in the sidebar tree rows**

Find the sidebar row rendering (the `{#each filtered as ...}` block). Inside each `<button>`, before the label text, add:

```svelte
{#if isThemeFn(t.id, items)}
	<span
		class="mr-1 rounded bg-subtle/20 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-muted"
		>THÈME</span
	>
{:else if t.primary === true}
	<span
		class="mr-1 rounded bg-accent/15 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-accent"
		>PRINCIPAL</span
	>
{/if}
```

- [ ] **Step 5: Add theme-quote warning panel**

After the Description field in the form, add:

```svelte
{#if selectedIsTheme && selectedDirectQuoteCount > 0}
	<div class="rounded border border-amber-600/40 bg-amber-50/10 p-3 text-sm">
		<p class="font-semibold text-amber-700">
			⚠️ Ce thème porte {selectedDirectQuoteCount} citation(s) directe(s).
		</p>
		<p class="mt-1 text-amber-700/80">
			Les thèmes ne doivent pas porter de citations. Déplacez-les vers l'aspect principal via la
			page
			<a href="/admin/migration" class="underline">/admin/migration</a>.
		</p>
	</div>
{/if}
```

- [ ] **Step 6: Verify manually**

```bash
npm run dev
```

Open `/admin/sujets`. Expected:

- Section/Groupe fields are gone from the form.
- Selecting topic 24 ("Le baptême comme moyen de grâce") shows the THÈME badge in the sidebar (because it has children).
- Selecting a child topic (e.g. topic 25) shows the Aspect Principal checkbox in the form.
- Topic 24's panel shows the amber theme-quote warning (it currently has 17 direct quotes — pre-migration).

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/sujets/+page.svelte
git commit -m "feat(admin/sujets): theme/aspect badges, primary checkbox, theme-quote warning

Drops section/groupe form fields. Adds:
- THÈME / PRINCIPAL badges in the sidebar tree rows
- 'Aspect principal' checkbox on child topics (auto-unsets siblings)
- Warning panel when a theme has direct quote refs"
```

---

## Task 10: Admin hierarchie — refresh display

**Files:**

- Modify: `src/routes/admin/hierarchie/+page.svelte`

- [ ] **Step 1: Update terminology and badges**

In the existing `+page.svelte`, find the section header `<h1>Hiérarchie (...)</h1>` and the descriptive `<p>`. Change "sub-topic" terminology to "aspect/thème" in the description.

Find the `descendantQuoteCount` function and confirm it works (it already sums quotes recursively — good).

Add a THÈME badge near each node header inside the loop. The relevant block currently (lines ~57-91) renders cards with their children. Add right after `<span class="min-w-0 truncate">{node.topic.label}</span>`:

```svelte
{#if node.children.length > 0}
	<span
		class="ml-2 rounded bg-subtle/20 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-muted"
		>THÈME</span
	>
{/if}
```

For the child rows (the `{#each node.children}` block), add:

```svelte
{#if child.topic.primary === true}
	<span
		class="ml-1 rounded bg-accent/15 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-accent"
		>PRINCIPAL</span
	>
{/if}
```

- [ ] **Step 2: Verify manually**

```bash
npm run dev
```

Open `/admin/hierarchie`. Expected: same layout as before, but:

- Roots with children get the THÈME badge.
- After Task 9 + migration, children marked primary get the PRINCIPAL badge.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/hierarchie/+page.svelte
git commit -m "feat(admin/hierarchie): theme/aspect badges, terminology refresh"
```

---

## Task 11: Migration page scaffolding + nav link

**Files:**

- Create: `src/routes/admin/migration/+page.svelte`
- Create: `src/routes/admin/migration/+page.ts`
- Modify: `src/routes/admin/+layout.svelte`

- [ ] **Step 1: Add nav link**

In `src/routes/admin/+layout.svelte`, after the Bercot link, add:

```svelte
<a href="/admin/migration">Migration</a>
```

- [ ] **Step 2: Create loader `src/routes/admin/migration/+page.ts`**

```ts
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export async function load({ fetch }) {
	if (!dev) throw error(404);
	const [topics, quotes, bercot] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json()),
		fetch('/admin/api/quotes').then((r) => r.json()),
		fetch('/admin/api/bercot').then((r) => r.json())
	]);
	return { topics, quotes, bercot };
}
```

- [ ] **Step 3: Create page scaffold `src/routes/admin/migration/+page.svelte`**

```svelte
<script lang="ts">
	import type { Topic, Quote } from '$lib/schema';
	import { isTheme as isThemeFn } from '$lib/data/topic-helpers';

	let { data } = $props();
	let topics = $state<Topic[]>(data.topics);
	let quotes = $state<Quote[]>(data.quotes);
	let activeBucket = $state<1 | 2 | 3 | 4 | 5>(1);
	let busy = $state(false);
	let lastError = $state<string | null>(null);

	// Apply a single proposed move via the apply-step endpoint
	async function applyStep(payload: unknown) {
		busy = true;
		lastError = null;
		try {
			const res = await fetch('/admin/api/migration/apply-step', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				lastError = await res.text();
				return false;
			}
			const next = await res.json();
			topics = next.topics;
			quotes = next.quotes;
			return true;
		} finally {
			busy = false;
		}
	}
</script>

<h1 class="font-heading text-2xl">Migration de la taxonomie</h1>
<p class="mt-2 text-sm text-muted">
	Opération éditoriale ponctuelle : transformer le modèle actuel (47 racines + 99 enfants) en arbre
	Thème → Aspect, en plaçant chaque sujet à sa juste place. Chaque étape est commitable
	individuellement.
</p>

<nav class="mt-6 flex gap-2 border-b border-border pb-2 text-sm">
	{#each [1, 2, 3, 4, 5] as n (n)}
		<button
			type="button"
			class={[
				'rounded px-3 py-1 font-ui',
				activeBucket === n ? 'bg-accent text-white' : 'hover:bg-subtle/10'
			]}
			onclick={() => (activeBucket = n as 1 | 2 | 3 | 4 | 5)}
		>
			{n}. {['Profondeur', 'Inversions', 'Orphelins', 'Thèmes', 'Piliers'][n - 1]}
		</button>
	{/each}
</nav>

{#if lastError}
	<p class="mt-3 rounded border border-red-500 bg-red-50/10 p-2 text-sm text-red-600">
		{lastError}
	</p>
{/if}

<section class="mt-6">
	{#if activeBucket === 1}
		<p class="italic text-muted">Bucket 1 — implémenté dans Task 13.</p>
	{:else if activeBucket === 2}
		<p class="italic text-muted">Bucket 2 — implémenté dans Task 14.</p>
	{:else if activeBucket === 3}
		<p class="italic text-muted">Bucket 3 — implémenté dans Task 15.</p>
	{:else if activeBucket === 4}
		<p class="italic text-muted">Bucket 4 — implémenté dans Task 16.</p>
	{:else}
		<p class="italic text-muted">Bucket 5 — implémenté dans Task 17.</p>
	{/if}
</section>
```

- [ ] **Step 4: Add bercot to admin API entity allowlist (if not already)**

```bash
grep -n "bercot" src/routes/admin/api/[entity]/+server.ts
```

Confirm `bercot` is in the FILE/SCHEMA maps. If not, add it. (Per the spec for Bercot harvest, it should already be there.)

- [ ] **Step 5: Verify manually**

```bash
npm run dev
```

Open `/admin/migration`. Expected: page loads with 5-tab navigation showing "implémenté dans Task ..." placeholders.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/migration src/routes/admin/+layout.svelte
git commit -m "feat(admin/migration): scaffold page with 5-bucket nav, loader, applyStep helper"
```

---

## Task 12: apply-step endpoint (transactional writer)

**Files:**

- Create: `src/routes/admin/api/migration/apply-step/+server.ts`

- [ ] **Step 1: Create the endpoint**

`src/routes/admin/api/migration/apply-step/+server.ts`:

```ts
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { validateParentRefs } from '$lib/admin/topic-tree';
import {
	TopicSchema,
	QuoteSchema,
	BercotEntrySchema,
	type Topic,
	type Quote,
	type BercotEntry
} from '$lib/schema';

const StepSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('reparent'),
		topicId: z.number().int(),
		newParentId: z.number().int().nullable()
	}),
	z.object({
		kind: z.literal('swap-parent-child'),
		parentId: z.number().int(),
		childId: z.number().int()
	}),
	z.object({
		kind: z.literal('convert-root-to-theme'),
		rootId: z.number().int(),
		primaryAspect: z.object({
			slug: z.string().min(1),
			label: z.string().min(1),
			description: z.string().optional()
		}),
		themeSlugOverride: z.string().optional(),
		themeLabel: z.string().min(1).optional()
	}),
	z.object({
		kind: z.literal('set-pillar'),
		topicId: z.number().int(),
		pillar: z.enum(['credo', 'sacrements', 'vie', 'priere']).nullable()
	})
]);

function loadAll<T>(file: string, schema: z.ZodTypeAny): T[] {
	const raw = JSON.parse(readFileSync(join(process.cwd(), 'src/lib/data', file), 'utf-8'));
	const parsed = z.array(schema).safeParse(raw);
	if (!parsed.success)
		throw error(500, `data/${file} invalid: ${JSON.stringify(parsed.error.issues)}`);
	return parsed.data as T[];
}

function nextId(arr: { id: number }[]): number {
	return arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

export async function POST({ request }) {
	if (!dev) throw error(404);

	const body = await request.json();
	const step = StepSchema.safeParse(body);
	if (!step.success) throw error(400, JSON.stringify(step.error.issues));

	let topics = loadAll<Topic>('topics.json', TopicSchema);
	let quotes = loadAll<Quote>('quotes.json', QuoteSchema);
	let bercot = loadAll<BercotEntry>('bercot.json', BercotEntrySchema);

	switch (step.data.kind) {
		case 'reparent': {
			const { topicId, newParentId } = step.data;
			const idx = topics.findIndex((t) => t.id === topicId);
			if (idx < 0) throw error(400, `topic ${topicId} not found`);
			topics[idx] = { ...topics[idx], parentId: newParentId ?? undefined };
			break;
		}
		case 'swap-parent-child': {
			const { parentId, childId } = step.data;
			const pi = topics.findIndex((t) => t.id === parentId);
			const ci = topics.findIndex((t) => t.id === childId);
			if (pi < 0 || ci < 0) throw error(400, 'topic not found');
			// Child becomes the new parent (no parent), parent becomes child of child
			const oldParent = topics[pi];
			const oldChild = topics[ci];
			topics[pi] = { ...oldParent, parentId: oldChild.id };
			topics[ci] = { ...oldChild, parentId: undefined };
			// Any other children of oldParent re-parent to oldChild
			for (let i = 0; i < topics.length; i++) {
				if (i === pi || i === ci) continue;
				if (topics[i].parentId === parentId) topics[i] = { ...topics[i], parentId: oldChild.id };
			}
			break;
		}
		case 'convert-root-to-theme': {
			const { rootId, primaryAspect, themeSlugOverride, themeLabel } = step.data;
			const ri = topics.findIndex((t) => t.id === rootId);
			if (ri < 0) throw error(400, `root ${rootId} not found`);
			const root = topics[ri];
			// 1. Create primary aspect (new id)
			const newId = nextId(topics);
			const primary: Topic = {
				id: newId,
				slug: primaryAspect.slug,
				label: primaryAspect.label,
				description: primaryAspect.description,
				parentId: rootId,
				primary: true,
				pillar: undefined // inherits
			};
			topics.push(primary);
			// 2. Optionally rename theme
			if (themeLabel) topics[ri] = { ...topics[ri], label: themeLabel };
			if (themeSlugOverride) topics[ri] = { ...topics[ri], slug: themeSlugOverride };
			// 3. Rewrite all quote.topicIds: rootId → newId
			quotes = quotes.map((q) => {
				if (!q.topicIds.includes(rootId)) return q;
				return { ...q, topicIds: q.topicIds.map((id) => (id === rootId ? newId : id)) };
			});
			// 4. Rewrite bercot.mappedTopicIds: rootId → newId
			bercot = bercot.map((b) => {
				if (!b.mappedTopicIds.includes(rootId)) return b;
				return { ...b, mappedTopicIds: b.mappedTopicIds.map((id) => (id === rootId ? newId : id)) };
			});
			break;
		}
		case 'set-pillar': {
			const { topicId, pillar } = step.data;
			const idx = topics.findIndex((t) => t.id === topicId);
			if (idx < 0) throw error(400, `topic ${topicId} not found`);
			topics[idx] = { ...topics[idx], pillar: pillar ?? undefined };
			break;
		}
	}

	// Validate strict (cross-collection) on the new state
	const v = validateParentRefs(topics, quotes);
	if (!v.ok) throw error(400, `validation failed: ${v.error}`);

	// Atomic writes
	const root = process.cwd();
	atomicWriteJson(join(root, 'src/lib/data/topics.json'), topics);
	atomicWriteJson(join(root, 'src/lib/data/quotes.json'), quotes);
	atomicWriteJson(join(root, 'src/lib/data/bercot.json'), bercot);

	return json({ ok: true, topics, quotes, bercot });
}
```

- [ ] **Step 2: Smoke-test the endpoint**

The endpoint validates with the strict cross-collection rules. Since pre-migration data has parents-with-quotes, applying ANY step today would fail invariant #2.

This is by design: the endpoint enforces the target invariants per step. The first successful step will be a `reparent` or `swap-parent-child` (Buckets 1-2) that doesn't add a theme. The first `convert-root-to-theme` (Bucket 4) creates a theme AND moves all its quotes to the new primary in the same transaction, so invariants stay satisfied.

Confirm the endpoint compiles:

```bash
npx svelte-check 2>&1 | grep -i "apply-step\|migration" | head -5
```

Expected: no errors specific to this file.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/api/migration/apply-step/+server.ts
git commit -m "feat(admin/api): /admin/api/migration/apply-step — transactional step applier

Four step kinds: reparent, swap-parent-child, convert-root-to-theme,
set-pillar. Each step writes topics+quotes+bercot atomically; validator
runs strict (cross-collection) on the new state. Endpoint is dev-only."
```

---

## Task 13: Bucket 1 — depth-2 violation step

**Files:**

- Modify: `src/routes/admin/migration/+page.svelte`

- [ ] **Step 1: Detect depth-2 violations and render bucket 1 UI**

Replace the bucket-1 placeholder with:

```svelte
{#if activeBucket === 1}
	{@const violations = topics.filter((t) => {
		if (t.parentId == null) return false;
		const parent = topics.find((x) => x.id === t.parentId);
		return parent != null && parent.parentId != null;
	})}
	{#if violations.length === 0}
		<p class="rounded border border-emerald-600/40 bg-emerald-50/10 p-3 text-sm text-emerald-700">
			✓ Aucune violation de profondeur ≥ 2.
		</p>
	{:else}
		<p class="text-sm text-muted">{violations.length} violation(s) détectée(s).</p>
		<ul class="mt-4 space-y-3">
			{#each violations as v (v.id)}
				{@const parent = topics.find((x) => x.id === v.parentId)}
				{@const grandparent = parent ? topics.find((x) => x.id === parent.parentId) : undefined}
				<li class="rounded border border-border bg-panel/30 p-3">
					<p class="text-sm">
						<strong>{v.label}</strong> (id {v.id}) → parent {parent?.label} (id {parent?.id}) →
						grand-parent {grandparent?.label} (id {grandparent?.id})
					</p>
					<p class="mt-1 text-xs text-muted">
						Proposition : re-parenter <strong>{v.label}</strong> sous {grandparent?.label} (frère de {parent?.label}).
					</p>
					<button
						type="button"
						disabled={busy}
						class="mt-2 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
						onclick={async () => {
							const ok = await applyStep({
								kind: 'reparent',
								topicId: v.id,
								newParentId: grandparent?.id ?? null
							});
							if (ok) console.log('reparent applied for', v.id);
						}}
					>
						Appliquer
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
```

- [ ] **Step 2: Verify manually**

```bash
npm run dev
```

Open `/admin/migration`, click bucket 1. Expected: "✓ Aucune violation" (Task 1 already fixed topic 84). If a violation existed, it would show with an "Appliquer" button.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/migration/+page.svelte
git commit -m "feat(migration/bucket-1): depth-2 violation surface + one-click reparent"
```

---

## Task 14: Bucket 2 — inverted parent/child

**Files:**

- Modify: `src/routes/admin/migration/+page.svelte`

- [ ] **Step 1: Define the known inversions and render bucket 2 UI**

Replace the bucket-2 placeholder with:

```svelte
{#if activeBucket === 2}
  {@const KNOWN_INVERSIONS: { parentId: number; childId: number; reason: string }[] = [
    { parentId: 10, childId: 71, reason: "« Les Saintes Écritures » est plus général que « Le canon des Écritures »" },
    { parentId: 19, childId: 97, reason: "« Le péché » est plus général que « Le péché mortel »" }
  ]}
  {@const stillInverted = KNOWN_INVERSIONS.filter((inv) => {
    const child = topics.find((t) => t.id === inv.childId);
    return child != null && child.parentId === inv.parentId;
  })}
  {#if stillInverted.length === 0}
    <p class="rounded border border-emerald-600/40 bg-emerald-50/10 p-3 text-sm text-emerald-700">
      ✓ Aucune inversion détectée parmi celles connues.
    </p>
  {:else}
    <ul class="mt-4 space-y-3">
      {#each stillInverted as inv (inv.childId)}
        {@const parent = topics.find((t) => t.id === inv.parentId)}
        {@const child = topics.find((t) => t.id === inv.childId)}
        <li class="rounded border border-border bg-panel/30 p-3">
          <p class="text-sm">
            <strong>{child?.label}</strong> est enfant de <strong>{parent?.label}</strong>.
          </p>
          <p class="mt-1 text-xs text-muted">{inv.reason}</p>
          <p class="mt-1 text-xs text-muted">
            Proposition : permuter — {child?.label} devient parent ; {parent?.label} devient son aspect.
          </p>
          <button
            type="button"
            disabled={busy}
            class="mt-2 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
            onclick={() => applyStep({ kind: 'swap-parent-child', parentId: inv.parentId, childId: inv.childId })}
          >
            Permuter
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
```

- [ ] **Step 2: Verify manually**

Open `/admin/migration`, click bucket 2. Expected: 2 inversions surfaced ("Saintes Écritures" under "Canon", "péché" under "péché mortel"). Don't click "Permuter" yet — that triggers strict validation which will fail because of theme-with-quotes invariants. Validate visually only.

(The actual application of bucket 2 happens after bucket 4 converts the involved themes; until then, the swap may fail validation. The button surfaces; clicking it surfaces the error.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/migration/+page.svelte
git commit -m "feat(migration/bucket-2): surface known parent/child inversions"
```

---

## Task 15: Bucket 3 — orphan placement

**Files:**

- Modify: `src/routes/admin/migration/+page.svelte`

- [ ] **Step 1: Define orphan→theme proposals and render bucket 3 UI**

Replace the bucket-3 placeholder with:

```svelte
{#if activeBucket === 3}
  {@const ORPHAN_PROPOSALS: { orphanId: number; targetThemeLabel: string; targetThemeSlug: string }[] = [
    // Heresies
    { orphanId: 88, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    { orphanId: 89, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    { orphanId: 90, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    { orphanId: 91, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    { orphanId: 92, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    { orphanId: 93, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
    // Discipline chrétienne
    { orphanId: 136, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
    { orphanId: 137, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
    { orphanId: 135, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
    // Justice et devoir
    { orphanId: 133, targetThemeLabel: 'Justice et devoir', targetThemeSlug: 'justice-et-devoir' },
    { orphanId: 134, targetThemeLabel: 'Justice et devoir', targetThemeSlug: 'justice-et-devoir' },
    // Loi morale
    { orphanId: 132, targetThemeLabel: 'Loi morale', targetThemeSlug: 'loi-morale' },
    // Superstition
    { orphanId: 130, targetThemeLabel: 'Superstition', targetThemeSlug: 'superstition' },
    // Images saintes — credo or vie? defer
    { orphanId: 131, targetThemeLabel: 'Marie et les saints', targetThemeSlug: 'marie-et-les-saints' },
    // Sacrements général
    { orphanId: 142, targetThemeLabel: 'Les sacrements', targetThemeSlug: 'les-sacrements' },
    // L'âme
    { orphanId: 146, targetThemeLabel: 'Anthropologie chrétienne', targetThemeSlug: 'anthropologie-chretienne' }
  ]}
  <p class="text-sm text-muted">
    Suggestions de placement pour les racines orphelines (ajoutées récemment, encore sans thème).
    Vous pouvez ignorer ou éditer le thème cible. Création du thème = automatique si inexistant.
  </p>
  <p class="mt-2 text-xs text-amber-700">
    ⚠️ Bucket 3 nécessite que les thèmes cibles existent. En pratique, exécuter d'abord les
    conversions du Bucket 4 qui créent ces thèmes via leurs aspects principaux.
  </p>
  <ul class="mt-4 space-y-2">
    {#each ORPHAN_PROPOSALS as p (p.orphanId)}
      {@const orphan = topics.find((t) => t.id === p.orphanId)}
      {#if orphan && orphan.parentId == null}
        <li class="rounded border border-border bg-panel/30 p-2 text-sm">
          <span class="font-semibold">{orphan.label}</span>
          <span class="text-muted"> → thème « {p.targetThemeLabel} »</span>
        </li>
      {/if}
    {/each}
  </ul>
{/if}
```

(Note: bucket 3 is read-only for now. Actual placement happens via bucket 4 theme creation; once a target theme exists, the orphan gets re-parented via a direct `/admin/sujets` edit OR a future enhancement to this bucket that calls `applyStep({ kind: 'reparent', ... })`. Keep it informational in v1 to avoid scope creep.)

- [ ] **Step 2: Verify manually**

Open `/admin/migration`, click bucket 3. Expected: list of ~16 orphans with suggested themes.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/migration/+page.svelte
git commit -m "feat(migration/bucket-3): surface orphan placement proposals (read-only v1)"
```

---

## Task 16: Bucket 4 — theme designation (the main work)

**Files:**

- Modify: `src/routes/admin/migration/+page.svelte`

- [ ] **Step 1: Render bucket 4 — list of roots-with-quotes-and-children**

Replace the bucket-4 placeholder with:

```svelte
{#if activeBucket === 4}
	{@const rootsToConvert = topics
		.filter((t) => {
			if (t.parentId != null) return false;
			const hasChildren = topics.some((x) => x.parentId === t.id);
			const directQuoteCount = quotes.filter((q) => q.topicIds.includes(t.id)).length;
			return hasChildren && directQuoteCount > 0;
		})
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id)}
	<p class="text-sm text-muted">
		{rootsToConvert.length} racines avec enfants ET citations directes — à convertir en thèmes. Chaque
		conversion crée un « aspect principal » qui prendra les citations directes du parent.
	</p>
	<ul class="mt-4 space-y-4">
		{#each rootsToConvert as root (root.id)}
			{@const directQuoteCount = quotes.filter((q) => q.topicIds.includes(root.id)).length}
			{@const childCount = topics.filter((t) => t.parentId === root.id).length}
			<li class="rounded border border-border bg-panel/30 p-3">
				<p class="font-semibold">
					{root.label} <span class="text-xs font-normal text-muted">(id {root.id})</span>
				</p>
				<p class="mt-1 text-xs text-muted">
					{directQuoteCount} citation(s) directe(s) · {childCount} enfant(s) actuel(s)
				</p>
				<ThemeConversionForm
					{root}
					onApply={async (form) =>
						applyStep({
							kind: 'convert-root-to-theme',
							rootId: root.id,
							primaryAspect: {
								slug: form.primarySlug,
								label: form.primaryLabel,
								description: undefined
							},
							themeSlugOverride: form.themeSlug !== root.slug ? form.themeSlug : undefined,
							themeLabel: form.themeLabel !== root.label ? form.themeLabel : undefined
						})}
				/>
			</li>
		{/each}
	</ul>
{/if}
```

- [ ] **Step 2: Add the `ThemeConversionForm` sub-component inline**

At the top of `+page.svelte`'s `<script>`, add:

```ts
import ThemeConversionForm from './ThemeConversionForm.svelte';
```

- [ ] **Step 3: Create `src/routes/admin/migration/ThemeConversionForm.svelte`**

```svelte
<script lang="ts">
	import type { Topic } from '$lib/schema';

	let {
		root,
		onApply
	}: {
		root: Topic;
		onApply: (form: {
			themeLabel: string;
			themeSlug: string;
			primaryLabel: string;
			primarySlug: string;
		}) => Promise<boolean | void>;
	} = $props();

	// Defaults: theme keeps its slug/label; primary aspect inherits both
	let themeLabel = $state(root.label);
	let themeSlug = $state(root.slug);
	let primaryLabel = $state(root.label);
	let primarySlug = $state(root.slug + '-general');
	let busy = $state(false);
	let applied = $state(false);

	async function apply() {
		busy = true;
		try {
			const ok = await onApply({ themeLabel, themeSlug, primaryLabel, primarySlug });
			if (ok !== false) applied = true;
		} finally {
			busy = false;
		}
	}
</script>

{#if applied}
	<p class="mt-2 text-sm text-emerald-700">✓ Conversion appliquée</p>
{:else}
	<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
		<label class="block">
			Label du thème
			<input
				class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
				bind:value={themeLabel}
			/>
		</label>
		<label class="block">
			Slug du thème
			<input
				class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
				bind:value={themeSlug}
			/>
		</label>
		<label class="block">
			Label de l'aspect principal
			<input
				class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
				bind:value={primaryLabel}
			/>
		</label>
		<label class="block">
			Slug de l'aspect principal
			<input
				class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
				bind:value={primarySlug}
			/>
		</label>
	</div>
	<button
		type="button"
		disabled={busy}
		class="mt-3 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
		onclick={apply}
	>
		{busy ? 'Application…' : 'Convertir en thème'}
	</button>
{/if}
```

- [ ] **Step 4: Verify manually**

Open `/admin/migration`, click bucket 4. Expected: ~32 root cards each with editable fields and "Convertir en thème" button.

Click on one for a topic with simple structure (e.g. topic 43 "Le salut en dehors de l'Église" — 4 children, 18 quotes). Override the slugs if needed. Click Convertir. Expected: the conversion applies, quotes are rewritten to the new primary aspect, the topic disappears from the list (because it no longer has direct quotes).

If the apply fails, the error appears at the top of the page (via `lastError`).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/migration/+page.svelte src/routes/admin/migration/ThemeConversionForm.svelte
git commit -m "feat(migration/bucket-4): theme designation form — convert root-with-quotes to theme + primary aspect"
```

---

## Task 17: Bucket 5 — pillar review

**Files:**

- Modify: `src/routes/admin/migration/+page.svelte`

- [ ] **Step 1: Render bucket 5 — roots without a pillar, or with ambiguous pillar**

Replace the bucket-5 placeholder with:

```svelte
{#if activeBucket === 5}
	{@const PILLARS = [
		{ value: 'credo', label: 'Credo' },
		{ value: 'sacrements', label: 'Sacrements' },
		{ value: 'vie', label: 'Vie en Christ' },
		{ value: 'priere', label: 'Prière' }
	]}
	{@const noPillar = topics.filter((t) => t.parentId == null && t.pillar == null)}
	{#if noPillar.length === 0}
		<p class="rounded border border-emerald-600/40 bg-emerald-50/10 p-3 text-sm text-emerald-700">
			✓ Toutes les racines ont un pilier.
		</p>
	{:else}
		<p class="text-sm text-muted">{noPillar.length} racine(s) sans pilier.</p>
		<ul class="mt-4 space-y-2">
			{#each noPillar as t (t.id)}
				<li class="flex items-center gap-3 rounded border border-border bg-panel/30 p-2 text-sm">
					<span class="grow">{t.label}</span>
					{#each PILLARS as p (p.value)}
						<button
							type="button"
							disabled={busy}
							class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10 disabled:opacity-50"
							onclick={() => applyStep({ kind: 'set-pillar', topicId: t.id, pillar: p.value })}
						>
							{p.label}
						</button>
					{/each}
				</li>
			{/each}
		</ul>
	{/if}
{/if}
```

- [ ] **Step 2: Verify manually**

Open `/admin/migration`, click bucket 5. Expected: list of pillar-less roots (probably most of the orphan-import ones still have `pillar: credo` from earlier work — they may or may not appear). Clicking a pillar button applies.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/migration/+page.svelte
git commit -m "feat(migration/bucket-5): one-click pillar assignment for unclassified roots"
```

---

## Self-review checklist

After all 17 tasks are committed, run:

- [ ] **All tests pass**

```bash
npm test -- --run
```

Expected: all tests pass (schema, topic-tree, topic-helpers, plus any preexisting).

- [ ] **Type check clean**

```bash
npx svelte-check
```

Expected: 0 errors. (May surface warnings; those are okay if not regressions.)

- [ ] **Dev build works**

```bash
npm run dev
```

Visit `/sujets`, `/admin/sujets`, `/admin/hierarchie`, `/admin/migration`. All render.

- [ ] **Pre-migration data integrity verified**

The dev server's `/admin/sujets` should let you edit and save a topic without 400 errors. (Task 1 unblocked this.)

---

## Post-migration follow-up (out of scope for this plan)

After the user has worked through `/admin/migration` buckets 1-5 across multiple sessions and committed each step, a separate small plan will:

1. Switch `/admin/api/[entity]/+server.ts` to pass `quotes` to `validateParentRefs` (strict mode for all writes).
2. Delete `src/routes/admin/migration/` and its API endpoint.
3. Remove the Migration nav link.
4. Tag `post-taxonomy-redesign` for reference.

This is one short follow-up commit. Not included in this plan because the editorial work between the two is open-ended and user-paced.
