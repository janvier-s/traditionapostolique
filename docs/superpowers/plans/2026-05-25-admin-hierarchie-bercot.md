# Admin Hiérarchie + Bercot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two dev-only admin sections — `/admin/hierarchie` (CCC four-pillar visualization) and `/admin/bercot` (curation workspace for the 2,746 harvested patristic quotes) — so the user can re-architect the topic taxonomy and curate Bercot quotes one at a time over the coming months.

**Architecture:**
- JSON-backed data (extend Topic schema with `pillar` / `parentId` / `order`; new `bercot.json` ingested by the Python harvest script). All edits go through the existing `/admin/api/[entity]` REST pattern with Zod validation and atomic writes.
- Topic tree (one level of nesting) shared across Sujets editor, Hiérarchie viz, and Bercot topic picker via a small `topic-tree.ts` helper.
- Bercot lifecycle (`pending → kept → rejected → published`) drives a topic-centric workspace; publishing creates a new `Quote` in `quotes.json` with `status: 'draft'` linked back via `siteQuoteId`.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind, Zod, Vitest, Python 3 (`scripts/bercot-harvest.py`).

**Spec:** `docs/superpowers/specs/2026-05-25-admin-hierarchie-bercot-design.md`

---

## File Map

**Schema (new + modified):**
- `src/lib/schema/topic.ts` — extend with `pillar` / `parentId` / `order`
- `src/lib/schema/bercot.ts` — new
- `src/lib/schema/index.ts` — export new types
- `src/lib/schema/schema.test.ts` — new test blocks

**Data utilities (new):**
- `src/lib/admin/topic-tree.ts` — build & traverse a one-level topic tree
- `src/lib/admin/topic-tree.test.ts`

**API (modified + new):**
- `src/routes/admin/api/[entity]/+server.ts` — register `bercot`, add topic parentId validation
- `src/routes/admin/api/bercot/[id]/publish/+server.ts` — new endpoint to promote a Bercot entry to a site Quote

**Pages (modified + new):**
- `src/routes/admin/+layout.svelte` — add 2 nav links
- `src/routes/admin/sujets/+page.svelte` — Pillar / Parent / Ordre fields, tree-view sidebar
- `src/routes/admin/hierarchie/+page.svelte` — new, read-only 4-column viz
- `src/routes/admin/hierarchie/+page.ts` — load topics + quotes
- `src/routes/admin/bercot/+page.svelte` — new, topic-centric workspace
- `src/routes/admin/bercot/+page.ts` — load bercot.json + topics + authors + quotes
- `src/routes/admin/bercot/BercotCardEditor.svelte` — detail editor component
- `src/routes/admin/bercot/NewTopicFromBercot.svelte` — "Créer un sujet" modal

**Harvest script (modified):**
- `scripts/bercot-harvest.py` — add `--emit-json` (default) and `--emit-md` (opt-in); stable hash IDs; idempotent merge

**Data files:**
- `src/lib/data/topics.json` — passes new schema unchanged (`pillar` / `parentId` / `order` are all optional)
- `src/lib/data/bercot.json` — new (generated)

**Layout (modified):**
- `src/routes/admin/+layout.svelte` — nav additions

---

## Task 1: Extend Topic schema with pillar / parentId / order

