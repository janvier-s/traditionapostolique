import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	AuthorSchema, WorkSchema, TopicSchema, QuoteSchema,
	type Author, type Work, type Topic, type Quote, type Era
} from '../src/lib/schema';

const XLSX_PATH = process.env.XLSX_PATH
	?? '/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/excel/fathers_db.xlsx';
const OUT_DIR = join(process.cwd(), 'src/lib/data');

function slugify(s: string): string {
	return s.toLowerCase()
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function eraFromFr(raw: unknown): Era {
	const s = String(raw ?? '').toLowerCase();
	if (s.includes('apostol')) return 'apostolic';
	if (s.includes('ante') || s.includes('avant')) return 'ante-nicene';
	if (s.includes('nicen') || s.includes('nicée') || s.includes('nicee')) return 'nicene';
	if (s.includes('post')) return 'post-nicene';
	if (s.includes('méd') || s.includes('moyen')) return 'medieval';
	return 'post-nicene';
}

function readSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
	const ws = wb.Sheets[name];
	if (!ws) throw new Error(`Sheet not found: ${name}`);
	return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
}

function splitList(s: unknown): string[] {
	if (!s) return [];
	return String(s).split(/[;,]\s*/).map(x => x.trim()).filter(Boolean);
}
function splitIds(s: unknown): number[] {
	return splitList(s).map(Number).filter(n => Number.isFinite(n));
}
function maybeUrl(s: unknown): string | undefined {
	if (!s) return undefined;
	const str = String(s).trim();
	return /^https?:\/\//.test(str) ? str : undefined;
}

