/*
 * Post-import cleanup for the 8 quote rows whose `reference` field can't
 * be cleaned by simple word-substitution:
 *
 *   · 4 rows (205, 206, 210, 212) have full English passages in
 *     `reference` instead of a citation · the spreadsheet column was
 *     misused. We clear the field; the corresponding XLSX rows still
 *     need the real citation entered (likely "Canon XXI", a synodal
 *     decree id, or similar).
 *
 *   · 4 rows (68, 79, 389, 390) have valid citations but mix
 *     English/French/Latin in awkward ways. We rewrite them to clean
 *     French/Latin form.
 *
 * Run with:
 *   npx tsx scripts/fix-references.ts
 *
 * Re-running is safe: each fix matches the exact "before" string, so
 * once applied the script is a no-op until the import overwrites
 * quotes.json again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUOTES_PATH = join(process.cwd(), 'src/lib/data/quotes.json');

type Quote = { id: number; reference?: string; [k: string]: unknown };

const fixes: { id: number; from?: string; to?: string }[] = [
	{
		id: 68,
		from: "section 9 de chapitre 9 de Augustine's De Coniugiis Adulterinis, Livre 1.",
		to: 'De Coniugiis Adulterinis, Livre 1, chapitre 9, section 9'
	},
	{
		id: 79,
		from: 'Source: Augustine de Hippo, Contra duas epistulas Pelagianorum, Liber III, caput 3, paragraph 5 Migne Reference: Patrologia Latina vol. 44, col. 590',
		to: 'Contra duas epistulas Pelagianorum, Liber III, caput 3, paragraphe 5 (PL 44, col. 590)'
	},
	{ id: 205, to: undefined },
	{ id: 206, to: undefined },
	{ id: 210, to: undefined },
	{ id: 212, to: undefined },
	{
		id: 389,
		from: 'The Shepherd de Hermas, Vision 1, Chapitres 1-13',
		to: 'Vision 1, Chapitres 1-13'
	},
	{
		id: 390,
		from: '4th mandate  Section I, paragraph 6',
		to: '4e mandat, Section I, paragraphe 6'
	}
];

const quotes: Quote[] = JSON.parse(readFileSync(QUOTES_PATH, 'utf8'));
const byId = new Map(quotes.map((q) => [q.id, q]));

let applied = 0;
let skipped = 0;
const notFound: number[] = [];

for (const fix of fixes) {
	const q = byId.get(fix.id);
	if (!q) {
		notFound.push(fix.id);
		continue;
	}
	// If `from` is set, only apply when the current value matches · keeps
	// the script idempotent and safe against a future re-import that
	// already shipped the fix.
	if (fix.from != null && q.reference !== fix.from) {
		skipped++;
		continue;
	}
	if (fix.to === undefined) {
		delete q.reference;
	} else {
		q.reference = fix.to;
	}
	applied++;
}

writeFileSync(QUOTES_PATH, JSON.stringify(quotes, null, 2) + '\n');
process.stdout.write(
	JSON.stringify({ applied, skipped, notFound }, null, 2) + '\n'
);
