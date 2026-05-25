import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { validateParentRefs } from '$lib/admin/topic-tree';
import {
	TopicSchema,
	QuoteSchema,
	BercotEntrySchema,
	type Topic,
	type Quote,
	type BercotEntry
} from '$lib/schema';

const StepSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('reparent'),
		topicId: z.number().int(),
		newParentId: z.number().int().nullable()
	}),
	z.object({
		kind: z.literal('swap-parent-child'),
		parentId: z.number().int(),
		childId: z.number().int()
	}),
	z.object({
		kind: z.literal('convert-root-to-theme'),
		rootId: z.number().int(),
		primaryAspect: z.object({
			slug: z.string().min(1),
			label: z.string().min(1),
			description: z.string().optional()
		}),
		themeSlugOverride: z.string().optional(),
		themeLabel: z.string().min(1).optional()
	}),
	z.object({
		kind: z.literal('set-pillar'),
		topicId: z.number().int(),
		pillar: z.enum(['credo', 'sacrements', 'vie', 'priere']).nullable()
	})
]);

function loadAll<T>(file: string, schema: z.ZodTypeAny): T[] {
	const raw = JSON.parse(readFileSync(join(process.cwd(), 'src/lib/data', file), 'utf-8'));
	const parsed = z.array(schema).safeParse(raw);
	if (!parsed.success)
		throw error(500, `data/${file} invalid: ${JSON.stringify(parsed.error.issues)}`);
	return parsed.data as T[];
}

function nextId(arr: { id: number }[]): number {
	return arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

export async function POST({ request }) {
	if (!dev) throw error(404);

	const body = await request.json();
	const step = StepSchema.safeParse(body);
	if (!step.success) throw error(400, JSON.stringify(step.error.issues));

	let topics = loadAll<Topic>('topics.json', TopicSchema);
	let quotes = loadAll<Quote>('quotes.json', QuoteSchema);
	let bercot = loadAll<BercotEntry>('bercot.json', BercotEntrySchema);

	switch (step.data.kind) {
		case 'reparent': {
			const { topicId, newParentId } = step.data;
			const idx = topics.findIndex((t) => t.id === topicId);
			if (idx < 0) throw error(400, `topic ${topicId} not found`);
			const t = topics[idx] as Topic;
			topics[idx] = { ...t, parentId: newParentId ?? undefined };
			break;
		}
		case 'swap-parent-child': {
			const { parentId, childId } = step.data;
			const pi = topics.findIndex((t) => t.id === parentId);
			const ci = topics.findIndex((t) => t.id === childId);
			if (pi < 0 || ci < 0) throw error(400, 'topic not found');
			const oldParent = topics[pi] as Topic;
			const oldChild = topics[ci] as Topic;
			topics[pi] = { ...oldParent, parentId: oldChild.id };
			topics[ci] = { ...oldChild, parentId: undefined };
			for (let i = 0; i < topics.length; i++) {
				if (i === pi || i === ci) continue;
				const cur = topics[i] as Topic;
				if (cur.parentId === parentId)
					topics[i] = { ...cur, parentId: oldChild.id };
			}
			break;
		}
		case 'convert-root-to-theme': {
			const { rootId, primaryAspect, themeSlugOverride, themeLabel } = step.data;
			const ri = topics.findIndex((t) => t.id === rootId);
			if (ri < 0) throw error(400, `root ${rootId} not found`);
			const rootTopic = topics[ri] as Topic;
			const newId = nextId(topics);
			const primary: Topic = {
				id: newId,
				slug: primaryAspect.slug,
				label: primaryAspect.label,
				description: primaryAspect.description,
				parentId: rootId,
				primary: true
			};
			topics.push(primary);
			let updated = rootTopic;
			if (themeLabel) updated = { ...updated, label: themeLabel };
			if (themeSlugOverride) updated = { ...updated, slug: themeSlugOverride };
			topics[ri] = updated;
			quotes = quotes.map((q) => {
				if (!q.topicIds.includes(rootId)) return q;
				return { ...q, topicIds: q.topicIds.map((id) => (id === rootId ? newId : id)) };
			});
			bercot = bercot.map((b) => {
				if (!b.mappedTopicIds.includes(rootId)) return b;
				return {
					...b,
					mappedTopicIds: b.mappedTopicIds.map((id) => (id === rootId ? newId : id))
				};
			});
			break;
		}
		case 'set-pillar': {
			const { topicId, pillar } = step.data;
			const idx = topics.findIndex((t) => t.id === topicId);
			if (idx < 0) throw error(400, `topic ${topicId} not found`);
			const t = topics[idx] as Topic;
			topics[idx] = { ...t, pillar: pillar ?? undefined };
			break;
		}
	}

	const v = validateParentRefs(topics);
	if (!v.ok) throw error(400, `validation failed: ${v.error}`);

	const root = process.cwd();
	atomicWriteJson(join(root, 'src/lib/data/topics.json'), topics);
	atomicWriteJson(join(root, 'src/lib/data/quotes.json'), quotes);
	atomicWriteJson(join(root, 'src/lib/data/bercot.json'), bercot);

	return json({ ok: true, topics, quotes, bercot });
}
