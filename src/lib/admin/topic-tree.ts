import type { Topic, Quote } from '$lib/schema';

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

/**
 * Build a display tree from a flat topic list. Tolerates dangling parent
 * refs and self-references by surfacing such topics at the root level.
 * Invariant enforcement lives in `validateParentRefs`.
 */
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

/**
 * Strict invariant check for the API write path. Use this before persisting
 * a topics array (PUT /admin/api/topics). For in-memory display use
 * `buildTopicTree`, which is lenient with malformed parent refs (treats
 * dangling parents as roots) so the UI keeps rendering during edits.
 *
 * When `quotes` is provided (strict mode), also checks:
 *   - Invariant 2: themes (topics with children) have zero direct quote refs
 * When `quotes` is omitted (lenient mode), invariant 2 is silently skipped.
 * Invariants 1, 3, and 4 always run.
 */
export function validateParentRefs(topics: Topic[], quotes?: Quote[]): ValidateResult {
	const byId = new Map<number, Topic>();
	for (const t of topics) byId.set(t.id, t);

	// Invariant 1: parent refs valid; depth ≤ 1
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

	// Compute children map
	const childrenByParent = new Map<number, Topic[]>();
	for (const t of topics) {
		if (t.parentId != null) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		}
	}
	const themeIds = new Set(childrenByParent.keys());

	// Invariants 2 & 3: end-state invariants — only checked when quotes are provided
	if (quotes) {
		// Invariant 2: theme has zero direct quote refs (cross-collection)
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
	}

	// Invariant 4: slug uniqueness within route namespace. Themes are in /themes/;
	// aspects + standalone sujets are in /sujets/. Within a namespace, slugs must be unique;
	// a theme MAY share a slug with its primary aspect (different namespaces).
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
