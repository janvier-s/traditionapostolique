import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/lib/data/quotes.json', import.meta.url);
const quotes = JSON.parse(readFileSync(FILE, 'utf8'));

const NOTE_SECTION = 'studyTitle à compléter (section).';
const NOTE_CH_SECTION = 'studyTitle à compléter (chapitre et section).';

const updates = {
	454: { studyTitle: 'Livre I, ch. 10, § 1.' },
	455: { studyTitle: 'Livre I, ch. 10, § 2.' },
	456: { studyTitle: 'Livre I, ch. 13.', notes: NOTE_SECTION },
	457: { studyTitle: 'Livre I, ch. 13, § 7.' },
	458: { studyTitle: 'Livre II, ch. 1.', notes: NOTE_SECTION },
	459: { studyTitle: 'Livre II, ch. 10.', notes: NOTE_SECTION },
	460: { studyTitle: 'Livre II, ch. 13.', notes: NOTE_SECTION },
	461: { studyTitle: 'Livre II, ch. 13.', notes: NOTE_SECTION },
	462: { studyTitle: 'Livre II, ch. 22, § 5.' },
	463: { studyTitle: 'Livre II, ch. 27.', notes: NOTE_SECTION },
	464: {
		studyTitle: 'Livre II, ch. 30.',
		notes: `${NOTE_SECTION} Numérotation Migne; les éditions critiques (SC) numérotent parfois ce chapitre 33.`
	},
	465: { studyTitle: 'Livre III, ch. 3.', notes: NOTE_SECTION },
	466: {
		studyTitle: 'Livre III.',
		notes: `${NOTE_CH_SECTION} Données à vérifier: le texte français correspond à Livre II, ch. 33 (Platon et métempsycose), mais la colonne Migne PG.7.847 indique Livre III.`
	},
	467: { studyTitle: 'Livre III, ch. 3, § 3.' },
	468: { studyTitle: 'Livre III, ch. 3, § 4.' },
	469: { studyTitle: 'Livre III, ch. 4.', notes: NOTE_SECTION },
	470: { studyTitle: 'Livre III, ch. 19.', notes: NOTE_SECTION },
	471: { studyTitle: 'Livre III, ch. 22, § 4.' },
	472: { studyTitle: 'Livre IV.', notes: NOTE_CH_SECTION },
	473: { studyTitle: 'Livre IV.', notes: NOTE_CH_SECTION },
	474: { studyTitle: 'Livre V, ch. 2.', notes: NOTE_SECTION },
	475: { studyTitle: 'Livre V.', notes: NOTE_CH_SECTION },
	476: {
		studyTitle: 'Livre V, ch. 18.',
		notes: `${NOTE_SECTION} Données à vérifier: le champ latin contient l'en-tête CAPUT XIX (Livre V, ch. 19), mais le texte français correspond à Livre V, ch. 18.`
	},
	477: { studyTitle: 'Livre V.', notes: NOTE_CH_SECTION },
	478: { studyTitle: 'Livre V, ch. 25.', notes: NOTE_SECTION },
	479: { studyTitle: 'Livre V, ch. 30.', notes: NOTE_SECTION },
	480: { studyTitle: 'Livre V, ch. 30.', notes: NOTE_SECTION },
	481: { studyTitle: 'Livre V, ch. 35.', notes: NOTE_SECTION }
};

let touched = 0;
for (const q of quotes) {
	const u = updates[q.id];
	if (!u) continue;
	if (q.workId !== 172) throw new Error(`Quote ${q.id} is not workId 172 (Against Heresies)`);
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
