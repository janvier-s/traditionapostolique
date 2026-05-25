import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/lib/data/quotes.json', import.meta.url);
const quotes = JSON.parse(readFileSync(FILE, 'utf8'));

const updates = {
	777: { studyTitle: 'Livre I, ch. 4.' },
	778: { studyTitle: 'Livre I, ch. 7–8.' },
	779: { studyTitle: 'Livre I, ch. 12.' },
	780: { studyTitle: 'Livre I, ch. 13.' },
	781: { studyTitle: 'Livre I, ch. 14.' },
	782: { studyTitle: 'Livre II, ch. 15.' },
	783: { studyTitle: 'Livre II, ch. 15.' },
	784: { studyTitle: 'Livre II, ch. 16.' },
	785: { studyTitle: 'Livre III, ch. 28–29.' }
};

let touched = 0;
for (const q of quotes) {
	const u = updates[q.id];
	if (!u) continue;
	if (q.workId !== 291) throw new Error(`Quote ${q.id} is not workId 291 (À Autolycus)`);
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
