import { error } from '@sveltejs/kit';
import { authorBySlug, quotes, works, topics } from '$lib/data';

export function load({ params }) {
	const author = authorBySlug(params.slug);
	if (!author) throw error(404, 'Père introuvable');
	const authorQuotes = quotes.filter((q) => q.authorId === author.id);
	const authorWorks = works.filter((w) => w.authorId === author.id);
	// Topics are already loaded module-side; we pass them through so the
	// page can resolve quote.topicIds to labels and slugs in the same
	// marginal-source-header layout the topic page uses.
	return { author, quotes: authorQuotes, works: authorWorks, topics };
}
