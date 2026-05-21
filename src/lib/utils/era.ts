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
