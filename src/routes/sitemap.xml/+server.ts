import { topics, authors, works, quotes } from '$lib/data';

const SITE = 'https://traditionapostolique.fr';

// Build-time timestamp · used as <lastmod> for every URL since this
// site is statically prerendered and every entry rebuilds together.
const BUILD_DATE = new Date().toISOString().slice(0, 10);

type Freq = 'weekly' | 'monthly' | 'yearly';
type Entry = { loc: string; changefreq: Freq; priority: string };

const STATIC_ROUTES: Entry[] = [
	{ loc: '/', changefreq: 'monthly', priority: '1.0' },
	{ loc: '/sujets', changefreq: 'weekly', priority: '0.9' },
	{ loc: '/peres', changefreq: 'weekly', priority: '0.9' },
	{ loc: '/oeuvres', changefreq: 'weekly', priority: '0.9' },
	{ loc: '/recherche', changefreq: 'monthly', priority: '0.6' },
	{ loc: '/a-propos', changefreq: 'yearly', priority: '0.5' },
	{ loc: '/mentions-legales', changefreq: 'yearly', priority: '0.3' }
];

export const prerender = true;

export function GET() {
	const entries: Entry[] = [
		...STATIC_ROUTES,
		...topics.map((t) => ({
			loc: `/sujets/${t.slug}`,
			changefreq: 'weekly' as const,
			priority: '0.8'
		})),
		...authors.map((a) => ({
			loc: `/peres/${a.slug}`,
			changefreq: 'monthly' as const,
			priority: '0.7'
		})),
		...works.map((w) => ({
			loc: `/oeuvres/${w.slug}`,
			changefreq: 'monthly' as const,
			priority: '0.6'
		})),
		...quotes.map((q) => ({
			loc: `/citation/${q.id}`,
			changefreq: 'yearly' as const,
			priority: '0.4'
		}))
	];

	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		entries
			.map(
				(e) =>
					`  <url><loc>${SITE}${e.loc}</loc><lastmod>${BUILD_DATE}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
			)
			.join('\n') +
		`\n</urlset>\n`;

	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
