import type { Quote, Topic } from '$lib/schema';

const MAX = 80;

export function deriveQuoteTitle(q: Quote, topics: Topic[]): string {
	if (q.title?.trim()) return q.title.trim();
	if (q.fr?.trim()) {
		const text = q.fr.trim();
		const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
		const clean = firstSentence.replace(/[.!?]+$/, '');
		if (clean.length <= MAX) return clean;
		return clean.slice(0, MAX).replace(/\s+\S*$/, '') + '…';
	}
	const t = topics.find((t) => t.id === q.topicIds[0]);
	return t?.label ?? '';
}
