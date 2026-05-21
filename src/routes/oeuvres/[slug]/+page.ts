import { error } from '@sveltejs/kit';
import { workBySlug, authorById, quotes } from '$lib/data';

export function load({ params }) {
	const work = workBySlug(params.slug);
	if (!work) throw error(404, 'Œuvre introuvable');
	const author = authorById(work.authorId);
	if (!author) throw error(500, 'Auteur introuvable pour cette œuvre');
	const workQuotes = quotes.filter((q) => q.workId === work.id);
	return { work, author, quotes: workQuotes };
}
