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

const authorById_ = new Map(authors.map((a) => [a.id, a]));
const workById_ = new Map(works.map((w) => [w.id, w]));
const topicById_ = new Map(topics.map((t) => [t.id, t]));
const quoteById_ = new Map(quotes.map((q) => [q.id, q]));

const authorBySlug_ = new Map(authors.map((a) => [a.slug, a]));
const workBySlug_ = new Map(works.map((w) => [w.slug, w]));
const topicBySlug_ = new Map(topics.map((t) => [t.slug, t]));
const quoteBySlug_ = new Map(quotes.map((q) => [q.slug, q]));

export const authorById = (id: number) => authorById_.get(id);
export const workById = (id: number) => workById_.get(id);
export const topicById = (id: number) => topicById_.get(id);
export const quoteById = (id: number) => quoteById_.get(id);

export const authorBySlug = (slug: string) => authorBySlug_.get(slug);
export const workBySlug = (slug: string) => workBySlug_.get(slug);
export const topicBySlug = (slug: string) => topicBySlug_.get(slug);
export const quoteBySlug = (slug: string) => quoteBySlug_.get(slug);

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