/** Aggressive name key for fuzzy author matching across sheets. */
function nameKey(s: unknown): string {
	return String(s ?? '')
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[‘’ʼʻ`']/g, "'")
		.replace(/^(st\.?|saint|sainte|pape)\s+/i, '')
		.replace(/^(st\.?|saint|sainte|pape)\s+/i, '') // second pass: "Pape St. ..."
		.replace(/\bier\b/g, '1er')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Build a fuzzy resolver from name keys to author IDs, including stripped-suffix aliases. */
function buildAuthorResolver(authors: Author[]): (name: string) => number | undefined {
	const byKey = new Map<string, number>();
	for (const a of authors) {
		const k = nameKey(a.name);
		if (k) byKey.set(k, a.id);
		// Also index by base name (drop trailing " de <Place>")
		const base = k.replace(/\s+(de|d|du|le|la)\s+.+$/, '').trim();
		if (base && !byKey.has(base)) byKey.set(base, a.id);
	}
	return (name: string) => {
		const k = nameKey(name);
		if (byKey.has(k)) return byKey.get(k);
		const base = k.replace(/\s+(de|d|du|le|la)\s+.+$/, '').trim();
		if (base && byKey.has(base)) return byKey.get(base);
		return undefined;
	};
}

/** Resolver for topics, just lowercase + diacritics-strip + collapse whitespace. */
function buildTopicResolver(topics: Topic[]): (label: string) => number | undefined {
	const k = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[‘’ʼʻ`']/g, "'")
		.replace(/[^a-z0-9']+/g, ' ').trim();
	const byKey = new Map<string, number>();
	for (const t of topics) byKey.set(k(t.label), t.id);
	return (label: string) => byKey.get(k(label));
}

/** Resolver for works: same as topic resolver. */
function buildWorkResolver(works: Work[]): (title: string) => number | undefined {
	const k = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[‘’ʼʻ`']/g, "'")
		.replace(/[^a-z0-9']+/g, ' ').trim();
	const byKey = new Map<string, number>();
	for (const w of works) byKey.set(k(w.title), w.id);
	return (title: string) => byKey.get(k(title));
}

const warnings: string[] = [];
function warn(msg: string) {
	warnings.push(msg);
	console.warn(msg);
}

function importAuthors(wb: XLSX.WorkBook): Author[] {
	// Headers at row 0: ID, Name, Ère, Page WikiSource, Page Wikipedia, Nom d'origine,
	// Date, Fêté le, Fonction, Langue, Groupes d'auteurs, Page WikiMedia, Disciple de,
	// Région moderne, Status, Œuvres
	const rows = readSheet(wb, 'Auteurs').slice(1);
	// First pass: collect (rawId, row) for rows with a non-empty name.
	const accepted: Array<{ rawId: number; row: unknown[] }> = [];
	for (const r of rows) {
		const name = String(r[1] ?? '').trim(); if (!name) continue;
		const rawId = Number(r[0]);
		accepted.push({ rawId, row: r });
	}
	// Compute next-auto-id baseline above max positive source id.
	let maxSourceId = 0;
	for (const { rawId } of accepted) {
		if (Number.isFinite(rawId) && rawId > maxSourceId) maxSourceId = rawId;
	}
	let nextAutoId = Math.max(maxSourceId, 1000) + 1;
	const usedIds = new Set<number>();
	const out: Author[] = [];
	for (const { rawId, row: r } of accepted) {
		const name = String(r[1] ?? '').trim();
		let id: number;
		if (!Number.isFinite(rawId) || rawId === 0 || usedIds.has(rawId)) {
			id = nextAutoId++;
			while (usedIds.has(id)) id = nextAutoId++;
		} else {
			id = rawId;
		}
		usedIds.add(id);
		const candidate: Author = {
			id, slug: slugify(name + '-' + id), name,
			originalName: r[5] ? String(r[5]).trim() || undefined : undefined,
			era: eraFromFr(r[2]),
			dates: r[6] ? String(r[6]).trim() || undefined : undefined,
			feastDay: r[7] ? String(r[7]).trim() || undefined : undefined,
			function: r[8] ? String(r[8]).trim() || undefined : undefined,
			language: splitList(r[9]),
			region: r[13] ? String(r[13]).trim() || undefined : undefined,
			groups: splitList(r[10]),
			disciples: splitIds(r[12]),
			sources: {
				wikipedia: maybeUrl(r[4]),
				wikisource: maybeUrl(r[3]),
				wikimedia: maybeUrl(r[11])
			},
			status: r[14] ? String(r[14]).trim() || undefined : undefined
		};
		const parsed = AuthorSchema.safeParse(candidate);
		if (!parsed.success) { warn(`skip author ${id}: ${JSON.stringify(parsed.error.issues)}`); continue; }
		out.push(parsed.data);
	}
	return out;
}

function importTopics(wb: XLSX.WorkBook): Topic[] {
	// Headers at row 0: ID, Topic, Section, Groupe, Description
	const rows = readSheet(wb, 'Sujets').slice(1);
	const out: Topic[] = [];
	for (const r of rows) {
		const id = Number(r[0]); if (!Number.isFinite(id)) continue;
		const label = String(r[1] ?? '').trim(); if (!label) continue;
		const section = String(r[2] ?? '').trim();
		const candidate: Topic = {
			id, slug: slugify(label + '-' + id), label,
			section: section as Topic['section'],
			groupe: String(r[3] ?? '').trim(),
			description: r[4] ? String(r[4]).trim() || undefined : undefined
		};
		const parsed = TopicSchema.safeParse(candidate);
		if (!parsed.success) { warn(`skip topic ${id}: ${JSON.stringify(parsed.error.issues)}`); continue; }
		out.push(parsed.data);
	}
	return out;
}

function importWorks(wb: XLSX.WorkBook, resolveAuthor: (n: string) => number | undefined): Work[] {
	// Headers at row 0: ID, Titre, Auteur ou Source, Titres Alternatifs, ID2, Description, Lien
	const rows = readSheet(wb, 'Œuvres').slice(1);
	// First pass: collect (rawId, row) for rows with a non-empty title.
	const accepted: Array<{ rawId: number; row: unknown[] }> = [];
	for (const r of rows) {
		const title = String(r[1] ?? '').trim(); if (!title) continue;
		const rawId = Number(r[0]);
		accepted.push({ rawId, row: r });
	}
	let maxSourceId = 0;
	for (const { rawId } of accepted) {
		if (Number.isFinite(rawId) && rawId > maxSourceId) maxSourceId = rawId;
	}
	let nextAutoId = Math.max(maxSourceId, 10000) + 1;
	const usedIds = new Set<number>();
	const out: Work[] = [];
	let unknownAuthor = 0;
	for (const { rawId, row: r } of accepted) {
		const title = String(r[1] ?? '').trim();
		let id: number;
		if (!Number.isFinite(rawId) || rawId === 0 || usedIds.has(rawId)) {
			id = nextAutoId++;
			while (usedIds.has(id)) id = nextAutoId++;
		} else {
			id = rawId;
		}
		usedIds.add(id);
		const authorName = String(r[2] ?? '').trim();
		const authorId = resolveAuthor(authorName);
		if (authorId == null) {
			unknownAuthor++;
			warn(`work ${id} unknown author ${JSON.stringify(authorName)}`);
			continue;
		}
		const candidate: Work = {
			id, slug: slugify(title + '-' + id), title,
			alternativeTitles: splitList(r[3]),
			authorId,
			description: r[5] ? String(r[5]).trim() || undefined : undefined,
			link: maybeUrl(r[6])
		};
		const parsed = WorkSchema.safeParse(candidate);
		if (!parsed.success) { warn(`skip work ${id}: ${JSON.stringify(parsed.error.issues)}`); continue; }
		out.push(parsed.data);
	}
	console.log(`works: ${unknownAuthor} skipped for unknown author`);
	return out;
}

function importQuotes(
	wb: XLSX.WorkBook,
	resolveAuthor: (n: string) => number | undefined,
	resolveWork: (t: string) => number | undefined,
	resolveTopic: (l: string) => number | undefined
): Quote[] {
	const rows = readSheet(wb, 'Citations').slice(2);
	// First pass: collect (rawId, row) for rows with a non-empty author name (cheap proxy for "real row").
	const accepted: Array<{ rawId: number; row: unknown[] }> = [];
	for (const r of rows) {
		const authorName = String(r[3] ?? '').trim(); if (!authorName) continue;
		const rawId = Number(r[2]);
		accepted.push({ rawId, row: r });
	}
	let maxSourceId = 0;
	for (const { rawId } of accepted) {
		if (Number.isFinite(rawId) && rawId > maxSourceId) maxSourceId = rawId;
	}
	let nextAutoId = Math.max(maxSourceId, 100000) + 1;
	const usedIds = new Set<number>();
	const out: Quote[] = [];
	let unknownAuthor = 0;
	let noTopic = 0;
	let parseFail = 0;
	for (const { rawId, row: r } of accepted) {
		let id: number;
		if (!Number.isFinite(rawId) || rawId === 0 || usedIds.has(rawId)) {
			id = nextAutoId++;
			while (usedIds.has(id)) id = nextAutoId++;
		} else {
			id = rawId;
		}
		usedIds.add(id);
		const authorName = String(r[3] ?? '').trim();
		const authorId = resolveAuthor(authorName);
		if (authorId == null) {
			unknownAuthor++;
			warn(`quote ${id} unknown author ${JSON.stringify(authorName)}`);
			continue;
		}
		const workTitle = String(r[4] ?? '').trim();
		const workId = workTitle ? resolveWork(workTitle) : undefined;
		const topicIds = String(r[5] ?? '')
			.split(/[;,]\s*/).map(s => s.trim()).filter(Boolean)
			.map(label => resolveTopic(label))
			.filter((n): n is number => typeof n === 'number');
		if (topicIds.length === 0) {
			noTopic++;
			warn(`quote ${id} no topics matched (raw=${JSON.stringify(r[5])})`);
			continue;
		}
		const candidate: Quote = {
			id, slug: `citation-${id}`,
			authorId, workId, topicIds,
			reference: r[13] ? String(r[13]).trim() || undefined : undefined,
			fr: r[14] ? String(r[14]).trim() || undefined : undefined,
			en: r[6] ? String(r[6]).trim() || undefined : undefined,
			latin: r[7] ? String(r[7]).trim() || undefined : undefined,
			greek: r[8] ? String(r[8]).trim() || undefined : undefined,
			context: r[9] ? String(r[9]).trim() || undefined : undefined,
			migne: r[12] ? String(r[12]).trim() || undefined : undefined,
			links: { primary: maybeUrl(r[10]), archive: maybeUrl(r[11]) },
			notes: r[16] ? String(r[16]).trim() || undefined : undefined,
			status: String(r[1] ?? '').toLowerCase().includes('ok') ? 'ok' : 'draft'
		};
		const parsed = QuoteSchema.safeParse(candidate);
		if (!parsed.success) {
			parseFail++;
			warn(`skip quote ${id}: ${JSON.stringify(parsed.error.issues)}`);
			continue;
		}
		out.push(parsed.data);
	}
	console.log(`quotes: ${unknownAuthor} unknown author, ${noTopic} no topic match, ${parseFail} parse fail`);
	return out;
}

function write(path: string, data: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
	const n = Array.isArray(data) ? data.length : '?';
	console.log('wrote', path, '(' + n + ' records)');
}

async function main() {
	const buf = readFileSync(XLSX_PATH);
	const wb = XLSX.read(buf, { type: 'buffer' });
	const authors = importAuthors(wb);
	const topics = importTopics(wb);
	const resolveAuthor = buildAuthorResolver(authors);
	const works = importWorks(wb, resolveAuthor);
	const resolveWork = buildWorkResolver(works);
	const resolveTopic = buildTopicResolver(topics);
	const quotes = importQuotes(wb, resolveAuthor, resolveWork, resolveTopic);

	write(join(OUT_DIR, 'authors.json'), authors);
	write(join(OUT_DIR, 'topics.json'), topics);
	write(join(OUT_DIR, 'works.json'), works);
	write(join(OUT_DIR, 'quotes.json'), quotes);

	console.log(`\nTotal warnings: ${warnings.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
