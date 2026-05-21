import { z } from 'zod';
import {
	AuthorSchema,
	WorkSchema,
	TopicSchema,
	QuoteSchema,
	type Author,
	type Work,
	type Topic,
	type Quote,
	type Section
} from '$lib/schema';
import authorsRaw from './authors.json';
import worksRaw from './works.json';
import topicsRaw from './topics.json';
import quotesRaw from './quotes.json';

function parseAll<S extends z.ZodTypeAny>(name: string, schema: S, raw: unknown): z.infer<S>[] {
	const arr = z.array(schema).safeParse(raw);
	if (!arr.success)
		throw new Error(`Invalid ${name}: ${JSON.stringify(arr.error.issues, null, 2)}`);
	return arr.data;
}

export const authors: Author[] = parseAll('authors', AuthorSchema, authorsRaw);
export const works: Work[] = parseAll('works', WorkSchema, worksRaw);
export const topics: Topic[] = parseAll('topics', TopicSchema, topicsRaw);
export const quotes: Quote[] = parseAll('quotes', QuoteSchema, quotesRaw);

const authorMap = new Map(authors.map((a) => [a.id, a]));
const workMap = new Map(works.map((w) => [w.id, w]));
const topicMap = new Map(topics.map((t) => [t.id, t]));
const quoteMap = new Map(quotes.map((q) => [q.id, q]));

export const authorById = (id: number) => authorMap.get(id);
export const workById = (id: number) => workMap.get(id);
export const topicById = (id: number) => topicMap.get(id);
export const quoteById = (id: number) => quoteMap.get(id);

export const authorBySlug = (slug: string) => authors.find((a) => a.slug === slug);
export const workBySlug = (slug: string) => works.find((w) => w.slug === slug);
export const topicBySlug = (slug: string) => topics.find((t) => t.slug === slug);
export const quoteBySlug = (slug: string) => quotes.find((q) => q.slug === slug);

export interface TopicTreeNode {
	section: Section;
	groupe: string;
	href: string;
	topics: { id: number; slug: string; label: string; href: string; count: number }[];
}

export function buildTopicTree(): TopicTreeNode[] {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);
	const sections: Section[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
	return sections.map((section) => {
		const topicsInSection = topics.filter((t) => t.section === section);
		const groupe = topicsInSection[0]?.groupe ?? '';
		return {
			section,
			groupe,
			href: `/sujets#section-${section}`,
			topics: topicsInSection.map((t) => ({
				id: t.id,
				slug: t.slug,
				label: t.label,
				href: `/sujets/${t.slug}`,
				count: counts.get(t.id) ?? 0
			}))
		};
	});
}
