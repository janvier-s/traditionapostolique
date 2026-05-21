import { describe, it, expect } from 'vitest';
import { applyFiltersAndSort } from './filters';
import type { Author, Quote } from '$lib/schema';

const A: Author[] = [
	{
		id: 1,
		slug: 'a',
		name: 'Apo',
		era: 'apostolic',
		language: ['grec'],
		region: 'Asie Mineure',
		sources: {}
	},
	{
		id: 2,
		slug: 'b',
		name: 'Aug',
		era: 'post-nicene',
		language: ['latin'],
		region: 'Afrique',
		sources: {},
		dates: '354-430'
	}
];
const Q: Quote[] = [
	{ id: 1, slug: 'q1', authorId: 1, topicIds: [1], links: {}, fr: 'A' },
	{ id: 2, slug: 'q2', authorId: 2, topicIds: [1], links: {}, fr: 'B' }
];

describe('applyFiltersAndSort', () => {
	it('filters by era', () => {
		const r = applyFiltersAndSort(Q, A, { ere: ['apostolic'] }, 'date-asc');
		expect(r.map((q) => q.id)).toEqual([1]);
	});
	it('filters by region', () => {
		const r = applyFiltersAndSort(Q, A, { region: ['Afrique'] }, 'date-asc');
		expect(r.map((q) => q.id)).toEqual([2]);
	});
	it('filters by language', () => {
		expect(
			applyFiltersAndSort(Q, A, { langue: ['latin'] }, 'date-asc').map((q) => q.id)
		).toEqual([2]);
	});
	it('sorts by date ascending', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'date-asc').map((q) => q.id)).toEqual([1, 2]);
	});
	it('sorts by date descending', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'date-desc').map((q) => q.id)).toEqual([2, 1]);
	});
	it('sorts by author name', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'author').map((q) => q.id)).toEqual([1, 2]);
	});
});
