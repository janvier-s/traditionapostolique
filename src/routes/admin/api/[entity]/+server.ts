import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { validateParentRefs } from '$lib/admin/topic-tree';
import {
	AuthorSchema,
	WorkSchema,
	TopicSchema,
	QuoteSchema,
	BercotEntrySchema,
	type Topic
} from '$lib/schema';

const FILE: Record<string, string> = {
	authors: 'authors.json',
	works: 'works.json',
	topics: 'topics.json',
	quotes: 'quotes.json',
	bercot: 'bercot.json'
};

const SCHEMA: Record<string, z.ZodTypeAny> = {
	authors: AuthorSchema,
	works: WorkSchema,
	topics: TopicSchema,
	quotes: QuoteSchema,
	bercot: BercotEntrySchema
};

function pathFor(entity: string) {
	const file = FILE[entity];
	if (!file) throw error(404, 'Unknown entity');
	return join(process.cwd(), 'src/lib/data', file);
}

function loadAll(entity: string): unknown[] {
	return JSON.parse(readFileSync(pathFor(entity), 'utf-8'));
}

function schemaFor(entity: string): z.ZodTypeAny {
	const s = SCHEMA[entity];
	if (!s) throw error(404, 'Unknown entity');
	return s;
}

function assertDev() {
	if (!dev) throw error(404);
}

export async function GET({ params }) {
	assertDev();
	return json(loadAll(params.entity));
}

export async function PUT({ params, request }) {
	assertDev();
	const body = await request.json();
	const parsed = z.array(schemaFor(params.entity)).safeParse(body);
	if (!parsed.success) throw error(400, JSON.stringify(parsed.error.issues));
	if (params.entity === 'topics') {
		const refs = validateParentRefs(parsed.data as Topic[]);
		if (!refs.ok) throw error(400, refs.error);
	}
	atomicWriteJson(pathFor(params.entity), parsed.data);
	return json({ ok: true, count: parsed.data.length });
}
