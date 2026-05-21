import { error } from '@sveltejs/kit';
import { authorBySlug, quotes, works } from '$lib/data';

export function load({ params }) {
	const author = authorBySlug(params.slug);
	if (!author) throw error(404, 'Père introuvable');
	const authorQuotes = quotes.filter((q) => q.authorId === author.id);
	const authorWorks = works.filter((w) => w.authorId === author.id);
	return { author, quotes: authorQuotes, works: authorWorks };
}
