import { error } from '@sveltejs/kit';
import { topicBySlug, quotes, authors, works } from '$lib/data';

export function load({ params }) {
	const topic = topicBySlug(params.slug);
	if (!topic) throw error(404, 'Sujet introuvable');
	const matching = quotes.filter((q) => q.topicIds.includes(topic.id));
	return { topic, matching, authors, works };
}
