import { topics, authors, works, quotes } from '$lib/data';

export const prerender = true;

export function GET() {
	const body = [
		'# Tradition Apostolique',
		"Anthologie patristique française organisée par sujets · témoignage des Pères de l'Église.",
		'',
		'## Stats',
		`- Auteurs: ${authors.length}`,
		`- Œuvres: ${works.length}`,
		`- Sujets: ${topics.length}`,
		`- Citations: ${quotes.length}`,
		'',
		'## Routes',
		'- /sujets',
		'- /sujets/[slug]',
		'- /peres',
		'- /peres/[slug]',
		'- /oeuvres',
		'- /oeuvres/[slug]',
		'- /citation/[id]',
		'- /recherche'
	].join('\n');

	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
