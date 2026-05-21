import type { Author } from '$lib/schema';
import { eraMidpoint } from './era';

export function quoteEffectiveYear(author: Author): number {
	if (author.dates) {
		const m = author.dates.match(/\d{2,4}/);
		if (m) return Number(m[0]);
	}
	return eraMidpoint(author.era);
}
