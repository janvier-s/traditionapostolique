/*
 * One-shot data migration · drop the trailing `-N` (id) suffix from
 * every topic slug in topics.json. The 49 topic labels are unique so
 * the bare slugified label is enough to identify a topic, and the
 * shorter URL reads cleaner ("/sujets/la-regeneration-baptismale"
 * vs "/sujets/la-regeneration-baptismale-25").
 *
 * The import script (scripts/import-xlsx.ts) is also updated so a
 * fresh XLSX import produces the same shorter slugs.
 *
 * Idempotent · only touches slugs that still carry an id suffix.
 *
 *   node scripts/fix-topic-slugs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/lib/data/topics.json';

function slugify(s) {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

const topics = JSON.parse(readFileSync(PATH, 'utf8'));
const seen = new Set();
let changed = 0;
for (const t of topics) {
	const fresh = slugify(t.label);
	if (seen.has(fresh)) {
		// Collision · keep the id-suffixed version to disambiguate.
		console.error(`! collision on "${fresh}" for topic ${t.id}, keeping ${t.slug}`);
		continue;
	}
	seen.add(fresh);
	if (t.slug !== fresh) {
		t.slug = fresh;
		changed++;
	}
}

writeFileSync(PATH, JSON.stringify(topics, null, 2) + '\n');
process.stdout.write(`updated ${changed} topic slug(s)\n`);
