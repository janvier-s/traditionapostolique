import type { Author, Work, Quote } from '$lib/schema';

function pickWorkTitle(w: Work | undefined): string {
	if (!w) return '';
	const latin = w.alternativeTitles?.find((t) =>
		/^[A-Z][a-zæœ ,.'-]+$/.test(t.split(' ')[0] ?? '')
	);
	return latin ?? w.title;
}

function pickAuthorName(a: Author): string {
	return a.originalName ?? a.name;
}

export function formatCitation(q: Quote, a: Author, w?: Work): string {
	const parts = [pickAuthorName(a)];
	const work = pickWorkTitle(w);
	const ref = q.reference?.trim();
	if (work && ref) parts.push(`${work} ${ref}`);
	else if (work) parts.push(work);
	else if (ref) parts.push(ref);
	const main = parts.join(', ');
	return q.migne ? `${main} (${q.migne}).` : `${main}.`;
}
