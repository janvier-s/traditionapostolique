import { topics, authors, works, quotes } from '$lib/data';

const STATIC_ROUTES = [
	'/',
	'/sujets',
	'/peres',
	'/oeuvres',
	'/recherche',
	'/a-propos',
	'/mentions-legales'
];

export const prerender = true;

export function GET() {
	const urls = [
		...STATIC_ROUTES,
		...topics.map((t) => `/sujets/${t.slug}`),
		...authors.map((a) => `/peres/${a.slug}`),
		...works.map((w) => `/oeuvres/${w.slug}`),
		...quotes.map((q) => `/citation/${q.id}`)
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>https://traditionapostolique.fr${u}</loc></url>`).join('\n')}
</urlset>`;

	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
