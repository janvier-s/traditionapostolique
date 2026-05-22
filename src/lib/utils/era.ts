import type { Era } from '$lib/schema';

export const eraOrder: Era[] = ['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval'];

const LABEL: Record<Era, string> = {
	apostolic: 'Pères apostoliques',
	'ante-nicene': 'Pré-nicéens',
	nicene: 'Nicéens',
	'post-nicene': 'Post-nicéens',
	medieval: 'Médiévaux'
};
export function eraLabel(e: Era): string {
	return LABEL[e];
}

// Singular masculine · used under a single author's name to describe
// what they are (e.g. "Père apostolique", "Nicéen").
const LABEL_SINGULAR: Record<Era, string> = {
	apostolic: 'Père apostolique',
	'ante-nicene': 'Pré-nicéen',
	nicene: 'Nicéen',
	'post-nicene': 'Post-nicéen',
	medieval: 'Médiéval'
};
export function eraLabelSingular(e: Era): string {
	return LABEL_SINGULAR[e];
}

// Singular feminine · agrees with a feminine noun like "Ère" or
// "Époque" when used as the value of an Ère: field in the study panel.
const LABEL_FEMININE: Record<Era, string> = {
	apostolic: 'Apostolique',
	'ante-nicene': 'Pré-nicéenne',
	nicene: 'Nicéenne',
	'post-nicene': 'Post-nicéenne',
	medieval: 'Médiévale'
};
export function eraLabelFeminine(e: Era): string {
	return LABEL_FEMININE[e];
}

const MID: Record<Era, number> = {
	apostolic: 75,
	'ante-nicene': 225,
	nicene: 350,
	'post-nicene': 500,
	medieval: 1100
};
export function eraMidpoint(e: Era): number {
	return MID[e];
}
