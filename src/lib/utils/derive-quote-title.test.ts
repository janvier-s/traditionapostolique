import { describe, it, expect } from 'vitest';
import { deriveQuoteTitle } from './derive-quote-title';
import type { Quote, Topic } from '$lib/schema';

const baseQ = (overrides: Partial<Quote>): Quote => ({
	id: 1,
	slug: 'q-1',
	authorId: 1,
	topicIds: [10],
	links: {},
	...overrides
});
const topics: Topic[] = [{ id: 10, slug: 'foi', label: 'La foi' }];

describe('deriveQuoteTitle', () => {
	it('returns the explicit title when present', () => {
		expect(deriveQuoteTitle(baseQ({ title: 'Sur la foi' }), topics)).toBe('Sur la foi');
	});
	it('falls back to first sentence of fr, truncated', () => {
		const fr = 'La foi est la substance des choses espérées. Elle est aussi…';
		expect(deriveQuoteTitle(baseQ({ fr }), topics)).toBe(
			'La foi est la substance des choses espérées'
		);
	});
	it('truncates a single long sentence with an ellipsis', () => {
		const long = 'a'.repeat(120);
		const title = deriveQuoteTitle(baseQ({ fr: long }), topics);
		expect(title.length).toBeLessThanOrEqual(81);
		expect(title.endsWith('…')).toBe(true);
	});
	it('falls back to the primary topic label when fr is missing', () => {
		expect(deriveQuoteTitle(baseQ({}), topics)).toBe('La foi');
	});
});
