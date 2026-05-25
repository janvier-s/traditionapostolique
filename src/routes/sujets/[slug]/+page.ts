import { error, redirect } from '@sveltejs/kit';
import { topicBySlug, topics, quotes, authors, works } from '$lib/data';
import { isTheme, primaryAspectOf } from '$lib/data/topic-helpers';

export function load({ params }) {
	const _t = topicBySlug(params.slug);
	if (_t && isTheme(_t.id, topics)) {
		const primary = primaryAspectOf(_t.id, topics);
		if (primary) throw redirect(307, `/sujets/${primary.slug}`);
		throw redirect(307, `/themes/${_t.slug}`);
	}

	const topic = topicBySlug(params.slug);
	if (!topic) throw error(404, 'Sujet introuvable');
	const matching = quotes.filter((q) => q.topicIds.includes(topic.id));
	return { topic, matching, authors, works };
}
