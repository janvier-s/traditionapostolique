import { describe, it, expect } from 'vitest';
import { formatCitation } from './format-citation';
import type { Author, Work, Quote } from '$lib/schema';

const augustinus = {
	id: 1,
	slug: 'a',
	name: 'Augustin',
	originalName: 'Augustinus',
	era: 'post-nicene',
	language: ['latin'],
	sources: {}
} as Author;
const civDei = {
	id: 1,
	slug: 'w',
	title: 'La Cité de Dieu',
	authorId: 1,
	alternativeTitles: ['De civitate Dei']
} as Work;
const quote = {
	id: 99,
	slug: 'q',
	authorId: 1,
	workId: 1,
	topicIds: [1],
	reference: 'XIV.28',
	migne: 'PL 41:436',
	links: {}
} as Quote;

describe('formatCitation', () => {
	it('produces academic format with PL ref', () => {
		expect(formatCitation(quote, augustinus, civDei)).toBe(
			'Augustinus, De civitate Dei XIV.28 (PL 41:436).'
		);
	});
	it('omits Migne segment when absent', () => {
		expect(formatCitation({ ...quote, migne: undefined }, augustinus, civDei)).toBe(
			'Augustinus, De civitate Dei XIV.28.'
		);
	});
	it('falls back to FR title if no Latin original title', () => {
		expect(formatCitation(quote, augustinus, { ...civDei, alternativeTitles: [] })).toBe(
			'Augustinus, La Cité de Dieu XIV.28 (PL 41:436).'
		);
	});
});
