import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { BercotEntrySchema, QuoteSchema, type BercotEntry, type Quote } from '$lib/schema';

function assertDev() {
	if (!dev) throw error(404);
}

function dataPath(file: string) {
	return join(process.cwd(), 'src/lib/data', file);
}

function readJson<T>(file: string): T {
	return JSON.parse(readFileSync(dataPath(file), 'utf-8')) as T;
}

function nextQuoteId(quotes: Quote[]): number {
	let max = 0;
	for (const q of quotes) if (q.id > max) max = q.id;
	return max + 1;
}

export async function POST({ params }) {
	assertDev();

	let bercotAll: BercotEntry[];
	try {
		bercotAll = readJson<unknown[]>('bercot.json').map((row) => BercotEntrySchema.parse(row));
	} catch (e) {
		throw error(500, `bercot.json read/parse failed: ${(e as Error).message}`);
	}

	const idx = bercotAll.findIndex((b) => b.id === params.id);
	if (idx === -1) throw error(404, `Bercot entry ${params.id} not found`);
	const entry: BercotEntry = bercotAll[idx];

	if (!entry.fr || entry.fr.trim() === '') throw error(400, 'French translation required');
	if (entry.authorId == null) throw error(400, 'authorId required');
	if (entry.mappedTopicIds.length === 0) throw error(400, 'at least one topic required');
	if (entry.status !== 'kept') throw error(400, 'entry must be in status "kept" before publishing');
	if (entry.siteQuoteId != null) throw error(400, `already published as quote ${entry.siteQuoteId}`);

	let quotes: Quote[];
	try {
		quotes = readJson<unknown[]>('quotes.json').map((q) => QuoteSchema.parse(q));
	} catch (e) {
		throw error(500, `quotes.json read/parse failed: ${(e as Error).message}`);
	}

	const newId = nextQuoteId(quotes);
	const newQuote: Quote = QuoteSchema.parse({
		id: newId,
		slug: `citation-${newId}`,
		authorId: entry.authorId,
		topicIds: entry.mappedTopicIds,
		reference: entry.attribution,
		fr: entry.fr,
		en: entry.en,
		notes: entry.notes,
		links: entry.sourceUrl ? { primary: entry.sourceUrl } : {},
		status: 'draft'
	});

	// Write bercot first so a partial-failure retry hits the siteQuoteId guard
	// (avoids creating a duplicate Quote on retry).
	const updatedBercot = { ...entry, status: 'published' as const, siteQuoteId: newId };
	bercotAll[idx] = updatedBercot;
	atomicWriteJson(dataPath('bercot.json'), bercotAll);

	quotes.push(newQuote);
	atomicWriteJson(dataPath('quotes.json'), quotes);

	return json({ ok: true, quote: newQuote, bercot: updatedBercot });
}
