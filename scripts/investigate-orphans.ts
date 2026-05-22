import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';

const XLSX_PATH =
	'/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/excel/fathers_db.xlsx';

const authors = JSON.parse(readFileSync('src/lib/data/authors.json', 'utf8')) as Array<{
	id: number;
	slug: string;
	name: string;
}>;
const quotes = JSON.parse(readFileSync('src/lib/data/quotes.json', 'utf8')) as Array<{
	authorId: number;
}>;

const usedAuthorIds = new Set(quotes.map((q) => q.authorId));
const orphans = authors.filter((a) => !usedAuthorIds.has(a.id));

const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' });
const cites = XLSX.utils.sheet_to_json(wb.Sheets['Citations']!, {
	header: 1,
	defval: null
}) as unknown[][];

function norm(s: unknown): string {
	return String(s ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[‘’ʼʻ`']/g, "'")
		.replace(/^(st\.?|saint|sainte|pape|pape st\.?)\s+/i, '')
		.replace(/[^a-z0-9']+/g, ' ')
		.trim();
}

const rawCounts = new Map<string, number>();
for (let i = 2; i < cites.length; i++) {
	const r = cites[i] ?? [];
	if (!r.some((cell: unknown) => cell != null && String(cell).trim())) continue;
	const raw = String(r[3] ?? '').trim();
	rawCounts.set(raw, (rawCounts.get(raw) ?? 0) + 1);
}

const out: string[] = [];
out.push(`# Orphan author investigation\nTotal orphans: ${orphans.length}\n`);

for (const a of orphans) {
	const key = norm(a.name);
	const matches: { raw: string; count: number }[] = [];
	for (const [raw, count] of rawCounts) {
		const rawKey = norm(raw);
		if (!rawKey) continue;
		if (rawKey === key || rawKey.includes(key) || key.includes(rawKey)) {
			matches.push({ raw, count });
		}
	}
	out.push(`## ${a.name} (id=${a.id})`);
	if (matches.length > 0) {
		out.push(`  XLSX rows: ${matches.map((m) => `"${m.raw}" ×${m.count}`).join(', ')}`);
	} else {
		out.push(`  no XLSX rows match this name`);
	}
}

writeFileSync('orphan-investigation.md', out.join('\n') + '\n');
process.stdout.write(`wrote orphan-investigation.md (${orphans.length} orphans)\n`);
