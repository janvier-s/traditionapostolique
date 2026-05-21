import { describe, it, expect } from 'vitest';
import { authors, works, topics, quotes, authorById, workById, topicById, quoteById } from './index';

describe('data loader', () => {
	it('loads all four collections as non-empty arrays', () => {
		expect(authors.length).toBeGreaterThan(0);
		expect(topics.length).toBe(49);
		expect(works.length).toBeGreaterThan(0);
		expect(quotes.length).toBeGreaterThan(0);
	});

	it('exposes lookup-by-id helpers', () => {
		expect(authorById(authors[0].id)).toBe(authors[0]);
		expect(authorById(-1)).toBeUndefined();
	});

	it('every quote.authorId points to an existing author', () => {
		const ids = new Set(authors.map(a => a.id));
		const orphans = quotes.filter(q => !ids.has(q.authorId));
		expect(orphans).toEqual([]);
	});

	it('every quote.topicIds member points to an existing topic', () => {
		const ids = new Set(topics.map(t => t.id));
		const bad = quotes.flatMap(q => q.topicIds.filter(t => !ids.has(t)));
		expect(bad).toEqual([]);
	});
});
