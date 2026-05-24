import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authors, works, quotes, topics } from '$lib/data';

export function load() {
	if (!dev) throw error(404);

	const authorIds = new Set(authors.map((a) => a.id));
	const workIds = new Set(works.map((w) => w.id));

	// Reverse indexes used by several cohorts below.
	const quotesByAuthor = new Map<number, number>();
	const quotesByWork = new Map<number, number>();
	const worksByAuthor = new Map<number, number>();
	for (const q of quotes) {
		quotesByAuthor.set(q.authorId, (quotesByAuthor.get(q.authorId) ?? 0) + 1);
		if (q.workId != null) quotesByWork.set(q.workId, (quotesByWork.get(q.workId) ?? 0) + 1);
	}
	for (const w of works) {
		if (w.authorId != null)
			worksByAuthor.set(w.authorId, (worksByAuthor.get(w.authorId) ?? 0) + 1);
	}

	// Quote↔work author mismatch (the integrity issue that turned up
	// during the studyTitle pass · keep visible so future regressions
	// are caught early).
	const workMap = new Map(works.map((w) => [w.id, w]));
	const mismatchedQuoteAuthor = quotes
		.filter((q) => {
			if (q.workId == null) return false;
			const w = workMap.get(q.workId);
			return w?.authorId != null && w.authorId !== q.authorId;
		})
		.map((q) => q.id);

	// Generic-titled works whose quotes would benefit from a per-quote
	// studyTitle precision (e.g. 'Lettres' / 'Sermons' / 'Homélies').
	// Surfaces only quotes that don't already have studyTitle filled in.
	const GENERIC_TITLE =
		/^(Lettres?|Hom[ée]lies?|Sermons?|Discours|Trait[ée]s?|Commentaires?|Œuvres|Hymnes|Opuscules?|Apologie|Apologies?)$/i;
	const genericWorkIds = new Set(
		works.filter((w) => GENERIC_TITLE.test(w.title)).map((w) => w.id)
	);
	const missingStudyTitle = quotes
		.filter(
			(q) =>
				q.workId != null && genericWorkIds.has(q.workId) && !(q as { studyTitle?: string }).studyTitle
		)
		.map((q) => q.id);

	return {
		// Quote-level gaps
		noFr: quotes.filter((q) => !q.fr?.trim()).map((q) => q.id),
		noOriginal: quotes.filter((q) => !q.latin && !q.greek).map((q) => q.id),
		noReference: quotes.filter((q) => !q.reference?.trim()).map((q) => q.id),
		noTitle: quotes.filter((q) => !q.title?.trim()).map((q) => q.id),
		noArchive: quotes.filter((q) => !q.links.archive).map((q) => q.id),
		noContext: quotes.filter((q) => !q.context?.trim()).map((q) => q.id),
		draftStatus: quotes.filter((q) => q.status === 'draft').map((q) => q.id),
		missingStudyTitle,

		// Integrity issues
		brokenAuthor: quotes.filter((q) => !authorIds.has(q.authorId)).map((q) => q.id),
		brokenWork: quotes
			.filter((q) => q.workId != null && !workIds.has(q.workId))
			.map((q) => q.id),
		mismatchedQuoteAuthor,
		brokenTopicId: quotes
			.flatMap((q) =>
				q.topicIds.length === 0 || q.topicIds.some((t) => !Number.isFinite(t)) ? [q.id] : []
			),

		// Author-level gaps
		authorsMissingBio: authors.filter((a) => !a.bioShort?.trim()).map((a) => a.id),
		authorsMissingDates: authors.filter((a) => !a.dates?.trim()).map((a) => a.id),
		authorsNoQuotes: authors
			.filter((a) => (quotesByAuthor.get(a.id) ?? 0) === 0)
			.map((a) => a.id),
		authorsNoWorks: authors
			.filter((a) => (worksByAuthor.get(a.id) ?? 0) === 0)
			.map((a) => a.id),

		// Work-level gaps
		worksMissingDescription: works.filter((w) => !w.description?.trim()).map((w) => w.id),
		worksMissingCompositionDate: works
			.filter((w) => !w.compositionDate?.trim())
			.map((w) => w.id),
		worksNoQuotes: works.filter((w) => (quotesByWork.get(w.id) ?? 0) === 0).map((w) => w.id),

		// Topic-level gaps
		topicsMissingDescription: topics.filter((t) => !t.description?.trim()).map((t) => t.id)
	};
}
