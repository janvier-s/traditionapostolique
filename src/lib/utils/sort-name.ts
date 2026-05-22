import type { Author } from '$lib/schema';

/**
 * Sort-only display key for author / work names that strips honorific
 * prefixes ("Saint", "Pape", "St.") and leading non-letter chars so
 * "Pape Saint Léon Ier" sorts as "Léon" and "Saint Augustin" sorts as
 * "Augustin". Diacritics are stripped too so "Éphrem" sorts next to
 * "Ephesus" rather than landing at the end of the alphabet.
 *
 * Use the original `name` for display, only this stripped key for
 * comparison.
 */
export function sortKey(name: string): string {
	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/^(Pape\s+)?(Sainte?|St\.?)\s+/i, '')
		.replace(/^Pape\s+/i, '')
		.replace(/^[^a-z]+/i, '')
		.toLowerCase();
}

/** Letter bucket for the alphabetical index · "A", "B", ... */
export function letterBucket(name: string): string {
	const k = sortKey(name);
	return (k[0] || '?').toUpperCase();
}

export function authorSortKey(a: Author): string {
	return sortKey(a.name);
}
