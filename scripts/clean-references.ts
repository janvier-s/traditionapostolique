/*
 * One-shot data migration:
 *
 *   1. Translate English structural citation words to French inside the
 *      `reference` field of quotes.json AND the `title` field of works.json
 *      (Book → Livre, Chapter → Chapitre, etc.).
 *
 *   2. Strip Excel-artifact references · these are quote.reference values
 *      that survived the original XLSX import as raw serial numbers like
 *      "1.37581018518519" (Excel auto-converted citation strings such as
 *      "1:37" into TIME/DATETIME floats). They can't be recovered from
 *      the float alone, so we drop the field entirely; if the source
 *      spreadsheet is ever re-imported with the cells coerced to text
 *      first, the references will reappear with real data.
 *
 * Run with:
 *   npx tsx scripts/clean-references.ts
 *
 * Idempotent · safe to re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUOTES_PATH = join(process.cwd(), 'src/lib/data/quotes.json');
const WORKS_PATH = join(process.cwd(), 'src/lib/data/works.json');

const FR_TERMS: [RegExp, string][] = [
	[/\bBooks\b/g, 'Livres'],
	[/\bBook\b/g, 'Livre'],
	[/\bbooks\b/g, 'livres'],
	[/\bbook\b/g, 'livre'],
	[/\bChapters\b/g, 'Chapitres'],
	[/\bChapter\b/g, 'Chapitre'],
	[/\bchapters\b/g, 'chapitres'],
	[/\bchapter\b/g, 'chapitre'],
	[/\bVerses\b/g, 'Versets'],
	[/\bVerse\b/g, 'Verset'],
	[/\bverses\b/g, 'versets'],
	[/\bverse\b/g, 'verset'],
	[/\bLetters\b/g, 'Lettres'],
	[/\bLetter\b/g, 'Lettre'],
	[/\bHomilies\b/g, 'Homélies'],
	[/\bHomily\b/g, 'Homélie'],
	[/\bPreface\b/g, 'Préface'],
	[/\bMandates\b/g, 'Mandats'],
	[/\bMandate\b/g, 'Mandat'],
	[/\bCouncil\b/g, 'Concile'],
	[/\bcouncil\b/g, 'concile'],
	[/\bSynod\b/g, 'Synode'],
	[/\bSynods\b/g, 'Synodes'],
	[/\bTreatise\b/g, 'Traité'],
	[/\bDiscourse\b/g, 'Discours'],
	[/\bEpistle\b/g, 'Épître'],
	[/\bEpistles\b/g, 'Épîtres'],
	[/\bApology\b/g, 'Apologie'],
	[/\bOration\b/g, 'Oraison'],
	[/\bCommentary\b/g, 'Commentaire'],
	[/\bHymn\b/g, 'Hymne'],
	[/\bHymns\b/g, 'Hymnes'],
	[/\bCatechism\b/g, 'Catéchèse'],
	[/\bCatechetical\b/g, 'Catéchétique'],
	// Place-name translations · only the ones we have in the data. Keep
	// this list tight to avoid corrupting legitimate non-French placenames
	// that happen to appear in citations.
	[/\bAnkara\b/g, 'Ancyre'],
	[/\bChalcedon\b/g, 'Chalcédoine'],
	[/\bEphesus\b/g, 'Éphèse'],
	[/\bHippo\b/g, 'Hippone'],
	[/\bLaodicea\b/g, 'Laodicée'],
	[/\bNicaea\b/g, 'Nicée'],
	[/\bSardica\b/g, 'Sardique'],
	[/\bof\b/g, 'de'],
	[/\bfrom\b/g, 'de'],
	// French elision · lowercase "de" before a vowel or silent h becomes
	// "d'" (Concile de Ancyre → Concile d'Ancyre, etc.). We skip the
	// capitalised "De" because that's the canonical opener of Latin work
	// titles (De Trinitate, De Civitate Dei) which must not be touched.
	[/\bde (?=[AEIOUHaeiouhÀÉÈÊËÎÏÔÙÛàéèêëîïôùû])/g, "d'"]
];

function translate(s: string): string {
	let out = s;
	for (const [re, rep] of FR_TERMS) out = out.replace(re, rep);
	return out;
}

function isExcelArtifact(ref: string): boolean {
	return /^[\d.]+$/.test(ref.trim());
}

type Quote = { reference?: string; [k: string]: unknown };
type Work = { title: string; [k: string]: unknown };

const quotes: Quote[] = JSON.parse(readFileSync(QUOTES_PATH, 'utf8'));
const works: Work[] = JSON.parse(readFileSync(WORKS_PATH, 'utf8'));

let refsCleared = 0;
let refsTranslated = 0;
let titlesTranslated = 0;

for (const q of quotes) {
	if (!q.reference) continue;
	if (isExcelArtifact(q.reference)) {
		delete q.reference;
		refsCleared++;
		continue;
	}
	const before = q.reference;
	const after = translate(before);
	if (after !== before) {
		q.reference = after;
		refsTranslated++;
	}
}

for (const w of works) {
	const before = w.title;
	const after = translate(before);
	if (after !== before) {
		w.title = after;
		titlesTranslated++;
	}
}

writeFileSync(QUOTES_PATH, JSON.stringify(quotes, null, 2) + '\n');
writeFileSync(WORKS_PATH, JSON.stringify(works, null, 2) + '\n');

console.log(JSON.stringify({ refsCleared, refsTranslated, titlesTranslated }, null, 2));
