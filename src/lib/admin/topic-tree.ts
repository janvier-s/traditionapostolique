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
 */
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