**Files:**
- Modify: `src/lib/schema/topic.ts`
- Modify: `src/lib/schema/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests at the end of `src/lib/schema/schema.test.ts` (after the existing `TopicSchema` block):

```ts
describe('TopicSchema (pillar/parentId/order)', () => {
	it('accepts a topic with no pillar/parent/order', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'a',
				label: 'A',
				section: 'I',
				groupe: 'g'
			}).success
		).toBe(true);
	});
	it('accepts pillar credo|sacrements|vie|priere', () => {
		for (const pillar of ['credo', 'sacrements', 'vie', 'priere'] as const) {
			expect(
				TopicSchema.safeParse({
					id: 1,
					slug: 'a',
					label: 'A',
					section: 'I',
					groupe: 'g',
					pillar
				}).success
			).toBe(true);
		}
	});
	it('rejects unknown pillar', () => {
		expect(
			TopicSchema.safeParse({
				id: 1,
				slug: 'a',
				label: 'A',
				section: 'I',
				groupe: 'g',
				pillar: 'dogme'
			}).success
		).toBe(false);
	});
	it('accepts parentId and order as non-negative ints', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
				section: 'I',
				groupe: 'g',
				parentId: 1,
				order: 0
			}).success
		).toBe(true);
	});
	it('rejects negative parentId', () => {
		expect(
			TopicSchema.safeParse({
				id: 2,
				slug: 'b',
				label: 'B',
				section: 'I',
				groupe: 'g',
				parentId: -1
			}).success
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schema/schema.test.ts`
Expected: 5 tests fail (cannot find `pillar`, rejection cases pass spuriously, etc.)

- [ ] **Step 3: Extend the schema**

Replace `src/lib/schema/topic.ts` with:

```ts
import { z } from 'zod';
export const SectionSchema = z.enum(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']);
export type Section = z.infer<typeof SectionSchema>;

export const PillarSchema = z.enum(['credo', 'sacrements', 'vie', 'priere']);
export type Pillar = z.infer<typeof PillarSchema>;

export const TopicSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	label: z.string().min(1),
	section: SectionSchema,
	groupe: z.string().min(1),
	description: z.string().optional(),
	pillar: PillarSchema.optional(),
	parentId: z.number().int().nonnegative().optional(),
	order: z.number().int().optional()
});
export type Topic = z.infer<typeof TopicSchema>;
```

- [ ] **Step 4: Update `src/lib/schema/index.ts` exports**

Check the file. If it re-exports named exports from `./topic`, ensure `PillarSchema` and `Pillar` are included. If it uses `export *` then no edit needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/schema/schema.test.ts`
Expected: all tests pass, including the new 5 in the new describe block.

- [ ] **Step 6: Run the full type checker**

Run: `npm run check`
Expected: passes — `topics.json` still validates (new fields are optional).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema/topic.ts src/lib/schema/index.ts src/lib/schema/schema.test.ts
git commit -m "feat(schema): add pillar, parentId, order to TopicSchema"
```

---

## Task 2: Create BercotEntry schema

**Files:**
- Create: `src/lib/schema/bercot.ts`
- Modify: `src/lib/schema/index.ts`
- Modify: `src/lib/schema/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/schema/schema.test.ts`:

```ts
import { BercotEntrySchema } from './index';

describe('BercotEntrySchema', () => {
	const base = {
		id: 'a1b2c3d4e5f6',
		sourceEntry: 'ABORTION, INFANTICIDE',
		attribution: 'Tertullian (c. 197, W), 3.25.',
		en: 'In our case, murder is once for all forbidden.'
	};
	it('accepts a minimal pending entry', () => {
		const r = BercotEntrySchema.safeParse(base);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.status).toBe('pending');
			expect(r.data.mappedTopicIds).toEqual([]);
		}
	});
	it('accepts all optional fields filled', () => {
		expect(
			BercotEntrySchema.safeParse({
				...base,
				subsection: 'I. Meaning of baptism',
				fr: 'Le meurtre…',
				authorId: 7,
				sourceUrl: 'https://example.com/x',
				notes: 'check vol 3',
				mappedTopicIds: [20],
				siteQuoteId: 142,
				status: 'published',
				dedupMatch: 142
			}).success
		).toBe(true);
	});
	it('rejects non-hex id', () => {
		expect(BercotEntrySchema.safeParse({ ...base, id: 'NOT-A-HASH' }).success).toBe(false);
	});
	it('rejects unknown status', () => {
		expect(BercotEntrySchema.safeParse({ ...base, status: 'foo' }).success).toBe(false);
	});
	it('rejects malformed sourceUrl', () => {
		expect(BercotEntrySchema.safeParse({ ...base, sourceUrl: 'not a url' }).success).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schema/schema.test.ts`
Expected: imports fail (`BercotEntrySchema` does not exist).

- [ ] **Step 3: Create the schema file**

Create `src/lib/schema/bercot.ts`:

```ts
import { z } from 'zod';

export const BercotStatusSchema = z.enum(['pending', 'kept', 'rejected', 'published']);
export type BercotStatus = z.infer<typeof BercotStatusSchema>;

export const BercotEntrySchema = z.object({
	id: z.string().regex(/^[a-f0-9]{12}$/, 'must be a 12-char hex hash'),
	sourceEntry: z.string().min(1),
	subsection: z.string().optional(),
	attribution: z.string().min(1),
	en: z.string().min(1),

	fr: z.string().optional(),
	authorId: z.number().int().nonnegative().optional(),
	sourceUrl: z.string().url().optional(),
	notes: z.string().optional(),

	mappedTopicIds: z.array(z.number().int().nonnegative()).default([]),
	siteQuoteId: z.number().int().nonnegative().optional(),

	status: BercotStatusSchema.default('pending'),
	dedupMatch: z.number().int().nonnegative().optional()
});
export type BercotEntry = z.infer<typeof BercotEntrySchema>;
```

- [ ] **Step 4: Export from the schema index**

Append to `src/lib/schema/index.ts`:

```ts
export * from './bercot';
```

(If the file uses individual named re-exports, add the explicit `export { BercotEntrySchema, BercotStatusSchema, type BercotEntry, type BercotStatus } from './bercot';` instead.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/schema/schema.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema/bercot.ts src/lib/schema/index.ts src/lib/schema/schema.test.ts
git commit -m "feat(schema): add BercotEntry schema for the curation workspace"
```

---

## Task 3: Topic tree utility

**Files:**
- Create: `src/lib/admin/topic-tree.ts`
- Create: `src/lib/admin/topic-tree.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/topic-tree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Topic } from '$lib/schema';
import { buildTopicTree, flattenTree, validateParentRefs } from './topic-tree';

const t = (id: number, label: string, extras: Partial<Topic> = {}): Topic => ({
	id,
	slug: `t${id}`,
	label,
	section: 'I',
	groupe: 'g',
	...extras
});

describe('buildTopicTree', () => {
	it('returns top-level topics with empty children when no parents are set', () => {
		const tree = buildTopicTree([t(1, 'A'), t(2, 'B')]);
		expect(tree).toEqual([
			{ topic: t(1, 'A'), children: [] },
			{ topic: t(2, 'B'), children: [] }
		]);
	});
	it('nests sub-topics under their parent', () => {
		const tree = buildTopicTree([t(1, 'A'), t(2, 'A1', { parentId: 1 })]);
		expect(tree).toEqual([
			{
				topic: t(1, 'A'),
				children: [{ topic: t(2, 'A1', { parentId: 1 }), children: [] }]
			}
		]);
	});
	it('sorts siblings by order then id', () => {
		const tree = buildTopicTree([
			t(3, 'C', { order: 1 }),
			t(1, 'A', { order: 2 }),
			t(2, 'B') // no order
		]);
		expect(tree.map((n) => n.topic.id)).toEqual([3, 1, 2]);
	});
	it('drops orphan sub-topics (parent missing) and surfaces them at top level', () => {
		const tree = buildTopicTree([t(1, 'A', { parentId: 999 })]);
		expect(tree).toHaveLength(1);
		expect(tree[0].topic.id).toBe(1);
	});
});

describe('flattenTree', () => {
	it('returns topics with depth in DFS order', () => {
		const tree = buildTopicTree([t(1, 'A'), t(2, 'A1', { parentId: 1 }), t(3, 'B')]);
		const flat = flattenTree(tree);
		expect(flat.map((n) => [n.topic.id, n.depth])).toEqual([
			[1, 0],
			[2, 1],
			[3, 0]
		]);
	});
});

describe('validateParentRefs', () => {
	it('passes when parents are top-level', () => {
		const r = validateParentRefs([t(1, 'A'), t(2, 'A1', { parentId: 1 })]);
		expect(r.ok).toBe(true);
	});
	it('fails when a topic points at a sub-topic as parent (no 2-level nesting)', () => {
		const r = validateParentRefs([
			t(1, 'A'),
			t(2, 'A1', { parentId: 1 }),
			t(3, 'A1a', { parentId: 2 })
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/cannot nest under a sub-topic/);
	});
	it('fails when parentId does not exist', () => {
		const r = validateParentRefs([t(1, 'A', { parentId: 999 })]);
		expect(r.ok).toBe(false);
	});
	it('fails on self-reference', () => {
		const r = validateParentRefs([t(1, 'A', { parentId: 1 })]);
		expect(r.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin/topic-tree.test.ts`
Expected: import error (file does not exist).

- [ ] **Step 3: Implement the utility**

Create `src/lib/admin/topic-tree.ts`:

```ts
import type { Topic } from '$lib/schema';

export interface TopicNode {
	topic: Topic;
	children: TopicNode[];
}

export interface FlatNode {
	topic: Topic;
	depth: number;
}

function siblingSort(a: Topic, b: Topic): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao - bo;
	return a.id - b.id;
}

export function buildTopicTree(topics: Topic[]): TopicNode[] {
	const byId = new Map<number, Topic>();
	for (const t of topics) byId.set(t.id, t);

	const childrenByParent = new Map<number, Topic[]>();
	const roots: Topic[] = [];
	for (const t of topics) {
		if (t.parentId != null && byId.has(t.parentId) && t.parentId !== t.id) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		} else {
			// parentId missing/orphaned → treat as root
			roots.push(t);
		}
	}

	function buildNode(topic: Topic): TopicNode {
		const kids = (childrenByParent.get(topic.id) ?? []).slice().sort(siblingSort);
		return { topic, children: kids.map(buildNode) };
	}

	return roots.slice().sort(siblingSort).map(buildNode);
}

export function flattenTree(nodes: TopicNode[], depth = 0): FlatNode[] {
	const out: FlatNode[] = [];
	for (const n of nodes) {
		out.push({ topic: n.topic, depth });
		out.push(...flattenTree(n.children, depth + 1));
	}
	return out;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateParentRefs(topics: Topic[]): ValidateResult {
	const byId = new Map<number, Topic>();
	for (const t of topics) byId.set(t.id, t);
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
	return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin/topic-tree.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/topic-tree.ts src/lib/admin/topic-tree.test.ts
git commit -m "feat(admin): topic-tree utility for nested topic display"
```

---

## Task 4: Extend harvest script with --emit-json + stable IDs + idempotent merge

**Files:**
- Modify: `scripts/bercot-harvest.py`

- [ ] **Step 1: Add CLI argument parsing**

Near the top of `scripts/bercot-harvest.py`, after the `OUT = ...` line, add:

```python
import argparse
import hashlib

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Harvest the Bercot dictionary.")
    p.add_argument("--emit-json", action="store_true",
                   help="Emit src/lib/data/bercot.json (default if no flags).")
    p.add_argument("--emit-md", action="store_true",
                   help="Emit per-topic Markdown to docs/bercot-harvest/.")
    return p.parse_args()


BERCOT_JSON_PATH = REPO / "src/lib/data/bercot.json"


def stable_id(entry: str, subsection: str | None, attribution: str, en_text: str) -> str:
    payload = f"{entry}|{subsection or ''}|{attribution}|{en_text}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:12]
```

- [ ] **Step 2: Add an emit-json builder**

Add this function near the renderers (above `def main()`):

```python
def collect_json_rows(
    entries: dict,
    existing_quotes: list[dict],
    topics_by_slug: dict,
) -> list[dict]:
    """Walk MAPPING + CANDIDATES, materialize every harvested quote as a JSON row.

    Each row carries a stable hash id derived from (entry, subsection, attribution,
    english text). The same row id will reappear on re-runs as long as Bercot's
    text hasn't changed — user-edited fields can be merged in via merge_json_rows.
    """
    rows: list[dict] = []
    seen: set[str] = set()

    def emit_from(entry_view: dict, source_entry: str, subsection: str | None,
                  mapped_topic_ids: list[int]) -> None:
        for q in entry_view["quotes"]:
            rid = stable_id(source_entry, subsection, q["attribution"], q["text"])
            if rid in seen:
                continue
            seen.add(rid)
            dedup_match = find_dedup_match(q["text"], existing_quotes)
            row = {
                "id": rid,
                "sourceEntry": source_entry,
                "attribution": q["attribution"],
                "en": q["text"],
                "mappedTopicIds": list(mapped_topic_ids),
                "status": "pending",
            }
            if subsection:
                row["subsection"] = subsection
            if dedup_match is not None:
                row["dedupMatch"] = dedup_match
                row["siteQuoteId"] = dedup_match
                row["status"] = "published"
            rows.append(row)

    for slug, mapped in MAPPING.items():
        topic = topics_by_slug.get(slug)
        if topic is None:
            continue
        topic_id = topic["id"]
        for spec, _conf in mapped:
            display_title, view, _ = resolve_target(spec, entries)
            if view is None:
                continue
            if view["subsections"]:
                for sub in view["subsections"]:
                    emit_from({"quotes": sub["quotes"]}, display_title.split(" § ")[0],
                              sub["title"], [topic_id])
            else:
                base = display_title.split(" § ")[0]
                sub_title = display_title.split(" § ", 1)[1] if " § " in display_title else None
                emit_from(view, base, sub_title, [topic_id])

    consumed = {t for mapped in MAPPING.values() for t, _ in mapped}
    consumed_bases = {c.split("§")[0].strip() for c in consumed}
    for cand_title in CANDIDATES:
        if cand_title in consumed_bases:
            continue
        entry = entries.get(cand_title)
        if entry is None:
            continue
        if entry["subsections"]:
            for sub in entry["subsections"]:
                emit_from({"quotes": sub["quotes"]}, cand_title, sub["title"], [])
        else:
            emit_from(entry, cand_title, None, [])

    return rows


def merge_json_rows(fresh: list[dict], path: Path) -> list[dict]:
    """If a previous bercot.json exists, preserve user-edited fields per id.

    Preserved fields: fr, authorId, sourceUrl, notes, status (unless dedup forced
    'published' on first run), mappedTopicIds (the user may have customized).
    Refreshed fields: sourceEntry, subsection, attribution, en, dedupMatch.
    """
    if not path.exists():
        return fresh
    try:
        existing = json.loads(path.read_text())
    except Exception:
        return fresh
    by_id = {r["id"]: r for r in existing if isinstance(r, dict) and "id" in r}
    out: list[dict] = []
    for row in fresh:
        prev = by_id.get(row["id"])
        if prev is None:
            out.append(row)
            continue
        merged = dict(row)
        for field in ("fr", "authorId", "sourceUrl", "notes"):
            if field in prev:
                merged[field] = prev[field]
        # status: preserve user state unless it's the auto-published-by-dedup case
        if "status" in prev and prev["status"] != "pending":
            merged["status"] = prev["status"]
        if "siteQuoteId" in prev:
            merged["siteQuoteId"] = prev["siteQuoteId"]
        if "mappedTopicIds" in prev:
            merged["mappedTopicIds"] = prev["mappedTopicIds"]
        out.append(merged)
    return out
```

- [ ] **Step 3: Wire up `main()` to honor the flags**

Replace the bottom of `main()` (after `render_readme(...)`) with:

```python
        args = parse_args()
        emit_json = args.emit_json or not args.emit_md  # JSON is the default
        emit_md = args.emit_md

        if emit_md:
            # ... (existing per-topic + candidates + README emit, unchanged) ...
            pass  # leave the existing render block above this gated by emit_md

        if emit_json:
            rows = collect_json_rows(entries, existing, topics_by_slug)
            merged = merge_json_rows(rows, BERCOT_JSON_PATH)
            BERCOT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
            BERCOT_JSON_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
            print(f"\nEmitted {len(merged)} rows to {BERCOT_JSON_PATH}")
```

To gate the existing MD rendering: find the existing block that starts with
`print("[5/6] Rendering per-topic Markdown…")` through the `(OUT / "README.md").write_text(...)`
line, and wrap it inside `if emit_md:`. Pull `args = parse_args()` up to the top of `main()` so
both branches see it. Keep the entries-parsing and quote-loading steps (they're needed by both).

- [ ] **Step 4: Run the script in JSON mode**

Run: `python3 scripts/bercot-harvest.py --emit-json`
Expected: prints "Emitted N rows to .../bercot.json", file exists at `src/lib/data/bercot.json`.

- [ ] **Step 5: Verify idempotency**

Run: `python3 scripts/bercot-harvest.py --emit-json` (again).
Run: `wc -c src/lib/data/bercot.json` twice across runs.
Expected: same byte count on the second run (no churn).

- [ ] **Step 6: Verify merge preserves user edits**

Run in shell:
```bash
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("src/lib/data/bercot.json")
data = json.loads(p.read_text())
data[0]["fr"] = "TEST FR"
data[0]["notes"] = "TEST NOTE"
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
PY
python3 scripts/bercot-harvest.py --emit-json
python3 - <<'PY'
import json
data = json.loads(open("src/lib/data/bercot.json").read())
assert data[0]["fr"] == "TEST FR", data[0].get("fr")
assert data[0]["notes"] == "TEST NOTE", data[0].get("notes")
print("merge OK")
PY
```
Expected: prints "merge OK".

Then revert the test edit:
```bash
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("src/lib/data/bercot.json")
data = json.loads(p.read_text())
data[0].pop("fr", None)
data[0].pop("notes", None)
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
PY
```

- [ ] **Step 7: Commit**

```bash
git add scripts/bercot-harvest.py src/lib/data/bercot.json
git commit -m "feat(harvest): emit bercot.json with stable IDs + idempotent merge"
```

---

## Task 5: Register `bercot` entity in the admin API + topic parent validation

**Files:**
- Modify: `src/routes/admin/api/[entity]/+server.ts`

- [ ] **Step 1: Read the current file**

The current `+server.ts` registers `authors`, `works`, `topics`, `quotes`. We extend it.

- [ ] **Step 2: Replace the imports and FILE / SCHEMA maps**

Replace lines 1–21 of `src/routes/admin/api/[entity]/+server.ts` with:

```ts
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { validateParentRefs } from '$lib/admin/topic-tree';
import {
	AuthorSchema,
	WorkSchema,
	TopicSchema,
	QuoteSchema,
	BercotEntrySchema,
	type Topic
} from '$lib/schema';

const FILE: Record<string, string> = {
	authors: 'authors.json',
	works: 'works.json',
	topics: 'topics.json',
	quotes: 'quotes.json',
	bercot: 'bercot.json'
};

const SCHEMA: Record<string, z.ZodTypeAny> = {
	authors: AuthorSchema,
	works: WorkSchema,
	topics: TopicSchema,
	quotes: QuoteSchema,
	bercot: BercotEntrySchema
};
```

- [ ] **Step 3: Add topic-specific parent validation in PUT**

Find the `PUT` export. After the line `if (!parsed.success) throw error(400, JSON.stringify(parsed.error.issues));`, insert:

```ts
	if (params.entity === 'topics') {
		const refs = validateParentRefs(parsed.data as Topic[]);
		if (!refs.ok) throw error(400, refs.error);
	}
```

- [ ] **Step 4: Sanity-check dev mode**

Run: `npm run dev` (in another terminal if needed).
Visit `http://localhost:5173/admin/api/bercot` — should return the JSON array.
Hit Ctrl-C to stop.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/api/[entity]/+server.ts
git commit -m "feat(admin/api): register bercot entity + validate topic parent refs"
```

---

## Task 6: Bercot → Quote publication endpoint

**Files:**
- Create: `src/routes/admin/api/bercot/[id]/publish/+server.ts`

- [ ] **Step 1: Create the file**

```ts
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { BercotEntrySchema, QuoteSchema, type BercotEntry, type Quote } from '$lib/schema';

function assertDev() {
	if (!dev) throw error(404);
}

function dataPath(file: string) {
	return join(process.cwd(), 'src/lib/data', file);
}

function readJson<T>(file: string): T {
	return JSON.parse(readFileSync(dataPath(file), 'utf-8')) as T;
}

function nextQuoteId(quotes: Quote[]): number {
	let max = 0;
	for (const q of quotes) if (q.id > max) max = q.id;
	return max + 1;
}

export async function POST({ params }) {
	assertDev();
	const bercotAll = readJson<unknown[]>('bercot.json')
		.map((row) => BercotEntrySchema.parse(row));
	const idx = bercotAll.findIndex((b) => b.id === params.id);
	if (idx === -1) throw error(404, `Bercot entry ${params.id} not found`);
	const entry: BercotEntry = bercotAll[idx];

	if (!entry.fr || entry.fr.trim() === '') throw error(400, 'French translation required');
	if (entry.authorId == null) throw error(400, 'authorId required');
	if (entry.mappedTopicIds.length === 0) throw error(400, 'at least one topic required');
	if (entry.status !== 'kept') throw error(400, 'entry must be in status "kept" before publishing');
	if (entry.siteQuoteId != null) throw error(400, `already published as quote ${entry.siteQuoteId}`);

	const quotes = readJson<unknown[]>('quotes.json').map((q) => QuoteSchema.parse(q));
	const newId = nextQuoteId(quotes);
	const newQuote: Quote = QuoteSchema.parse({
		id: newId,
		slug: `citation-${newId}`,
		authorId: entry.authorId,
		topicIds: entry.mappedTopicIds,
		reference: entry.attribution,
		fr: entry.fr,
		en: entry.en,
		notes: entry.notes,
		links: entry.sourceUrl ? { primary: entry.sourceUrl } : {},
		status: 'draft'
	});

	quotes.push(newQuote);
	atomicWriteJson(dataPath('quotes.json'), quotes);

	bercotAll[idx] = { ...entry, status: 'published', siteQuoteId: newId };
	atomicWriteJson(dataPath('bercot.json'), bercotAll);

	return json({ ok: true, quote: newQuote, bercot: bercotAll[idx] });
}
```

- [ ] **Step 2: Smoke-test the endpoint shape**

Manually edit one bercot row in `src/lib/data/bercot.json` to have `fr`, `authorId`, `mappedTopicIds`, and `status: 'kept'` (just to verify the endpoint works). Then with `npm run dev` running:

```bash
curl -X POST http://localhost:5173/admin/api/bercot/<that-id>/publish
```

Expected: 200, response includes the new quote object. Verify a new entry appeared in `src/lib/data/quotes.json` and the Bercot entry now has `status: 'published'` + `siteQuoteId`.

Then revert the test (delete the new quote entry, set the bercot entry back to `pending`).

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/api/bercot/
git commit -m "feat(admin/api): publish Bercot entry as a draft Quote"
```

---

## Task 7: Admin layout nav additions

**Files:**
- Modify: `src/routes/admin/+layout.svelte`

- [ ] **Step 1: Replace the nav**

Replace the file contents with:

```svelte
<script lang="ts">
	let { children } = $props();
</script>

<div class="px-6 py-6">
	<nav class="mb-6 flex gap-4 border-b border-border pb-2 font-ui text-sm">
		<a href="/admin">Accueil</a>
		<a href="/admin/auteurs">Auteurs</a>
		<a href="/admin/oeuvres">Œuvres</a>
		<a href="/admin/sujets">Sujets</a>
		<a href="/admin/hierarchie">Hiérarchie</a>
		<a href="/admin/citations">Citations</a>
		<a href="/admin/bercot">Bercot</a>
		<a href="/admin/gaps">Gaps</a>
	</nav>
	{@render children()}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin/+layout.svelte
git commit -m "feat(admin): add Hiérarchie and Bercot nav links"
```

---

## Task 8: Sujets editor — Pillar / Parent / Ordre fields + tree-view sidebar

**Files:**
- Modify: `src/routes/admin/sujets/+page.svelte`

- [ ] **Step 1: Replace the script section**

Replace the `<script lang="ts">` block at the top of `src/routes/admin/sujets/+page.svelte` (everything between `<script lang="ts">` and `</script>`) with:

```ts
import { onMount } from 'svelte';
import type { Quote, Section, Topic, Pillar } from '$lib/schema';
import { watchHashSelection } from '../hash-select';
import { bindEditorShortcuts } from '../editor-utils.svelte';
import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';

let items = $state<Topic[]>([]);
let quotes = $state<Quote[]>([]);
let selectedIdx = $state(-1);
let dirty = $state(false);
let search = $state('');
let saveError = $state('');
let saving = $state(false);

const SECTIONS: Section[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const PILLARS: { value: Pillar; label: string }[] = [
	{ value: 'credo', label: 'Credo — Profession de la foi (CCC I)' },
	{ value: 'sacrements', label: 'Sacrements et liturgie (CCC II)' },
	{ value: 'vie', label: 'Vie en Christ — Morale (CCC III)' },
	{ value: 'priere', label: 'Prière (CCC IV)' }
];

onMount(async () => {
	const [t, q] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json()),
		fetch('/admin/api/quotes').then((r) => r.json())
	]);
	items = t;
	quotes = q;
});

$effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

const quoteCountByTopic = $derived.by(() => {
	const m = new Map<number, number>();
	for (const q of quotes) for (const tid of q.topicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
	return m;
});

// Sidebar list: tree-flattened, search filters at any depth (matches descendants too)
const flat = $derived.by(() => flattenTree(buildTopicTree(items)));
const filtered = $derived.by(() => {
	const q = search.trim().toLowerCase();
	if (!q) return flat.map((n) => ({ ...n, idx: items.findIndex((t) => t.id === n.topic.id) }));
	return flat
		.filter((n) => n.topic.label.toLowerCase().includes(q))
		.map((n) => ({ ...n, idx: items.findIndex((t) => t.id === n.topic.id) }));
});

// Available parents: only top-level topics, excluding the current one
const parentOptions = $derived.by(() => {
	if (!selected) return items.filter((t) => t.parentId == null);
	return items.filter((t) => t.parentId == null && t.id !== selected.id);
});

const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);
const selectedIsTopLevel = $derived(selected?.parentId == null);
const selectedQuotes = $derived(
	selected ? quotes.filter((q) => q.topicIds.includes(selected.id)) : []
);

function update<K extends keyof Topic>(key: K, value: Topic[K]) {
	if (!selected) return;
	items[selectedIdx] = { ...selected, [key]: value };
	dirty = true;
}

let savedFlash = $state(false);
async function save() {
	saving = true;
	saveError = '';
	try {
		const res = await fetch('/admin/api/topics', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(items)
		});
		if (!res.ok) {
			saveError = await res.text();
			return;
		}
		dirty = false;
		savedFlash = true;
		setTimeout(() => (savedFlash = false), 1500);
	} finally {
		saving = false;
	}
}

$effect(() => bindEditorShortcuts({ isDirty: () => dirty, isSaving: () => saving, save }));

const INPUT = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
```

- [ ] **Step 2: Replace the sidebar list block**

In the template, find the `<ul class="mt-2 max-h-[70vh] overflow-y-auto">…</ul>` block and replace it with:

```svelte
<ul class="mt-2 max-h-[70vh] overflow-y-auto">
	{#each filtered as { topic: t, depth, idx } (t.id)}
		{@const n = quoteCountByTopic.get(t.id) ?? 0}
		<li id={`row-${t.id}`}>
			<button
				type="button"
				onclick={() => {
					selectedIdx = idx;
				}}
				class={[
					'block w-full rounded px-2 py-1 text-left hover:bg-subtle/10',
					selectedIdx === idx && 'bg-subtle/20'
				]}
				style={depth > 0 ? `padding-left: ${0.5 + depth * 1}rem` : ''}
			>
				<span class="flex items-baseline justify-between gap-2">
					<span class="min-w-0 truncate" class:text-muted={n === 0}>
						{#if depth > 0}<span class="mr-1 text-muted">↳</span>{/if}
						{t.label}
						<span class="ml-1 text-xs text-muted">{t.section}</span>
					</span>
					<span class="shrink-0 font-ui text-[11px] font-light text-muted">{n || '—'}</span>
				</span>
			</button>
		</li>
	{/each}
</ul>
```

- [ ] **Step 3: Add Pillar / Parent / Ordre fields to the form**

Inside the `<form>` block, after the existing **Groupe** input but before **Description**, insert:

```svelte
<label class="block">
	Parent
	<select
		class={INPUT}
		value={selected.parentId ?? ''}
		onchange={(e) => {
			const v = (e.currentTarget as HTMLSelectElement).value;
			update('parentId', v === '' ? undefined : Number(v));
		}}
	>
		<option value="">(racine — sujet de premier niveau)</option>
		{#each parentOptions as p (p.id)}
			<option value={p.id}>{p.label}</option>
		{/each}
	</select>
</label>
{#if selectedIsTopLevel}
	<label class="block">
		Pilier (CCC)
		<select
			class={INPUT}
			value={selected.pillar ?? ''}
			onchange={(e) => {
				const v = (e.currentTarget as HTMLSelectElement).value as Pillar | '';
				update('pillar', v === '' ? undefined : v);
			}}
		>
			<option value="">(non classé)</option>
			{#each PILLARS as p (p.value)}
				<option value={p.value}>{p.label}</option>
			{/each}
		</select>
	</label>
{:else}
	<p class="text-xs italic text-muted">
		Pilier hérité du sujet parent.
	</p>
{/if}
<label class="block">
	Ordre
	<input
		type="number"
		class={INPUT}
		value={selected.order ?? ''}
		oninput={(e) => {
			const v = (e.currentTarget as HTMLInputElement).value;
			update('order', v === '' ? undefined : Number(v));
		}}
	/>
</label>
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`, visit `http://localhost:5173/admin/sujets`. Check:
- Sidebar renders as a tree (all flat for now, since no topic has a parent yet — should match current behaviour).
- Selecting a topic shows the new Parent / Pilier / Ordre fields.
- Setting Parent on a topic and saving works without error.
- Search still works.
- ⌘/Ctrl-S still saves.

Pick one topic (e.g. "Marie pleine de grâce") and set its parent to another topic (e.g. "Marie toujours vierge"), save, refresh — verify it appears nested. Then undo via the dropdown.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/sujets/+page.svelte
git commit -m "feat(admin/sujets): pillar + parent + order fields, tree sidebar"
```

---

## Task 9: Hiérarchie visualization page

**Files:**
- Create: `src/routes/admin/hierarchie/+page.svelte`
- Create: `src/routes/admin/hierarchie/+page.ts`

- [ ] **Step 1: Create the loader**

`src/routes/admin/hierarchie/+page.ts`:

```ts
import type { Topic, Quote } from '$lib/schema';

export async function load({ fetch }) {
	const [topics, quotes] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
		fetch('/admin/api/quotes').then((r) => r.json() as Promise<Quote[]>)
	]);
	return { topics, quotes };
}
```

- [ ] **Step 2: Create the page**

`src/routes/admin/hierarchie/+page.svelte`:

```svelte
<script lang="ts">
	import type { Pillar, Topic } from '$lib/schema';
	import { buildTopicTree, type TopicNode } from '$lib/admin/topic-tree';

	let { data } = $props();

	const PILLARS: { value: Pillar; label: string; sub: string }[] = [
		{ value: 'credo', label: 'Credo', sub: 'Profession de la foi (CCC I)' },
		{ value: 'sacrements', label: 'Sacrements', sub: 'Célébration du mystère chrétien (CCC II)' },
		{ value: 'vie', label: 'Vie en Christ', sub: 'La vie dans le Christ (CCC III)' },
		{ value: 'priere', label: 'Prière', sub: 'La prière chrétienne (CCC IV)' }
	];

	const tree = $derived(buildTopicTree(data.topics));

	const quotesPerTopic = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of data.quotes) for (const tid of q.topicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
		return m;
	});

	function descendantQuoteCount(node: TopicNode): number {
		let n = quotesPerTopic.get(node.topic.id) ?? 0;
		for (const child of node.children) n += descendantQuoteCount(child);
		return n;
	}

	const byPillar = $derived.by(() => {
		const groups: Record<string, TopicNode[]> = {
			credo: [],
			sacrements: [],
			vie: [],
			priere: [],
			none: []
		};
		for (const node of tree) {
			const k = node.topic.pillar ?? 'none';
			groups[k].push(node);
		}
		return groups;
	});
</script>

<h1 class="font-heading text-2xl">Hiérarchie ({data.topics.length} sujets)</h1>
<p class="mt-2 text-sm text-muted">
	Vue par les quatre piliers du <em>Catéchisme de l'Église catholique</em>. Lecture seule —
	modifiez le pilier d'un sujet depuis <a class="underline-offset-4 hover:underline" href="/admin/sujets">Sujets</a>.
</p>

<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
	{#each PILLARS as p (p.value)}
		<section class="rounded border border-border bg-panel/30 p-3">
			<h2 class="font-heading text-base">{p.label}</h2>
			<p class="text-[11px] uppercase tracking-wider text-muted">{p.sub}</p>
			<p class="mt-1 text-xs text-muted">{byPillar[p.value].length} sujet(s)</p>
			<ul class="mt-3 space-y-2">
				{#each byPillar[p.value] as node (node.topic.id)}
					{@const n = descendantQuoteCount(node)}
					<li>
						<a
							href={`/admin/sujets#row-${node.topic.id}`}
							class="block rounded border border-border bg-background px-2 py-1 hover:bg-subtle/10"
						>
							<span class="flex items-baseline justify-between gap-2 text-sm">
								<span class="min-w-0 truncate">{node.topic.label}</span>
								<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
							</span>
							{#if node.topic.groupe}
								<span class="text-[10px] uppercase tracking-wider text-muted">{node.topic.groupe}</span>
							{/if}
						</a>
						{#if node.children.length > 0}
							<ul class="ml-3 mt-1 space-y-1 border-l border-border pl-2">
								{#each node.children as child (child.topic.id)}
									{@const cn = quotesPerTopic.get(child.topic.id) ?? 0}
									<li>
										<a
											href={`/admin/sujets#row-${child.topic.id}`}
											class="block rounded px-1 py-0.5 hover:bg-subtle/10"
										>
											<span class="flex items-baseline justify-between gap-2 text-xs">
												<span class="min-w-0 truncate">↳ {child.topic.label}</span>
												<span class="shrink-0 text-[10px] text-muted">{cn || '—'}</span>
											</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
				{#if byPillar[p.value].length === 0}
					<li class="text-xs italic text-muted">(aucun sujet)</li>
				{/if}
			</ul>
		</section>
	{/each}
	<section class="rounded border border-dashed border-border bg-panel/10 p-3">
		<h2 class="font-heading text-base">Non classé</h2>
		<p class="text-[11px] uppercase tracking-wider text-muted">Sujets sans pilier assigné</p>
		<p class="mt-1 text-xs text-muted">{byPillar.none.length} sujet(s)</p>
		<ul class="mt-3 space-y-2">
			{#each byPillar.none as node (node.topic.id)}
				{@const n = descendantQuoteCount(node)}
				<li>
					<a
						href={`/admin/sujets#row-${node.topic.id}`}
						class="block rounded border border-border bg-background px-2 py-1 hover:bg-subtle/10"
					>
						<span class="flex items-baseline justify-between gap-2 text-sm">
							<span class="min-w-0 truncate">{node.topic.label}</span>
							<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</div>
```

- [ ] **Step 3: Smoke-test**

Run `npm run dev`, visit `/admin/hierarchie`. Verify five columns render, all 49 topics appear in "Non classé" (since none have a `pillar` yet), and clicking a card jumps to the corresponding row in `/admin/sujets`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/hierarchie/
git commit -m "feat(admin): /admin/hierarchie — CCC four-pillar visualization"
```

---

## Task 10: Bercot workspace — page scaffold + topic picker + counts

**Files:**
- Create: `src/routes/admin/bercot/+page.ts`
- Create: `src/routes/admin/bercot/+page.svelte`

- [ ] **Step 1: Loader**

`src/routes/admin/bercot/+page.ts`:

```ts
import type { Author, Quote, Topic, BercotEntry } from '$lib/schema';

export async function load({ fetch }) {
	const [topics, quotes, authors, bercot] = await Promise.all([
		fetch('/admin/api/topics').then((r) => r.json() as Promise<Topic[]>),
		fetch('/admin/api/quotes').then((r) => r.json() as Promise<Quote[]>),
		fetch('/admin/api/authors').then((r) => r.json() as Promise<Author[]>),
		fetch('/admin/api/bercot').then((r) => r.json() as Promise<BercotEntry[]>)
	]);
	return { topics, quotes, authors, bercot };
}
```

- [ ] **Step 2: Page scaffold**

`src/routes/admin/bercot/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import type { BercotEntry, BercotStatus, Topic } from '$lib/schema';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';

	let { data } = $props();

	type View = 'topic' | 'ungrouped';
	let view = $state<View>('topic');
	let selectedTopicId = $state<number | null>(null);
	let statusFilter = $state<BercotStatus | 'all'>('all');
	let search = $state('');

	// Stats across all bercot entries
	const stats = $derived.by(() => {
		const acc: Record<BercotStatus | 'total', number> = {
			total: 0,
			pending: 0,
			kept: 0,
			rejected: 0,
			published: 0
		};
		for (const b of data.bercot) {
			acc.total++;
			acc[b.status]++;
		}
		return acc;
	});

	// Topic tree flattened for the sidebar
	const topicFlat = $derived.by(() => flattenTree(buildTopicTree(data.topics)));
	const topicFiltered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return topicFlat;
		return topicFlat.filter((n) => n.topic.label.toLowerCase().includes(q));
	});

	const bercotCountByTopic = $derived.by(() => {
		const m = new Map<number, number>();
		for (const b of data.bercot) {
			for (const tid of b.mappedTopicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
		}
		return m;
	});

	const selectedTopic = $derived(
		selectedTopicId != null ? data.topics.find((t) => t.id === selectedTopicId) ?? null : null
	);

	const candidatesForTopic = $derived.by(() => {
		if (!selectedTopic) return [];
		return data.bercot.filter(
			(b) =>
				b.mappedTopicIds.includes(selectedTopic.id) &&
				(statusFilter === 'all' || b.status === statusFilter)
		);
	});
	const siteQuotesForTopic = $derived.by(() => {
		if (!selectedTopic) return [];
		return data.quotes.filter((q) => q.topicIds.includes(selectedTopic.id));
	});

	const ungroupedEntries = $derived(data.bercot.filter((b) => b.mappedTopicIds.length === 0));
	const ungroupedBySource = $derived.by(() => {
		const m = new Map<string, BercotEntry[]>();
		for (const b of ungroupedEntries) {
			const k = b.sourceEntry;
			const arr = m.get(k) ?? [];
			arr.push(b);
			m.set(k, arr);
		}
		return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
	});

	const STATUS_LABEL: Record<BercotStatus | 'all', string> = {
		all: 'Tous',
		pending: 'À examiner',
		kept: 'Retenus',
		rejected: 'Rejetés',
		published: 'Publiés'
	};
	const STATUS_TONE: Record<BercotStatus, string> = {
		pending: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
		kept: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
		rejected: 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30',
		published: 'bg-sky-500/15 text-sky-700 border-sky-500/30'
	};
</script>

<h1 class="font-heading text-2xl">Bercot ({stats.total})</h1>
<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
	<span><strong class="text-fg">{stats.pending}</strong> en attente</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.kept}</strong> retenus</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.rejected}</strong> rejetés</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.published}</strong> publiés</span>
</div>

<div class="mt-4 flex gap-2 border-b border-border pb-2 text-sm">
	<button
		type="button"
		onclick={() => (view = 'topic')}
		class={['rounded px-2 py-1', view === 'topic' && 'bg-subtle/20']}>Par sujet</button
	>
	<button
		type="button"
		onclick={() => (view = 'ungrouped')}
		class={['rounded px-2 py-1', view === 'ungrouped' && 'bg-subtle/20']}
		>Non rattachés ({ungroupedEntries.length})</button
	>
</div>

{#if view === 'topic'}
	<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
		<aside class="border-r border-border pr-4">
			<input
				type="search"
				placeholder="Filtrer les sujets…"
				bind:value={search}
				class="w-full rounded border border-border bg-panel px-2 py-1 text-sm"
			/>
			<ul class="mt-2 max-h-[70vh] overflow-y-auto">
				{#each topicFiltered as { topic: t, depth } (t.id)}
					{@const n = bercotCountByTopic.get(t.id) ?? 0}
					<li>
						<button
							type="button"
							onclick={() => (selectedTopicId = t.id)}
							class={[
								'block w-full rounded px-2 py-1 text-left text-sm hover:bg-subtle/10',
								selectedTopicId === t.id && 'bg-subtle/20'
							]}
							style={depth > 0 ? `padding-left: ${0.5 + depth * 1}rem` : ''}
						>
							<span class="flex items-baseline justify-between gap-2">
								<span class="min-w-0 truncate" class:text-muted={n === 0}>
									{#if depth > 0}<span class="mr-1 text-muted">↳</span>{/if}
									{t.label}
								</span>
								<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</aside>

		<div>
			{#if !selectedTopic}
				<p class="italic text-muted">Sélectionnez un sujet pour voir les citations rattachées.</p>
			{:else}
				<header class="mb-4">
					<h2 class="font-heading text-xl">{selectedTopic.label}</h2>
					<p class="text-xs text-muted">
						{siteQuotesForTopic.length} citation(s) en ligne · {candidatesForTopic.length} candidat(s)
						Bercot
					</p>
				</header>

				<details class="mb-4 rounded border border-border bg-panel/30 p-3 text-sm">
					<summary class="cursor-pointer font-ui uppercase tracking-wider text-muted">
						Citations en ligne ({siteQuotesForTopic.length})
					</summary>
					<ul class="mt-2 max-h-60 space-y-1 overflow-y-auto">
						{#each siteQuotesForTopic as q (q.id)}
							<li class="truncate">
								<a
									href={`/admin/citations#${q.id}`}
									class="hover:text-accent hover:underline"
								>
									<span class="text-xs text-muted">#{q.id}</span>
									{(q.fr ?? q.en ?? '(vide)').replace(/\s+/g, ' ').slice(0, 100)}
								</a>
							</li>
						{/each}
					</ul>
				</details>

				<div class="mb-3 flex flex-wrap gap-1 text-xs">
					{#each ['all', 'pending', 'kept', 'rejected', 'published'] as s (s)}
						<button
							type="button"
							onclick={() => (statusFilter = s as BercotStatus | 'all')}
							class={[
								'rounded border border-border px-2 py-0.5',
								statusFilter === s ? 'bg-subtle/20' : 'hover:bg-subtle/10'
							]}
						>
							{STATUS_LABEL[s as keyof typeof STATUS_LABEL]}
						</button>
					{/each}
				</div>

				<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
					{#each candidatesForTopic as b (b.id)}
						<article class="rounded border border-border bg-panel/30 p-3 text-sm">
							<div class="mb-1 flex items-center justify-between gap-2">
								<span class="text-[10px] uppercase tracking-wider text-muted">
									{b.sourceEntry}{b.subsection ? ` · ${b.subsection}` : ''}
								</span>
								<span class={['rounded border px-1.5 py-0.5 text-[10px]', STATUS_TONE[b.status]]}>
									{STATUS_LABEL[b.status]}
								</span>
							</div>
							<p class="line-clamp-3 leading-snug">{b.en}</p>
							<p class="mt-2 text-[11px] text-muted">{b.attribution}</p>
							{#if b.siteQuoteId != null}
								<p class="mt-1 text-[11px] text-sky-700">
									→ <a class="underline" href={`/admin/citations#${b.siteQuoteId}`}>quote #{b.siteQuoteId}</a>
								</p>
							{/if}
						</article>
					{/each}
					{#if candidatesForTopic.length === 0}
						<p class="text-sm italic text-muted">Aucun candidat Bercot pour ce filtre.</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="mt-4">
		<p class="mb-3 text-sm text-muted">
			Entrées du dictionnaire de Bercot qui ne sont rattachées à aucun sujet existant. Groupées
			par entrée d'origine — créez un nouveau sujet à partir de chacune si elle vous intéresse.
		</p>
		<ul class="space-y-3">
			{#each ungroupedBySource as [entry, items] (entry)}
				<li class="rounded border border-border bg-panel/30 p-3">
					<header class="mb-2 flex items-baseline justify-between gap-2">
						<h3 class="font-heading text-base">{entry}</h3>
						<span class="text-xs text-muted">{items.length} citation(s)</span>
					</header>
					<ul class="space-y-1 text-sm">
						{#each items.slice(0, 3) as b (b.id)}
							<li class="truncate text-muted">"{b.en.slice(0, 120)}…"</li>
						{/each}
						{#if items.length > 3}
							<li class="text-xs italic text-muted">… +{items.length - 3} de plus</li>
						{/if}
					</ul>
					<!-- "Créer un sujet" button wired up in Task 13 -->
				</li>
			{/each}
		</ul>
	</div>
{/if}
```

- [ ] **Step 3: Smoke-test**

Run `npm run dev`, visit `/admin/bercot`. Verify:
- Top stats show non-zero numbers.
- Topic sidebar lists all 49 topics with Bercot candidate counts.
- Selecting a topic shows existing site quotes (collapsible) and Bercot candidate cards.
- Status filter chips work.
- Switching to "Non rattachés" shows candidate entries grouped by source name (HYPOSTATIC UNION, MARTYRDOM, etc.).

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/bercot/
git commit -m "feat(admin/bercot): topic-centric workspace scaffold"
```

---

## Task 11: Bercot detail editor (card → side-panel)

**Files:**
- Create: `src/routes/admin/bercot/BercotCardEditor.svelte`
- Modify: `src/routes/admin/bercot/+page.svelte`

- [ ] **Step 1: Create the editor component**

`src/routes/admin/bercot/BercotCardEditor.svelte`:

```svelte
<script lang="ts">
	import type { Author, BercotEntry, BercotStatus, Topic } from '$lib/schema';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';

	type Props = {
		entry: BercotEntry;
		entries: BercotEntry[];           // siblings (for prev/next within current filter)
		topics: Topic[];
		authors: Author[];
		onClose: () => void;
		onSaved: (updated: BercotEntry) => void;
		onPublished: (updated: BercotEntry, newQuoteId: number) => void;
		onNavigate: (delta: -1 | 1) => void;
	};
	let { entry, entries, topics, authors, onClose, onSaved, onPublished, onNavigate }: Props = $props();

	// Local mutable copy
	let draft = $state({ ...entry });
	let dirty = $state(false);
	let saving = $state(false);
	let saveError = $state('');

	// Reset when the parent swaps `entry` (next/prev navigation)
	$effect(() => {
		draft = { ...entry };
		dirty = false;
		saveError = '';
	});

	const topicFlat = $derived(flattenTree(buildTopicTree(topics)));
	const authorOptions = $derived(authors.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')));

	function update<K extends keyof BercotEntry>(key: K, value: BercotEntry[K]) {
		draft = { ...draft, [key]: value };
		dirty = true;
	}

	function toggleTopic(id: number) {
		const has = draft.mappedTopicIds.includes(id);
		update(
			'mappedTopicIds',
			has ? draft.mappedTopicIds.filter((x) => x !== id) : [...draft.mappedTopicIds, id]
		);
	}

	async function save(): Promise<BercotEntry | null> {
		saving = true;
		saveError = '';
		try {
			// Re-fetch the canonical array so we don't clobber writes from elsewhere,
			// then splice in our draft and PUT the whole thing (API does a full replace).
			const allBercot = (await fetch('/admin/api/bercot').then((r) => r.json())) as BercotEntry[];
			const merged = allBercot.map((b) => (b.id === draft.id ? draft : b));
			const res = await fetch('/admin/api/bercot', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(merged)
			});
			if (!res.ok) {
				saveError = await res.text();
				return null;
			}
			dirty = false;
			onSaved(draft);
			return draft;
		} finally {
			saving = false;
		}
	}

	async function publish() {
		const saved = dirty ? await save() : draft;
		if (!saved) return;
		saving = true;
		saveError = '';
		try {
			const res = await fetch(`/admin/api/bercot/${draft.id}/publish`, { method: 'POST' });
			if (!res.ok) {
				saveError = await res.text();
				return;
			}
			const body = await res.json();
			onPublished({ ...draft, status: 'published', siteQuoteId: body.quote.id }, body.quote.id);
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			void save();
		} else if (e.key === 'Escape') {
			onClose();
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
			e.preventDefault();
			onNavigate(1);
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
			e.preventDefault();
			onNavigate(-1);
		}
	}

	const canPublish = $derived(
		Boolean(draft.fr?.trim()) &&
			draft.authorId != null &&
			draft.mappedTopicIds.length > 0 &&
			draft.status === 'kept'
	);

	const STATUS: BercotStatus[] = ['pending', 'kept', 'rejected', 'published'];
	const STATUS_LABEL: Record<BercotStatus, string> = {
		pending: 'À examiner',
		kept: 'Retenu',
		rejected: 'Rejeté',
		published: 'Publié'
	};
</script>

<div class="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30" onclick={onClose} role="presentation">
	<div
		class="flex h-full w-full max-w-5xl flex-col bg-background shadow-xl"
		onclick={(e) => e.stopPropagation()}
		onkeydown={onKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<header class="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
			<div class="min-w-0">
				<p class="truncate text-[11px] uppercase tracking-wider text-muted">
					{entry.sourceEntry}{entry.subsection ? ` · ${entry.subsection}` : ''}
				</p>
				<p class="truncate text-xs text-muted">{entry.attribution}</p>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => onNavigate(-1)}
					class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
					title="Précédent (⌘/Ctrl + ←)">← Préc</button
				>
				<button
					type="button"
					onclick={() => onNavigate(1)}
					class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
					title="Suivant (⌘/Ctrl + →)">Suiv →</button
				>
				<button
					type="button"
					onclick={onClose}
					class="ml-2 rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
					title="Fermer (Esc)">✕</button
				>
			</div>
		</header>

		<div class="grid flex-1 grid-cols-2 gap-6 overflow-y-auto p-4">
			<!-- LEFT: read-only context -->
			<section>
				<h3 class="font-ui text-xs uppercase tracking-wider text-muted">Texte original (Bercot, EN)</h3>
				<p class="mt-2 whitespace-pre-wrap leading-relaxed">{entry.en}</p>
			</section>

			<!-- RIGHT: editable -->
			<section class="space-y-3">
				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Traduction française</span>
					<textarea
						class="mt-1 h-48 w-full rounded border border-border bg-panel px-2 py-1 leading-relaxed"
						value={draft.fr ?? ''}
						oninput={(e) => update('fr', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Auteur (auteurs.json)</span>
					<select
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={draft.authorId ?? ''}
						onchange={(e) => {
							const v = (e.currentTarget as HTMLSelectElement).value;
							update('authorId', v === '' ? undefined : Number(v));
						}}
					>
						<option value="">(non assigné)</option>
						{#each authorOptions as a (a.id)}
							<option value={a.id}>{a.name}</option>
						{/each}
					</select>
				</label>

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Source originale (URL)</span>
					<input
						type="url"
						placeholder="https://…"
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={draft.sourceUrl ?? ''}
						oninput={(e) =>
							update('sourceUrl', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>

				<div>
					<p class="font-ui text-xs uppercase tracking-wider text-muted">Sujets rattachés</p>
					<div class="mt-1 max-h-48 overflow-y-auto rounded border border-border bg-panel p-2">
						{#each topicFlat as { topic: t, depth } (t.id)}
							<label class="flex items-center gap-2 py-0.5 text-sm" style={`padding-left: ${depth * 1}rem`}>
								<input
									type="checkbox"
									checked={draft.mappedTopicIds.includes(t.id)}
									onchange={() => toggleTopic(t.id)}
								/>
								<span class:text-muted={depth > 0}>{depth > 0 ? '↳ ' : ''}{t.label}</span>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<p class="font-ui text-xs uppercase tracking-wider text-muted">Statut</p>
					<div class="mt-1 flex flex-wrap gap-1 text-xs">
						{#each STATUS as s (s)}
							<button
								type="button"
								onclick={() => update('status', s)}
								class={[
									'rounded border border-border px-2 py-1',
									draft.status === s ? 'bg-subtle/20' : 'hover:bg-subtle/10'
								]}
							>
								{STATUS_LABEL[s]}
							</button>
						{/each}
					</div>
				</div>

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Notes</span>
					<textarea
						class="mt-1 h-16 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
						value={draft.notes ?? ''}
						oninput={(e) =>
							update('notes', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
			</section>
		</div>

		<footer class="flex items-center gap-3 border-t border-border bg-background px-4 py-3">
			<button
				type="button"
				onclick={save}
				disabled={!dirty || saving}
				class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
			>
				{saving ? 'Enregistrement…' : 'Enregistrer'}
			</button>
			<span class="text-xs text-muted">⌘/Ctrl + S</span>
			<span class="flex-1"></span>
			<button
				type="button"
				onclick={publish}
				disabled={!canPublish || saving || draft.status === 'published'}
				class="rounded border border-border bg-emerald-700 px-4 py-1 font-ui text-sm text-white disabled:opacity-40"
				title={canPublish ? 'Crée un Quote en draft' : 'Requis : traduction, auteur, sujet(s), statut « retenu »'}
			>
				Publier sur le site
			</button>
			{#if saveError}
				<span class="text-xs text-red-600">{saveError}</span>
			{/if}
			{#if dirty}<span class="text-xs text-amber-600">● modifié</span>{/if}
		</footer>
	</div>
</div>
```

- [ ] **Step 2: Wire the editor into the page**

Edit `src/routes/admin/bercot/+page.svelte`:

Add to the imports at the top of the `<script>`:

```ts
import BercotCardEditor from './BercotCardEditor.svelte';
```

Add state below the existing state declarations:

```ts
let activeId = $state<string | null>(null);
const activeEntry = $derived(
	activeId ? data.bercot.find((b) => b.id === activeId) ?? null : null
);
const activeSiblings = $derived(view === 'topic' ? candidatesForTopic : ungroupedEntries);
const activeIndex = $derived.by(() => {
	if (!activeId) return -1;
	return activeSiblings.findIndex((b) => b.id === activeId);
});

function navigate(delta: -1 | 1) {
	if (activeIndex === -1) return;
	const next = activeSiblings[activeIndex + delta];
	if (next) activeId = next.id;
}

function onSaved(updated: BercotEntry) {
	const i = data.bercot.findIndex((b) => b.id === updated.id);
	if (i !== -1) data.bercot[i] = updated;
}

function onPublished(updated: BercotEntry, newQuoteId: number) {
	onSaved(updated);
	// Refresh quotes list lazily — keep it simple
	void fetch('/admin/api/quotes')
		.then((r) => r.json())
		.then((qs) => (data.quotes = qs));
}
```

In the `<article>` card markup inside `{#each candidatesForTopic as b ...}`, wrap the card in a `<button>` and set `activeId = b.id` on click. Then at the end of the template (after the closing `{/if}` of `view === 'ungrouped'`), add:

```svelte
{#if activeEntry}
	<BercotCardEditor
		entry={activeEntry}
		entries={activeSiblings}
		topics={data.topics}
		authors={data.authors}
		onClose={() => (activeId = null)}
		onSaved={onSaved}
		onPublished={onPublished}
		onNavigate={navigate}
	/>
{/if}
```

- [ ] **Step 3: Smoke-test**

Run `npm run dev`. Pick a topic (e.g. "L'avortement"), click a card → editor slides in. Verify:
- English text on the left, all fields on the right.
- Editing French + setting status to "Retenu" + checking a topic → Save enables. Cmd-S saves.
- Cmd-→ / Cmd-← navigate within the topic.
- Esc closes.
- "Publier sur le site" stays disabled until French + author + topic + status='kept' are all set.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/bercot/
git commit -m "feat(admin/bercot): detail editor with French / author / topics / status"
```

---

## Task 12: Bercot publish flow + dedup hint

**Files:**
- Modify: `src/routes/admin/bercot/+page.svelte` (badge on cards already shown, add dedup visual)
- Modify: `src/routes/admin/bercot/BercotCardEditor.svelte` (dedup callout)

- [ ] **Step 1: Add dedup callout in the editor**

In `BercotCardEditor.svelte`, inside the left column section (read-only context), after the EN paragraph add:

```svelte
{#if entry.dedupMatch != null}
	<div class="mt-3 rounded border border-sky-500/40 bg-sky-500/10 p-2 text-xs text-sky-800">
		Cette citation a déjà été identifiée comme correspondant à
		<a class="underline" href={`/admin/citations#${entry.dedupMatch}`} target="_blank"
			>quote #{entry.dedupMatch}</a
		>.
	</div>
{/if}
```

- [ ] **Step 2: Add a dedup chip on the card preview**

In `src/routes/admin/bercot/+page.svelte`, inside the `<article>` card, after the attribution line add:

```svelte
{#if b.dedupMatch != null && b.status !== 'published'}
	<p class="mt-1 text-[10px] text-sky-700">
		~ correspond à <a class="underline" href={`/admin/citations#${b.dedupMatch}`}
			>quote #{b.dedupMatch}</a
		>
	</p>
{/if}
```

- [ ] **Step 3: Smoke-test**

Visit `/admin/bercot`, pick a topic where dedup matched (e.g. "Le baptême comme moyen de grâce" — has 5 matches per the README). Verify the dedup hint shows on those cards and inside the editor.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/bercot/
git commit -m "feat(admin/bercot): surface dedup matches on cards and in editor"
```

---

## Task 13: "Créer un sujet à partir de cette entrée" flow

**Files:**
- Create: `src/routes/admin/bercot/NewTopicFromBercot.svelte`
- Modify: `src/routes/admin/bercot/+page.svelte`

- [ ] **Step 1: Create the modal component**

`src/routes/admin/bercot/NewTopicFromBercot.svelte`:

```svelte
<script lang="ts">
	import type { BercotEntry, Pillar, Topic } from '$lib/schema';

	type Props = {
		sourceEntry: string;
		entries: BercotEntry[];     // all Bercot rows from this entry, to attach after save
		topics: Topic[];
		onClose: () => void;
		onCreated: (newTopic: Topic, updatedEntries: BercotEntry[]) => void;
	};
	let { sourceEntry, entries, topics, onClose, onCreated }: Props = $props();

	let label = $state('');
	let slug = $state('');
	let groupe = $state('');
	let description = $state('');
	let section = $state<Topic['section']>('I');
	let parentId = $state<number | null>(null);
	let pillar = $state<Pillar | ''>('');
	let saving = $state(false);
	let saveError = $state('');

	const topLevel = $derived(topics.filter((t) => t.parentId == null));
	const PILLARS: { value: Pillar; label: string }[] = [
		{ value: 'credo', label: 'Credo (CCC I)' },
		{ value: 'sacrements', label: 'Sacrements (CCC II)' },
		{ value: 'vie', label: 'Vie en Christ (CCC III)' },
		{ value: 'priere', label: 'Prière (CCC IV)' }
	];

	function autoSlug() {
		slug = label
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-');
	}

	async function create() {
		saving = true;
		saveError = '';
		try {
			if (!label.trim() || !slug.trim() || !groupe.trim()) {
				saveError = 'Libellé, slug et groupe sont requis.';
				return;
			}
			if (parentId == null && !pillar) {
				saveError = 'Pour un sujet de premier niveau, choisissez un pilier.';
				return;
			}
			const nextId = Math.max(0, ...topics.map((t) => t.id)) + 1;
			const newTopic: Topic = {
				id: nextId,
				slug: slug.trim(),
				label: label.trim(),
				section,
				groupe: groupe.trim(),
				...(description.trim() ? { description: description.trim() } : {}),
				...(parentId != null ? { parentId } : pillar ? { pillar } : {})
			};

			const nextTopics = [...topics, newTopic];
			const topicsRes = await fetch('/admin/api/topics', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(nextTopics)
			});
			if (!topicsRes.ok) {
				saveError = await topicsRes.text();
				return;
			}

			// Attach all entries from this source to the new topic
			const allBercot = (await fetch('/admin/api/bercot').then((r) => r.json())) as BercotEntry[];
			const updated = allBercot.map((b) =>
				entries.some((e) => e.id === b.id)
					? { ...b, mappedTopicIds: Array.from(new Set([...b.mappedTopicIds, nextId])) }
					: b
			);
			const bercotRes = await fetch('/admin/api/bercot', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated)
			});
			if (!bercotRes.ok) {
				saveError = await bercotRes.text();
				return;
			}
			onCreated(newTopic, updated.filter((b) => entries.some((e) => e.id === b.id)));
		} finally {
			saving = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={onClose} role="presentation">
	<div
		class="w-full max-w-xl rounded-lg border border-border bg-background p-5 shadow-xl"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
	>
		<h2 class="font-heading text-lg">Créer un sujet à partir de « {sourceEntry} »</h2>
		<p class="mt-1 text-xs text-muted">
			Le nouveau sujet sera créé puis les {entries.length} citation(s) de cette entrée Bercot y seront rattachées.
		</p>

		<div class="mt-4 space-y-3 text-sm">
			<label class="block">
				Libellé (français)
				<input
					class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
					bind:value={label}
					onblur={() => !slug && autoSlug()}
				/>
			</label>
			<label class="block">
				Slug (URL)
				<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1" bind:value={slug} />
			</label>
			<label class="block">
				Groupe
				<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1" bind:value={groupe} />
			</label>
			<label class="block">
				Section
				<select class="mt-1 w-full rounded border border-border bg-panel px-2 py-1" bind:value={section}>
					{#each ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as s (s)}
						<option value={s}>{s}</option>
					{/each}
				</select>
			</label>
			<label class="block">
				Description (optionnelle)
				<textarea
					class="mt-1 h-20 w-full rounded border border-border bg-panel px-2 py-1"
					bind:value={description}
				></textarea>
			</label>
			<fieldset class="rounded border border-border p-3">
				<legend class="px-1 text-xs uppercase tracking-wider text-muted">Place dans la hiérarchie</legend>
				<label class="block text-sm">
					Parent
					<select
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={parentId ?? ''}
						onchange={(e) => {
							const v = (e.currentTarget as HTMLSelectElement).value;
							parentId = v === '' ? null : Number(v);
						}}
					>
						<option value="">(racine — sujet de premier niveau)</option>
						{#each topLevel as t (t.id)}
							<option value={t.id}>{t.label}</option>
						{/each}
					</select>
				</label>
				{#if parentId == null}
					<label class="mt-3 block text-sm">
						Pilier (CCC)
						<select
							class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
							value={pillar}
							onchange={(e) =>
								(pillar = (e.currentTarget as HTMLSelectElement).value as Pillar | '')}
						>
							<option value="">(non classé)</option>
							{#each PILLARS as p (p.value)}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</label>
				{:else}
					<p class="mt-2 text-xs italic text-muted">Pilier hérité du sujet parent.</p>
				{/if}
			</fieldset>
		</div>

		{#if saveError}<p class="mt-3 text-sm text-red-600">{saveError}</p>{/if}

		<div class="mt-5 flex justify-end gap-2">
			<button type="button" onclick={onClose} class="rounded border border-border px-3 py-1 text-sm"
				>Annuler</button
			>
			<button
				type="button"
				onclick={create}
				disabled={saving}
				class="rounded border border-border bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
			>
				{saving ? 'Création…' : 'Créer le sujet'}
			</button>
		</div>
	</div>
</div>
```

- [ ] **Step 2: Wire into the page**

In `src/routes/admin/bercot/+page.svelte`:

Add to imports:

```ts
import NewTopicFromBercot from './NewTopicFromBercot.svelte';
```

Add state:

```ts
let newTopicSource = $state<string | null>(null);
const newTopicEntries = $derived(
	newTopicSource ? data.bercot.filter((b) => b.sourceEntry === newTopicSource) : []
);

function onTopicCreated(newTopic: Topic, updatedEntries: BercotEntry[]) {
	data.topics = [...data.topics, newTopic];
	for (const u of updatedEntries) {
		const i = data.bercot.findIndex((b) => b.id === u.id);
		if (i !== -1) data.bercot[i] = u;
	}
	newTopicSource = null;
}
```

In the Ungrouped view, replace the placeholder `<!-- "Créer un sujet" button wired up in Task 13 -->` with:

```svelte
<button
	type="button"
	onclick={() => (newTopicSource = entry)}
	class="mt-3 rounded border border-border bg-accent/10 px-3 py-1 text-xs text-accent hover:bg-accent/20"
>
	+ Créer un sujet « {entry} »
</button>
```

At the bottom of the template, after the existing `{#if activeEntry}…{/if}` block, add:

```svelte
{#if newTopicSource}
	<NewTopicFromBercot
		sourceEntry={newTopicSource}
		entries={newTopicEntries}
		topics={data.topics}
		onClose={() => (newTopicSource = null)}
		onCreated={onTopicCreated}
	/>
{/if}
```

- [ ] **Step 3: Smoke-test**

Visit `/admin/bercot?view=ungrouped` (or click the "Non rattachés" tab). Pick e.g. "HYPOSTATIC UNION" → click "Créer un sujet" → fill label/slug/groupe, leave parent as racine, pick "Credo" pillar → Create. Verify:
- A new topic appears (refresh `/admin/sujets` if needed).
- All HYPOSTATIC UNION Bercot entries now show that new topic in their `mappedTopicIds` (visit `/admin/bercot`, pick the new topic — its cards are there).

Then delete the test topic via `/admin/sujets` (or via direct JSON edit) to keep the data clean.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/bercot/
git commit -m "feat(admin/bercot): create new site topic from a Bercot entry"
```

---

## Task 14: Visual polish — dispatch frontend-design subagent

The Bercot detail editor is the page the user will live in for months. After the functional flow is verified end-to-end, dispatch the `application-performance:frontend-developer` agent (or `frontend-design` skill via subagent) to refine the visual treatment.

- [ ] **Step 1: Capture a baseline screenshot**

With `npm run dev` running, open `/admin/bercot`, pick a topic (e.g. "L'avortement"), click a card to open the editor. Take a screenshot for before/after comparison.

- [ ] **Step 2: Dispatch the subagent**

Use the Agent tool with `subagent_type: "application-performance:frontend-developer"` and a prompt along these lines (adjust as needed to match what you actually want):

> Refine the visual treatment of the Bercot detail editor at `src/routes/admin/bercot/BercotCardEditor.svelte`. Context: this is a dev-only French-language patristic curation interface inside a SvelteKit 2 / Svelte 5 / Tailwind app. The user will spend months in this view, translating early-Christian quotes from English into French. Constraints:
>
> - Keep all functionality intact (Cmd-S save, Cmd-←/→ prev/next, Esc close, status radio, topic checkboxes, dedup callout, publish gating logic).
> - Stay consistent with the existing admin look — `border-border`, `bg-panel`, `text-muted`, `font-ui`, `font-heading`, `text-accent`. Don't introduce new colour primitives.
> - Improve typography hierarchy: the English source text and the French translation textarea are the primary surfaces; everything else (status, topic checkboxes, notes) is secondary.
> - Improve the status badge / chip colour system — clear visual distinction between pending / kept / rejected / published without being garish.
> - Keep keyboard shortcuts discoverable (small hints visible).
> - Side-panel layout: the current 2-column grid is fine; consider whether a vertical stack would be better at narrower widths (responsive).
>
> Report what you changed and why. Take screenshots before/after.

- [ ] **Step 3: Review the diff**

Read the subagent's changes. Run `npm run dev`, open the editor, manually exercise all interactions (Cmd-S, navigation, publish gating, status chips, dedup callout, topic toggling). Reject anything that broke functionality or changed unrelated files.

- [ ] **Step 4: Commit the visual polish**

```bash
git add src/routes/admin/bercot/BercotCardEditor.svelte
git commit -m "feat(admin/bercot): visual polish for the detail editor"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:unit -- --run`
Expected: all tests pass.

- [ ] **Step 2: Run the type check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: passes (fix any formatting issues with `npm run format`).

- [ ] **Step 4: End-to-end smoke test in browser**

With `npm run dev`:

1. Visit `/admin/hierarchie` — verify 4 pillar columns + "Non classé" pool, 49 topics distributed (all in "Non classé" initially).
2. Visit `/admin/sujets`, pick "La Trinité" (id 3), set Pilier = Credo, save. Refresh `/admin/hierarchie` — verify "La Trinité" moved into the Credo column.
3. In `/admin/sujets`, create a new sub-topic by setting Parent on a topic. Verify it appears nested in the sidebar tree and in `/admin/hierarchie`.
4. Visit `/admin/bercot`, pick "L'avortement", click a card → editor opens. Add a French translation, pick an author, set status to "Retenu", save. Verify the card on return reflects the new status.
5. Click "Publier sur le site". Verify a new draft Quote appears in `/admin/citations` and the Bercot card now shows status "Publié" with a link to the new quote.
6. Visit `/admin/bercot?view=ungrouped`, pick e.g. "INCARNATION", create a sub-topic of "La Trinité" from it. Verify the new sub-topic appears in `/admin/sujets`, in `/admin/hierarchie` (nested under La Trinité in Credo), and that the INCARNATION cards now show in the new topic's view.

- [ ] **Step 5: Final commit if any tweaks**

If anything failed and you fixed it:

```bash
git add -A
git commit -m "fix(admin): smoke-test fixups"
```

---

## Notes for the implementer

- **Atomic writes:** the `/admin/api/[entity]` PUT endpoint always writes the full array. This is fine for small files but means concurrent edits from two tabs can clobber each other — the user is the sole operator in dev so we accept it.
- **No optimistic UI:** all admin actions wait for the server response before updating local state. This matches the existing Sujets/Citations admin pattern.
- **Pillar inheritance:** sub-topics inherit their parent's pillar in the UI (Sujets editor hides the field; Hiérarchie groups by parent's pillar). The schema allows `pillar` on a sub-topic but the UI never sets it.
- **`mappedTopicIds` semantics:** independent assignments — selecting a sub-topic does NOT also select its parent. The user decides which level each quote lives at.
- **Dedup matches:** auto-set `status: 'published'` on first ingestion of a row whose EN text matched an existing quote. The `siteQuoteId` points at the matched quote.
- **The harvest script's `MAPPING` and `CANDIDATES` tables remain the source of truth for *initial* topic assignment.** Re-runs of the script regenerate row identities (hashes) and refresh the pre-filled `mappedTopicIds`. User edits via the admin override at the per-row level via the merge step.
