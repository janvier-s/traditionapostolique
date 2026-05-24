import { error } from '@sveltejs/kit';
import { quoteById, authorById, workById, topicById } from '$lib/data';

export function load({ params }) {
	const id = Number(params.id);
	const quote = quoteById(id);
	if (!quote) throw error(404, 'Citation introuvable');
	const author = authorById(quote.authorId);
	const work = quote.workId ? workById(quote.workId) : null;
	const topics = quote.topicIds.map((tid) => topicById(tid)).filter((t) => t != null);
	return { quote, author, work, topics };
}
