import { describe, it, expect } from 'vitest';
import { quoteEffectiveYear } from './quote-date';
import type { Author } from '$lib/schema';

const ag = {
	id: 1,
	slug: 'a',
	name: 'A',
	era: 'post-nicene',
	language: [],
	sources: {},
	dates: 'c. 354 - 430'
} as Author;
const orig = {
	id: 2,
	slug: 'o',
	name: 'O',
	era: 'ante-nicene',
	language: [],
	sources: {},
	dates: 'c. 185-c. 254'
} as Author;
const dateless = {
	id: 3,
	slug: 'x',
	name: 'X',
	era: 'medieval',
	language: [],
	sources: {}
} as Author;

describe('quoteEffectiveYear', () => {
	it('extracts the first century-ish year from dates', () => {
		expect(quoteEffectiveYear(ag)).toBe(354);
		expect(quoteEffectiveYear(orig)).toBe(185);
	});
	it('falls back to era midpoint when dates missing', () => {
		expect(quoteEffectiveYear(dateless)).toBe(1100);
	});
});
