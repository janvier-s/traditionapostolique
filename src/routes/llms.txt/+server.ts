import { authors, works, quotes, taxonomy, topicById } from '$lib/data';

export const prerender = true;

const SITE = 'https://traditionapostolique.fr';

// Curated llms.txt per https://llmstxt.org · a structured markdown
// index that helps LLM crawlers find the canonical entry points and
// understand what kind of corpus this is. Generated from the live data
// so author / work / topic lists never go stale relative to the JSON.
export function GET() {
	const PILLAR_LABELS: Record<string, string> = {
		dieu: 'Dieu, Trinité, Christ',
		eglise: "L'Église et ses sources",
		saints: 'Marie, les saints, miracles',
		sacrements: 'Sacrements et liturgie',
		vie: 'Vie chrétienne et prière',
		fin: 'Les fins dernières'
	};

	// Headline authors · quote-count sorted so the most-cited Fathers
	// surface first in the index. Capped to keep llms.txt readable.
	const quoteCounts = new Map<number, number>();
	for (const q of quotes) quoteCounts.set(q.authorId, (quoteCounts.get(q.authorId) ?? 0) + 1);
	const headlineAuthors = [...authors]
		.map((a) => ({ a, n: quoteCounts.get(a.id) ?? 0 }))
		.filter(({ n }) => n > 0)
		.sort((x, y) => y.n - x.n)
		.slice(0, 40);

	// Most-cited works · same idea.
	const workCounts = new Map<number, number>();
	for (const q of quotes)
		if (q.workId != null) workCounts.set(q.workId, (workCounts.get(q.workId) ?? 0) + 1);
	const headlineWorks = [...works]
		.map((w) => ({ w, n: workCounts.get(w.id) ?? 0 }))
		.filter(({ n }) => n > 0)
		.sort((x, y) => y.n - x.n)
		.slice(0, 30);

	// Collect all topic refs from a taxonomy subtree (depth-first)
	function collectTopicRefs(nodes: typeof taxonomy.dieu): { label: string; slug: string }[] {
		const result: { label: string; slug: string }[] = [];
		for (const n of nodes) {
			if (n.topicId != null) {
				const t = topicById(n.topicId);
				if (t) result.push({ label: t.label, slug: t.slug });
			}
			if (n.children) result.push(...collectTopicRefs(n.children));
		}
		return result;
	}

	const totalTopics =
		Object.values(taxonomy).reduce((acc, nodes) => acc + collectTopicRefs(nodes).length, 0);

	const lines: string[] = [
		'# Tradition Apostolique',
		'',
		"> Anthologie française du témoignage des Pères de l'Église, organisée par sujets. " +
			'Chaque citation est traduite directement du grec, du latin ou du syriaque, souvent ' +
			'pour la première fois en français, et reliée à son auteur, à son œuvre source et ' +
			"aux sujets théologiques qu'elle éclaire.",
		'',
		`Corpus actuel : **${authors.length} auteurs**, **${works.length} œuvres**, ` +
			`**${quotes.length} citations**, **${totalTopics} sujets**.`,
		'',
		'## Entrées principales',
		'',
		`- [Accueil](${SITE}/) — présentation du projet et de la démarche patristique`,
		`- [Tous les sujets](${SITE}/sujets) — index thématique des articles de la foi`,
		`- [Tous les Pères](${SITE}/peres) — index des auteurs (Pères, papes, conciles, écrits anonymes)`,
		`- [Toutes les œuvres](${SITE}/oeuvres) — index des textes sources`,
		`- [Recherche](${SITE}/recherche) — recherche plein-texte dans tout le corpus`,
		`- [À propos](${SITE}/a-propos) — méthodologie et sources`,
		'',
		'## Sujets par pilier théologique',
		''
	];

	const pillars = ['dieu', 'eglise', 'saints', 'sacrements', 'vie', 'fin'] as const;
	for (const p of pillars) {
		const topicRefs = collectTopicRefs(taxonomy[p]);
		if (topicRefs.length === 0) continue;
		lines.push(`### ${PILLAR_LABELS[p]}`);
		lines.push('');
		for (const { label, slug } of topicRefs) {
			lines.push(`- [${label}](${SITE}/sujets/${slug})`);
		}
		lines.push('');
	}

	lines.push('## Pères les plus cités');
	lines.push('');
	for (const { a, n } of headlineAuthors) {
		const dates = a.dates ? ` (${a.dates})` : '';
		lines.push(`- [${a.name}${dates}](${SITE}/peres/${a.slug}) — ${n} citation${n > 1 ? 's' : ''}`);
	}
	lines.push('');

	lines.push('## Œuvres les plus citées');
	lines.push('');
	for (const { w, n } of headlineWorks) {
		lines.push(`- [${w.title}](${SITE}/oeuvres/${w.slug}) — ${n} citation${n > 1 ? 's' : ''}`);
	}
	lines.push('');

	lines.push('## Optional');
	lines.push('');
	lines.push(`- [Sitemap XML](${SITE}/sitemap.xml) — toutes les URL canoniques`);
	lines.push(`- [robots.txt](${SITE}/robots.txt)`);
	lines.push('');

	lines.push('## À propos du corpus');
	lines.push('');
	lines.push(
		"Les Pères de l'Église sont les évêques, théologiens, martyrs et témoins privilégiés du " +
			'premier millénaire chrétien. Quand leur enseignement converge de manière large et ' +
			'constante, ce que la théologie catholique appelle le *consensus patrum*, leur accord ' +
			'possède une autorité doctrinale singulière. Le corpus inclut également des conciles ' +
			'locaux et œcuméniques, des papes, et plusieurs écrits anonymes ou pseudonymes de ' +
			"l'Antiquité chrétienne (Didachè, Constitutions apostoliques, lettres, martyrologes, " +
			'inscriptions épigraphiques).'
	);

	return new Response(lines.join('\n') + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
}
