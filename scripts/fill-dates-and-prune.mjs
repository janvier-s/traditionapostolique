/*
 * Data pass:
 *
 *   1. Fill educated-guess dates for authors who have quotes but no
 *      dates in the data. Standard patristic / ecclesiastical-history
 *      death-year ranges. "Anonyme" and unknown pseudo-authors are
 *      left undated.
 *
 *   2. Defensive name normalization · catch a few stragglers the
 *      St./Saint normalization missed (lowercase letters in places
 *      they shouldn't be, missing accent on "Grégoire").
 *
 *   3. (Optional · disabled by default since the user wants to KEEP
 *      authors and works with no quotes so the lacunæ stay visible.)
 *      With PRUNE=1, delete works/authors with no quote children.
 *
 * Idempotent · re-running on already-clean data is a no-op.
 *
 *   node scripts/fill-dates-and-prune.mjs            · dates + names only
 *   PRUNE=1 node scripts/fill-dates-and-prune.mjs    · also prune orphans
 */
import { readFileSync, writeFileSync } from 'node:fs';

const AUTHORS_PATH = 'src/lib/data/authors.json';
const WORKS_PATH = 'src/lib/data/works.json';
const QUOTES_PATH = 'src/lib/data/quotes.json';

// Educated-guess dates keyed by author id. Sources: standard
// patrology references (Quasten, Drobner, Cross & Livingstone).
// Format mirrors the rest of the data: "<birth>-<death>" or
// "?-<death>" / "<birth>-?" when one bound is uncertain, or a
// "c. NNN" string for symbolic/anonymous works.
const DATES_BY_ID = {
	32: 'c. 100-160', // Hermas (Shepherd of Hermas, mid 2nd c.)
	57: 'c. 6-100', // St. Jean (apostle, traditional)
	59: 'c. 1-64', // St. Pierre (apostle, martyred under Nero)
	68: '470-543', // Césaire d'Arles
	1002: '378-432', // Pape Célestin Ier
	1003: '272-337', // Constantin
	1004: '305-384', // Pape St. Damase Ier
	1006: '345-399', // Évagre le Pontique
	1007: 'c. 200-269', // Firmilien de Césarée
	1008: '462-533', // St. Fulgence de Ruspe
	1009: '540-604', // Pape St. Grégoire Ier
	1010: 'c. 110-180', // St. Hégésippe
	1011: '?-417', // Pape St. Innocent Ier
	1012: '?-352', // Pape St. Jules Ier
	1013: 'c. 400-461', // Pape St. Léon Ier
	1014: 'c. 400-450', // Léporius
	1015: 'c. 310-391', // St. Pacien de Barcelone
	1016: 'c. 385-461', // St. Patrick
	1017: 'c. 350', // Pectorius d'Autun (epitaph)
	1018: '380-450', // St. Pierre Chrysologue
	1019: '?-250', // St. Pion de Smyrne
	1020: 'c. 390-455', // St. Prosper d'Aquitaine
	1021: '4e siècle', // Pseudo-Ignace
	1023: '4e-5e siècle', // Pseudo-Justin
	1025: 'c. 372-447', // St. Sechnall d'Irlande
	1026: 'c. 140-160', // 2 Clément (Segond Clément)
	1027: '?-360', // St. Sérapion de Thmuis
	1028: '334-399', // Pape St. Siricius Ier
	1029: 'c. 400-450', // Sozomène de Constantinople
	1030: '350-428', // Théodore de Mopsueste
	1032: '1015-1085' // Pape St. Grégoire VII
};

// Name patches · catch typos and minor irregularities the
// normalize-authors script didn't reach.
const NAME_PATCHES = {
	1032: 'Pape St. Grégoire VII'
};

const authors = JSON.parse(readFileSync(AUTHORS_PATH, 'utf8'));
const works = JSON.parse(readFileSync(WORKS_PATH, 'utf8'));
const quotes = JSON.parse(readFileSync(QUOTES_PATH, 'utf8'));

// --- 1. Fill dates -----------------------------------------------------
let datesFilled = 0;
for (const a of authors) {
	if (!a.dates && DATES_BY_ID[a.id]) {
		a.dates = DATES_BY_ID[a.id];
		datesFilled++;
	}
}

// --- 2. Name patches ---------------------------------------------------
let namesPatched = 0;
for (const a of authors) {
	if (NAME_PATCHES[a.id] && a.name !== NAME_PATCHES[a.id]) {
		a.name = NAME_PATCHES[a.id];
		namesPatched++;
	}
	// Catch any residual "Saint" prefix even after the normalize pass.
	if (/\bSaint /.test(a.name)) {
		a.name = a.name.replace(/\bSaint /g, 'St. ');
		namesPatched++;
	}
	// Catch any "St. Saint" / "St. St." duplications introduced by an
	// over-eager re-normalization.
	if (/\b(St\.|Ste\.)\s+\1/.test(a.name)) {
		a.name = a.name.replace(/\b(St\.|Ste\.)\s+\1/, '$1');
		namesPatched++;
	}
}

// --- 3. (Optional) prune orphans · only when PRUNE=1 -------------------
let droppedAuthors = 0;
let droppedWorks = 0;
let outAuthors = authors;
let outWorks = works;

if (process.env.PRUNE === '1') {
	const usedAuthorIds = new Set(quotes.map((q) => q.authorId));
	const usedWorkIds = new Set(quotes.filter((q) => q.workId != null).map((q) => q.workId));
	const survivingAuthors = authors.filter((a) => usedAuthorIds.has(a.id));
	const survivingAuthorIds = new Set(survivingAuthors.map((a) => a.id));
	const survivingWorks = works.filter(
		(w) => usedWorkIds.has(w.id) && survivingAuthorIds.has(w.authorId)
	);
	droppedAuthors = authors.length - survivingAuthors.length;
	droppedWorks = works.length - survivingWorks.length;
	outAuthors = survivingAuthors;
	outWorks = survivingWorks;
}

writeFileSync(AUTHORS_PATH, JSON.stringify(outAuthors, null, 2) + '\n');
writeFileSync(WORKS_PATH, JSON.stringify(outWorks, null, 2) + '\n');
writeFileSync(QUOTES_PATH, JSON.stringify(quotes, null, 2) + '\n');

process.stdout.write(
	JSON.stringify(
		{
			datesFilled,
			namesPatched,
			droppedAuthors,
			droppedWorks,
			authorsAfter: outAuthors.length,
			worksAfter: outWorks.length,
			quotesAfter: quotes.length
		},
		null,
		2
	) + '\n'
);
