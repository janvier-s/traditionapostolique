import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authors, works, quotes } from '$lib/data';

export function load() {
	if (!dev) throw error(404);
	const authorIds = new Set(authors.map((a) => a.id));
	const workIds = new Set(works.map((w) => w.id));
	return {
		noFr: quotes.filter((q) => !q.fr?.trim()).map((q) => q.id),
		noOriginal: quotes.filter((q) => !q.latin && !q.greek).map((q) => q.id),
		noTitle: quotes.filter((q) => !q.title?.trim()).map((q) => q.id),
		brokenAuthor: quotes.filter((q) => !authorIds.has(q.authorId)).map((q) => q.id),
		brokenWork: quotes.filter((q) => q.workId != null && !workIds.has(q.workId)).map((q) => q.id),
		noArchive: quotes.filter((q) => !q.links.archive).map((q) => q.id),
		authorsMissingBio: authors.filter((a) => !a.bioShort?.trim()).map((a) => a.id),
		worksMissingDescription: works.filter((w) => !w.description?.trim()).map((w) => w.id)
	};
}
