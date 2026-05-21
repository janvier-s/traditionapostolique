import type { Author, Quote, Era, Work } from '$lib/schema';
import { quoteEffectiveYear } from './quote-date';

export interface QuoteFilters {
	ere?: Era[];
	region?: string[];
	langue?: string[];
	pere?: number[];
}
export type QuoteSort = 'date-asc' | 'date-desc' | 'author' | 'work' | 'canonical';

export function applyFiltersAndSort(
	quotes: Quote[],
	authors: Author[],
	f: QuoteFilters,
	sort: QuoteSort,
	works: Work[] = []
): Quote[] {
	const byAuthor = new Map(authors.map((a) => [a.id, a]));
	const byWork = new Map(works.map((w) => [w.id, w]));

	const filtered = quotes.filter((q) => {
		const a = byAuthor.get(q.authorId);
		if (!a) return false;
		if (f.ere?.length && !f.ere.includes(a.era)) return false;
		if (f.region?.length && (!a.region || !f.region.includes(a.region))) return false;
		if (f.langue?.length && !a.language.some((l) => f.langue!.includes(l))) return false;
		if (f.pere?.length && !f.pere.includes(a.id)) return false;
		return true;
	});

	const sorted = filtered.slice();
	if (sort === 'canonical') return sorted;
	sorted.sort((p, q) => {
		const ap = byAuthor.get(p.authorId)!;
		const aq = byAuthor.get(q.authorId)!;
		if (sort === 'date-asc') return quoteEffectiveYear(ap) - quoteEffectiveYear(aq);
		if (sort === 'date-desc') return quoteEffectiveYear(aq) - quoteEffectiveYear(ap);
		if (sort === 'author') return ap.name.localeCompare(aq.name, 'fr');
		if (sort === 'work') {
			const wp = p.workId ? (byWork.get(p.workId)?.title ?? '') : '';
			const wq = q.workId ? (byWork.get(q.workId)?.title ?? '') : '';
			return wp.localeCompare(wq, 'fr');
		}
		return 0;
	});
	return sorted;
}
