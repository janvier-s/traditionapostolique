/*
 * Data normalization pass for authors + quotes:
 *
 *   1. Strip LLM-thinking-trace contamination from quote 406. The
 *      Apostolic Tradition translation leaked the model's reasoning;
 *      the actual French starts after a `<ctrl95>` marker.
 *
 *   2. Delete broken author rows that came from malformed XLSX cells:
 *      · id=1001 · the "name" is an entire CSV row (URLs + Anonyme).
 *        Has 0 quotes and 0 works · safe to drop.
 *      · id=1055 · name is the single letter "c". Has 0 quotes but
 *        owns 1 work (`Canon apostolique`). Reassign that work to
 *        the existing "Anonyme" author (id=67), then drop id=1055.
 *
 *   3. Normalize honorific prefixes on author names:
 *      · `St ` / `St. ` → `Saint `
 *      · French ordinals on pope-names: `1e` / `1er` → `Ier`,
 *        `2e` → `IIe`, etc. (only when they sit on the trailing
 *        position of a name like "Damase 1e" → "Damase Ier".)
 *
 *   4. Regenerate slugs for renamed authors so the URLs match the
 *      cleaned name. Existing slugs are kept as redirect candidates
 *      only if a future need arises · for now, the prototype phase
 *      makes slug churn acceptable.
 *
 * Idempotent · re-running on already-clean data is a no-op.
 *
 *   node scripts/normalize-authors.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const AUTHORS_PATH = 'src/lib/data/authors.json';
const WORKS_PATH = 'src/lib/data/works.json';
const QUOTES_PATH = 'src/lib/data/quotes.json';

function slugify(s) {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

const ROMAN = [
	'',
	'Ier',
	'IIe',
	'IIIe',
	'IVe',
	'Ve',
	'VIe',
	'VIIe',
	'VIIIe',
	'IXe',
	'Xe',
	'XIe',
	'XIIe',
	'XIIIe',
	'XIVe',
	'XVe'
];

function normalizeName(raw) {
	let s = raw.trim();
	// User-preferred convention: abbreviated "St." / "Ste." for canonised
	// fathers (vs the longer "Saint" / "Sainte"). Normalises every variant
	// to the abbreviated form, including the plain "St" (no period).
	s = s.replace(/\bSaint /g, 'St. ');
	s = s.replace(/\bSainte /g, 'Ste. ');
	s = s.replace(/\bSt /g, 'St. ');
	// Trailing French ordinal forms · "Damase 1e" / "Damase 1er" / "Pierre 2e" → "Damase Ier"
	s = s.replace(/\s(\d{1,2})(?:e|er|ère|eme|ème|nd)?\b\s*$/i, (m, n) => ' ' + (ROMAN[Number(n)] || `${n}e`));
	// Collapse double spaces / period-period sequences left by the above.
	s = s.replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
	return s;
}

const authors = JSON.parse(readFileSync(AUTHORS_PATH, 'utf8'));
const works = JSON.parse(readFileSync(WORKS_PATH, 'utf8'));
const quotes = JSON.parse(readFileSync(QUOTES_PATH, 'utf8'));

// --- 1. Quote 406 contamination ----------------------------------------
let quote406Fixed = false;
const q406 = quotes.find((q) => q.id === 406);
if (q406 && q406.fr && q406.fr.includes('<ctrl94>')) {
	const idx = q406.fr.indexOf('<ctrl95>');
	if (idx > 0) {
		q406.fr = q406.fr.slice(idx + '<ctrl95>'.length).trim();
		quote406Fixed = true;
	}
}

// --- 2. Broken authors -------------------------------------------------
let droppedAuthors = 0;
let reassignedWorks = 0;
const ANONYMOUS_ID = 67; // Existing "Anonyme" author · destination for orphaned works

// Move id=1055's works to Anonyme
for (const w of works) {
	if (w.authorId === 1055) {
		w.authorId = ANONYMOUS_ID;
		reassignedWorks++;
	}
}
const dropIds = new Set([1001, 1055]);
const beforeAuthors = authors.length;
for (let i = authors.length - 1; i >= 0; i--) {
	if (dropIds.has(authors[i].id)) {
		// Defensive check · only drop if there are truly no quotes pointing here.
		const stillUsed = quotes.some((q) => q.authorId === authors[i].id);
		if (!stillUsed) {
			authors.splice(i, 1);
			droppedAuthors++;
		}
	}
}

// --- 3. Name normalization + slug regen --------------------------------
let renamed = 0;
const renames = [];
for (const a of authors) {
	const fresh = normalizeName(a.name);
	if (fresh !== a.name) {
		renames.push(`${a.name} → ${fresh}`);
		a.name = fresh;
		a.slug = slugify(fresh + '-' + a.id);
		renamed++;
	}
}

writeFileSync(AUTHORS_PATH, JSON.stringify(authors, null, 2) + '\n');
writeFileSync(WORKS_PATH, JSON.stringify(works, null, 2) + '\n');
writeFileSync(QUOTES_PATH, JSON.stringify(quotes, null, 2) + '\n');

process.stdout.write(
	JSON.stringify(
		{
			quote406Fixed,
			droppedAuthors,
			reassignedWorks,
			renamed,
			renames
		},
		null,
		2
	) + '\n'
);
