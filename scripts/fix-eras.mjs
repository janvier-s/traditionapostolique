/*
 * One-shot data migration to re-derive the `era` field on authors whose
 * current value is `post-nicene` but whose death year clearly places
 * them earlier. The root cause was the import script's fallback ("when
 * the era cell doesn't match a keyword, default to post-nicene"); the
 * import is now fixed (scripts/import-xlsx.ts → `eraFromDates`), so a
 * fresh re-import would reach the same end state. This script lets us
 * apply the same correction to the current authors.json without waiting
 * on the re-import.
 *
 * Idempotent: only touches rows that look wrong.
 *
 *   node scripts/fix-eras.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/lib/data/authors.json';

const APOSTOLIC_FATHERS = new Set(
	[
		'clement de rome',
		'ignace d antioche',
		'polycarpe de smyrne',
		'papias de hierapolis',
		'barnabe',
		'didache',
		'hermas',
		'diognete',
		'mathetes a diognete'
	].map((s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, ''))
);

function nameKey(name) {
	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function eraFromDates(dates, name) {
	if (!dates) return null;
	const ys = String(dates).match(/\d{1,4}/g);
	if (!ys) return null;
	const death = Math.max(...ys.map(Number));
	if (APOSTOLIC_FATHERS.has(nameKey(name))) return 'apostolic';
	if (death <= 100) return 'apostolic';
	if (death <= 325) return 'ante-nicene';
	if (death <= 451) return 'nicene';
	if (death <= 800) return 'post-nicene';
	return 'medieval';
}

const authors = JSON.parse(readFileSync(PATH, 'utf8'));
const before = new Map(authors.map((a) => [a.id, a.era]));
let changed = 0;
const changes = [];
for (const a of authors) {
	const derived = eraFromDates(a.dates, a.name);
	if (!derived) continue;
	if (derived !== a.era) {
		// Only "promote" forward in chronological direction · we never
		// want this script to override a curated apostolic/ante-nicene
		// classification by accident. The intent is solely to undo the
		// fallback-to-post-nicene misclassification, plus the apostolic
		// promotion for the named-list set.
		const moveOut = a.era === 'post-nicene' && derived !== 'post-nicene';
		const promotion =
			(a.era === 'ante-nicene' && derived === 'apostolic') ||
			(a.era === 'nicene' && (derived === 'ante-nicene' || derived === 'apostolic'));
		if (!moveOut && !promotion) continue;
		changes.push(`${a.name} (${a.dates ?? '?'}): ${a.era} → ${derived}`);
		a.era = derived;
		changed++;
	}
}

writeFileSync(PATH, JSON.stringify(authors, null, 2) + '\n');
process.stdout.write(`changed ${changed} author(s)\n`);
for (const c of changes) process.stdout.write('  ' + c + '\n');
