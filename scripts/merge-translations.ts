import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QuoteSchema } from '../src/lib/schema';

const QUOTES_PATH = join(process.cwd(), 'src/lib/data/quotes.json');
const CSV_PATH =
	process.env.TRANSLATIONS_CSV ??
	'/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/excel/translate/fathers_db_response.csv';

// Minimal CSV parser that handles BOM + quoted fields with embedded newlines/semicolons.
function parseCsv(raw: string): string[][] {
	if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let i = 0;
	while (i < raw.length) {
		const c = raw[i];
		if (inQuotes) {
			if (c === '"' && raw[i + 1] === '"') {
				field += '"';
				i += 2;
				continue;
			}
			if (c === '"') {
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		} else {
			if (c === '"') {
				inQuotes = true;
				i++;
				continue;
			}
			if (c === ';') {
				row.push(field);
				field = '';
				i++;
				continue;
			}
			if (c === '\r' && raw[i + 1] === '\n') {
				row.push(field);
				rows.push(row);
				row = [];
				field = '';
				i += 2;
				continue;
			}
			if (c === '\n' || c === '\r') {
				row.push(field);
				rows.push(row);
				row = [];
				field = '';
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

function main() {
	const csvText = readFileSync(CSV_PATH, 'utf-8');
	const rows = parseCsv(csvText);
	if (rows.length === 0) throw new Error('Empty CSV');
	const header = rows[0].map((h) => h.trim());
	const idIdx = header.indexOf('ID');
	const frIdx = header.indexOf('French_Translation');
	if (idIdx < 0 || frIdx < 0) {
		throw new Error(`Required columns not found: ID=${idIdx} French_Translation=${frIdx}`);
	}

	const frById = new Map<number, string>();
	for (const r of rows.slice(1)) {
		const idStr = (r[idIdx] ?? '').trim();
		if (!idStr) continue;
		const id = Number(idStr);
		if (!Number.isFinite(id)) continue;
		const fr = (r[frIdx] ?? '').trim();
		if (!fr) continue;
		// Multiple rows per id can exist; keep the first non-empty value.
		if (!frById.has(id)) frById.set(id, fr);
	}

	const quotes = JSON.parse(readFileSync(QUOTES_PATH, 'utf-8'));

	let updated = 0;
	let untranslated = 0;
	for (const q of quotes) {
		const fr = frById.get(q.id);
		if (fr) {
			q.fr = fr;
			updated++;
		} else if (!q.fr || !q.fr.trim()) {
			q.status = 'draft';
			untranslated++;
		}
		const parsed = QuoteSchema.safeParse(q);
		if (!parsed.success) {
			console.error(`Quote ${q.id} failed schema validation after merge:`, parsed.error.issues);
			process.exit(1);
		}
	}

	writeFileSync(QUOTES_PATH, JSON.stringify(quotes, null, 2) + '\n', 'utf-8');
	console.log(`merged: ${updated} quotes now have fr (from CSV)`);
	console.log(`flagged: ${untranslated} quotes marked status='draft' (no FR available)`);
	console.log(`total quotes: ${quotes.length}`);
}

main();
