import { describe, it, expect } from 'vitest';
import {
	authors,
	works,
	topics,
	quotes,
	authorById,
	workById,
	topicById,
	quoteById
} from './index';

describe('data loader', () => {
	it('loads all four collections as non-empty arrays', () => {
		expect(authors.length).toBeGreaterThan(0);
		expect(topics.length).toBeGreaterThan(0);
		expect(works.length).toBeGreaterThan(0);
		expect(quotes.length).toBeGreaterThan(0);
	});

	it('exposes lookup-by-id helpers', () => {
		expect(authorById(authors[0]!.id)).toBe(authors[0]);
		expect(authorById(-1)).toBeUndefined();
		expect(workById(works[0]!.id)).toBe(works[0]);
		expect(workById(-1)).toBeUndefined();
		expect(topicById(topics[0]!.id)).toBe(topics[0]);
		expect(topicById(-1)).toBeUndefined();
		expect(quoteById(quotes[0]!.id)).toBe(quotes[0]);
		expect(quoteById(-1)).toBeUndefined();
	});

	it('every quote.authorId points to an existing author', () => {
		const ids = new Set(authors.map((a) => a.id));
		const orphans = quotes.filter((q) => !ids.has(q.authorId));
		expect(orphans).toEqual([]);
	});

	it('every quote.topicIds member points to an existing topic', () => {
		const ids = new Set(topics.map((t) => t.id));
		const bad = quotes.flatMap((q) => q.topicIds.filter((t) => !ids.has(t)));
		expect(bad).toEqual([]);
	});

	it('every defined quote.workId points to an existing work', () => {
		const ids = new Set(works.map((w) => w.id));
		const bad = quotes.filter((q) => q.workId !== undefined && !ids.has(q.workId));
		expect(bad).toEqual([]);
	});

	it('quote.authorId matches the work.authorId of its workId', () => {
		const workMap = new Map(works.map((w) => [w.id, w]));
		const bad = quotes.filter((q) => {
			if (q.workId == null) return false;
			const w = workMap.get(q.workId);
			return w?.authorId != null && w.authorId !== q.authorId;
		});
		expect(bad.map((q) => q.id)).toEqual([]);
	});

	it('every defined work.authorId points to an existing author', () => {
		const ids = new Set(authors.map((a) => a.id));
		const bad = works.filter((w) => w.authorId !== undefined && !ids.has(w.authorId));
		expect(bad).toEqual([]);
	});

	it('author slugs are unique', () => {
		const counts = new Map<string, number>();
		for (const a of authors) counts.set(a.slug, (counts.get(a.slug) ?? 0) + 1);
		const dups = [...counts.entries()].filter(([, n]) => n > 1);
		expect(dups).toEqual([]);
	});

	it('work slugs are unique', () => {
		const counts = new Map<string, number>();
		for (const w of works) counts.set(w.slug, (counts.get(w.slug) ?? 0) + 1);
		const dups = [...counts.entries()].filter(([, n]) => n > 1);
		expect(dups).toEqual([]);
	});

	it('topic slugs are unique', () => {
		const counts = new Map<string, number>();
		for (const t of topics) counts.set(t.slug, (counts.get(t.slug) ?? 0) + 1);
		const dups = [...counts.entries()].filter(([, n]) => n > 1);
		expect(dups).toEqual([]);
	});
});
