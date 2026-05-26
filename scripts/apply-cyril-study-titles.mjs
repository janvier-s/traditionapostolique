import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/lib/data/quotes.json', import.meta.url);
const quotes = JSON.parse(readFileSync(FILE, 'utf8'));

const NOTE_NO_MIGNE = "studyTitle attribué d'après le contenu du texte (pas de référence Migne).";

const updates = {
	245: {
		studyTitle: 'Catéchèse 18. Sur la résurrection des morts.',
		notes:
			'Données à vérifier: le champ migne contient une valeur corrompue (« 0.7631944… », vraisemblablement une date Excel mal interprétée). La référence correcte se trouve dans le champ reference (PG 33.1040). Texte identique à la citation #307 — possible doublon.'
	},
	295: { studyTitle: 'Catéchèse 2. Sur la pénitence.' },
	296: { studyTitle: 'Catéchèse 3. Sur le baptême.' },
	297: { studyTitle: 'Catéchèse 3. Sur le baptême.' },
	298: { studyTitle: 'Catéchèse 4. Sur les dix dogmes.' },
	299: { studyTitle: 'Catéchèse 4. Sur les dix dogmes.', notes: NOTE_NO_MIGNE },
	300: { studyTitle: 'Catéchèse 6. Sur la monarchie divine.', notes: NOTE_NO_MIGNE },
	301: { studyTitle: 'Catéchèse 10. Sur le Seigneur Jésus-Christ.' },
	302: { studyTitle: 'Catéchèse 15. Sur la seconde venue du Christ.' },
	303: { studyTitle: 'Catéchèse 15. Sur la seconde venue du Christ.' },
	304: { studyTitle: 'Catéchèse 17. Sur le Saint-Esprit, II.' },
	305: { studyTitle: 'Catéchèse 18. Sur la résurrection des morts.' },
	306: { studyTitle: 'Catéchèse 18. Sur la résurrection des morts.' },
	307: {
		studyTitle: 'Catéchèse 18. Sur la résurrection des morts.',
		notes: 'Données à vérifier: texte identique à la citation #245 — possible doublon.'
	},
	308: { studyTitle: 'Catéchèse 18. Sur la résurrection des morts.' },
	309: { studyTitle: 'Catéchèse 18. Sur la résurrection des morts.' },
	310: { studyTitle: 'Catéchèse mystagogique 2. Sur le baptême.' },
	311: { studyTitle: 'Catéchèse mystagogique 3. Sur la chrismation.' },
	312: { studyTitle: 'Catéchèse mystagogique 4. Sur le Corps et le Sang du Christ.' },
	313: { studyTitle: 'Catéchèse mystagogique 4. Sur le Corps et le Sang du Christ.' },
	314: { studyTitle: 'Catéchèse mystagogique 4. Sur le Corps et le Sang du Christ.' },
	315: { studyTitle: 'Catéchèse mystagogique 5. Sur la sainte liturgie.' },
	316: { studyTitle: 'Catéchèse mystagogique 5. Sur la sainte liturgie.' }
};

let touched = 0;
for (const q of quotes) {
	const u = updates[q.id];
	if (!u) continue;
	if (q.workId !== 110)
		throw new Error(`Quote ${q.id} is not workId 110 (Conférences catéchétiques)`);
	if (q.studyTitle) throw new Error(`Quote ${q.id} already has a studyTitle: ${q.studyTitle}`);
	if (u.notes && q.notes) throw new Error(`Quote ${q.id} already has notes: ${q.notes}`);
	q.studyTitle = u.studyTitle;
	if (u.notes) q.notes = u.notes;
	touched++;
}

if (touched !== Object.keys(updates).length) {
	throw new Error(`Expected ${Object.keys(updates).length} updates, applied ${touched}`);
}

writeFileSync(FILE, JSON.stringify(quotes, null, '\t') + '\n');
console.log(`Updated ${touched} quotes.`);
