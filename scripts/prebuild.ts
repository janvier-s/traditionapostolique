import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { z } from 'zod';
import {
	AuthorSchema, WorkSchema, TopicSchema, QuoteSchema,
	type Author, type Work, type Topic, type Quote
} from '../src/lib/schema';

const DATA = join(process.cwd(), 'src/lib/data');
const OUT = join(process.cwd(), 'static/data');

function loadArray<S extends z.ZodTypeAny>(name: string, schema: S): z.infer<S>[] {
	const path = join(DATA, name);
	if (!existsSync(path)) { console.error('Missing data file:', path); process.exit(1); }
	const raw = JSON.parse(readFileSync(path, 'utf-8'));
	const parsed = schema.array().safeParse(raw);
	if (!parsed.success) {
		console.error(`Validation failed for ${name}:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
		process.exit(1);
	}
	return parsed.data as z.infer<S>[];
}

function countDuplicateIds(rows: { id: number }[]): number {
	const seen = new Set<number>();
	const dups = new Set<number>();
	for (const r of rows) {
		if (seen.has(r.id)) dups.add(r.id);
		seen.add(r.id);
	}
	return dups.size === 0 ? 0 : rows.length - seen.size;
}

function buildIndex(authors: Author[], works: Work[], topics: Topic[], quotes: Quote[]) {
	const docs = [
		...quotes.map(q => ({
			id: `quote-${q.slug}`, type: 'quote',
			title: q.title ?? '',
			body: [q.fr, q.en, q.latin, q.greek, q.context, q.notes].filter(Boolean).join(' '),
			slug: q.slug
		})),
		...authors.map(a => ({
			id: `author-${a.slug}`, type: 'author',
			title: a.name, body: [a.originalName, a.bioShort, a.region].filter(Boolean).join(' '),
			slug: a.slug
		})),
		...works.map(w => ({
			id: `work-${w.slug}`, type: 'work',
			title: w.title, body: [w.description, (w.alternativeTitles ?? []).join(' ')].join(' '),
			slug: w.slug
		})),
		...topics.map(t => ({
			id: `topic-${t.slug}`, type: 'topic',
			title: t.label, body: t.description ?? '',
			slug: t.slug
		}))
	];
	const ms = new MiniSearch({
		fields: ['title', 'body'],
		storeFields: ['type', 'title', 'slug']
	});
	ms.addAll(docs);
	mkdirSync(OUT, { recursive: true });
	writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(ms.toJSON()), 'utf-8');
	console.log('search index: wrote', docs.length, 'documents');
}

function gapsReport(authors: Author[], works: Work[], quotes: Quote[]) {
	const authorIds = new Set(authors.map(a => a.id));
	const workIds = new Set(works.map(w => w.id));

	const noFr = quotes.filter(q => !q.fr?.trim()).length;
	const noOriginal = quotes.filter(q => !q.latin && !q.greek).length;
	const brokenAuthor = quotes.filter(q => !authorIds.has(q.authorId)).length;
	const brokenWork = quotes.filter(q => q.workId != null && !workIds.has(q.workId)).length;
	const noTitle = quotes.filter(q => !q.title?.trim()).length;
	const noBio = authors.filter(a => !a.bioShort?.trim()).length;
	const noWorkDescription = works.filter(w => !w.description?.trim()).length;
	const noArchive = quotes.filter(q => !q.links.archive).length;
	const dupAuthorIds = countDuplicateIds(authors);
	const dupWorkIds = countDuplicateIds(works);

	console.log('\n=== Gaps report ===');
	console.log(`quotes without FR translation:   ${noFr}`);
	console.log(`quotes without any original:     ${noOriginal}`);
	console.log(`quotes with bespoke title empty: ${noTitle}`);
	console.log(`quotes with broken author FK:    ${brokenAuthor}`);
	console.log(`quotes with broken work FK:      ${brokenWork}`);
	console.log(`quotes without Archive.org link: ${noArchive}`);
	console.log(`authors missing bioShort:        ${noBio}`);
	console.log(`works missing description:       ${noWorkDescription}`);
	console.log(`authors with duplicate ids:      ${dupAuthorIds}`);
	console.log(`works with duplicate ids:        ${dupWorkIds}`);
	console.log('===================\n');
}

function main() {
	const authors = loadArray('authors.json', AuthorSchema);
	const works = loadArray('works.json', WorkSchema);
	const topics = loadArray('topics.json', TopicSchema);
	const quotes = loadArray('quotes.json', QuoteSchema);

	console.log(`Validated: ${authors.length} authors, ${works.length} works, ${topics.length} topics, ${quotes.length} quotes`);
	buildIndex(authors, works, topics, quotes);
	gapsReport(authors, works, quotes);
}

main();
