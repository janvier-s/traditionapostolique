import { z } from 'zod';
import {
	AuthorSchema,
	WorkSchema,
	TopicSchema,
	QuoteSchema,
	TaxonomySchema,
	type Author,
	type Work,
	type Topic,
	type Quote,
	type Pillar,
	type TaxonomyNode,
	type Taxonomy
} from '$lib/schema';
import authorsRaw from './authors.json';
import worksRaw from './works.json';
import topicsRaw from './topics.json';
import quotesRaw from './quotes.json';
import taxonomyRaw from './taxonomy.json';

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

const taxonomyParsed = TaxonomySchema.safeParse(taxonomyRaw);
if (!taxonomyParsed.success)
	throw new Error(`Invalid taxonomy: ${JSON.stringify(taxonomyParsed.error.issues, null, 2)}`);
export const taxonomy: Taxonomy = taxonomyParsed.data;

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

// ── Public taxonomy rendering ─────────────────────────────────────────────────

export interface PublicTaxonomyNode {
	id: string;
	umbrella?: { label: string; primaryHref?: string };
	topicRef?: { topicId: number; slug: string; label: string; href: string; count: number };
	children: PublicTaxonomyNode[];
}

export function buildPublicTaxonomy(): Record<Pillar, PublicTaxonomyNode[]> {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);

	function resolve(node: TaxonomyNode): PublicTaxonomyNode {
		const out: PublicTaxonomyNode = { id: node.id, children: [] };
		if (node.label != null) {
			const primaryChild = node.children?.find((c) => c.topicId != null && c.primary === true);
			const primaryTopic =
				primaryChild?.topicId != null ? topicById_.get(primaryChild.topicId) : undefined;
			out.umbrella = {
				label: node.label,
				primaryHref: primaryTopic ? `/sujets/${primaryTopic.slug}` : undefined
			};
			out.children = (node.children ?? []).map(resolve);
		} else if (node.topicId != null) {
			const t = topicById_.get(node.topicId);
			if (t) {
				out.topicRef = {
					topicId: t.id,
					slug: t.slug,
					label: t.label,
					href: `/sujets/${t.slug}`,
					count: counts.get(t.id) ?? 0
				};
			}
		}
		return out;
	}

	const pillars: Pillar[] = ['dieu', 'eglise', 'saints', 'sacrements', 'vie', 'fin'];
	const result = {} as Record<Pillar, PublicTaxonomyNode[]>;
	for (const p of pillars) result[p] = (taxonomy[p] ?? []).map(resolve);
	return result;
}
