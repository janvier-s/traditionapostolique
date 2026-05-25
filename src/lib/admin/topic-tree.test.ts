import { describe, it, expect } from 'vitest';
import type { Topic, Quote } from '$lib/schema';
import { buildTopicTree, flattenTree, validateParentRefs } from './topic-tree';

const t = (id: number, label: string, extras: Partial<Topic> = {}): Topic => ({
	id,
	slug: `t${id}`,
	label,
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
		const r = validateParentRefs([t(1, 'A'), t(2, 'A1', { parentId: 1, primary: true })]);
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

const q = (id: number, topicIds: number[]): Quote => ({
	id,
	slug: `q${id}`,
	authorId: 1,
	workId: 1,
	topicIds,
	fr: 'x',
	en: 'x',
	reference: 'x',
	status: 'ok'
});

describe('validateParentRefs (with quotes)', () => {
	it('fails when a theme (topic with children) has direct quote refs', () => {
		const topics = [t(1, 'Theme'), t(2, 'Aspect', { parentId: 1, primary: true })];
		const quotes = [q(100, [1])]; // quote refs the theme directly — illegal
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
		const topics = [t(1, 'A'), t(2, 'A1', { parentId: 1, primary: true })];
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
