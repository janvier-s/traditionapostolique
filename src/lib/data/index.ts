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
	type Pillar
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

export interface PublicAspect {
	id: number;
	slug: string;
	label: string;
	href: string;
	count: number;
	isTheme: boolean;
	parentLabel?: string;
}

export interface PublicPillarColumn {
	pillar: Pillar | 'none';
	label: string;
	subtitle: string;
	items: PublicAspect[];
}

const PILLAR_META: Record<Pillar, { label: string; subtitle: string }> = {
	credo: { label: 'Credo', subtitle: 'Profession de la foi (CCC I)' },
	sacrements: { label: 'Sacrements', subtitle: 'Célébration du mystère chrétien (CCC II)' },
	vie: { label: 'Vie en Christ', subtitle: 'La vie dans le Christ (CCC III)' },
	priere: { label: 'Prière', subtitle: 'La prière chrétienne (CCC IV)' }
};

export function buildPublicTree(): PublicPillarColumn[] {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);

	const childrenByParent = new Map<number, Topic[]>();
	for (const t of topics) {
		if (t.parentId != null) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		}
	}

	function descendantCount(themeId: number): number {
		let n = counts.get(themeId) ?? 0;
		for (const c of childrenByParent.get(themeId) ?? []) n += descendantCount(c.id);
		return n;
	}

	const pillars: Pillar[] = ['credo', 'sacrements', 'vie', 'priere'];
	const columns: PublicPillarColumn[] = pillars.map((p) => {
		const roots = topics
			.filter((t) => t.parentId == null && t.pillar === p)
			.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
		const items: PublicAspect[] = [];
		for (const root of roots) {
			const children = childrenByParent.get(root.id) ?? [];
			const isTheme = children.length > 0;
			items.push({
				id: root.id,
				slug: root.slug,
				label: root.label,
				href: `/sujets/${root.slug}`,
				count: isTheme ? descendantCount(root.id) : counts.get(root.id) ?? 0,
				isTheme
			});
			if (isTheme) {
				const sortedChildren = children
					.slice()
					.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
				for (const child of sortedChildren) {
					// Hide the primary aspect — the theme line above is its click target
					if (child.primary === true) continue;
					items.push({
						id: child.id,
						slug: child.slug,
						label: child.label,
						href: `/sujets/${child.slug}`,
						count: counts.get(child.id) ?? 0,
						isTheme: false,
						parentLabel: root.label
					});
				}
			}
		}
		return { pillar: p, ...PILLAR_META[p], items };
	});

	// Append a 'Non classé' column if any root lacks a pillar
	const noneRoots = topics
		.filter((t) => t.parentId == null && t.pillar == null)
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
	if (noneRoots.length > 0) {
		const items: PublicAspect[] = noneRoots.map((t) => {
			const children = childrenByParent.get(t.id) ?? [];
			const isTheme = children.length > 0;
			return {
				id: t.id,
				slug: t.slug,
				label: t.label,
				href: `/sujets/${t.slug}`,
				count: isTheme ? descendantCount(t.id) : counts.get(t.id) ?? 0,
				isTheme
			};
		});
		columns.push({ pillar: 'none', label: 'Non classé', subtitle: 'Sujets sans pilier', items });
	}

	return columns;
}

// ── Nested tree for the rail nav ─────────────────────────────────────────────

export interface PublicTopicNode {
	id: number;
	slug: string;
	label: string;
	href: string;
	count: number;
	isTheme: boolean;
	children?: PublicTopicNode[]; // non-primary aspects of a theme
}

export interface PublicPillarNode {
	pillar: Pillar | 'none';
	label: string;
	subtitle: string;
	topics: PublicTopicNode[]; // root-level: themes (with children) + standalone sujets
}

export function buildPublicTreeNested(): PublicPillarNode[] {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);

	const childrenByParent = new Map<number, Topic[]>();
	for (const t of topics) {
		if (t.parentId != null) {
			const arr = childrenByParent.get(t.parentId) ?? [];
			arr.push(t);
			childrenByParent.set(t.parentId, arr);
		}
	}

	function descendantCount(themeId: number): number {
		let n = counts.get(themeId) ?? 0;
		for (const c of childrenByParent.get(themeId) ?? []) n += descendantCount(c.id);
		return n;
	}

	function buildNode(root: Topic): PublicTopicNode {
		const children = childrenByParent.get(root.id) ?? [];
		const isTheme = children.length > 0;

		if (!isTheme) {
			return {
				id: root.id,
				slug: root.slug,
				label: root.label,
				href: `/sujets/${root.slug}`,
				count: counts.get(root.id) ?? 0,
				isTheme: false
			};
		}

		// Theme: find primary aspect for href, collect non-primary children
		const primaryAspect = children.find((c) => c.primary === true);
		const href = primaryAspect ? `/sujets/${primaryAspect.slug}` : `/sujets/${root.slug}`;

		const sortedChildren = children
			.slice()
			.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);

		const childNodes: PublicTopicNode[] = sortedChildren
			.filter((c) => c.primary !== true)
			.map((c) => ({
				id: c.id,
				slug: c.slug,
				label: c.label,
				href: `/sujets/${c.slug}`,
				count: counts.get(c.id) ?? 0,
				isTheme: false
			}));

		return {
			id: root.id,
			slug: root.slug,
			label: root.label,
			href,
			count: descendantCount(root.id),
			isTheme: true,
			children: childNodes.length > 0 ? childNodes : undefined
		};
	}

	const pillars: Pillar[] = ['credo', 'sacrements', 'vie', 'priere'];
	const columns: PublicPillarNode[] = pillars.map((p) => {
		const roots = topics
			.filter((t) => t.parentId == null && t.pillar === p)
			.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);

		return { pillar: p, ...PILLAR_META[p], topics: roots.map(buildNode) };
	});

	// Append 'Non classé' column if any root lacks a pillar
	const noneRoots = topics
		.filter((t) => t.parentId == null && t.pillar == null)
		.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id);
	if (noneRoots.length > 0) {
		columns.push({
			pillar: 'none',
			label: 'Non classé',
			subtitle: 'Sujets sans pilier',
			topics: noneRoots.map(buildNode)
		});
	}

	return columns;
}
