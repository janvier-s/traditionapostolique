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
		expect(tree[0]!.topic.id).toBe(1);
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
	it('returns [] for an empty tree', () => {
		expect(flattenTree([])).toEqual([]);
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
