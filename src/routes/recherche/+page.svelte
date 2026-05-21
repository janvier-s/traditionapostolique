<script lang="ts">
	import MiniSearch from 'minisearch';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	const { data } = $props();

	function buildIndex(json: unknown) {
		return MiniSearch.loadJSON<{ type: string; title: string; slug: string }>(
			JSON.stringify(json),
			{
				fields: ['title', 'body'],
				storeFields: ['type', 'title', 'slug']
			}
		);
	}

	const ms = untrack(() => buildIndex(data.indexJson));

	let q = $state(page.url.searchParams.get('q') ?? '');
	const results = $derived(
		q.trim()
			? ms.search(q, { prefix: true, fuzzy: 0.2, boost: { title: 2 } }).slice(0, 50)
			: []
	);

	const PATH: Record<string, (slug: string) => string> = {
		quote: (slug) => `/citation/${slug.replace(/^citation-/, '')}`,
		author: (slug) => `/peres/${slug}`,
		work: (slug) => `/oeuvres/${slug}`,
		topic: (slug) => `/sujets/${slug}`
	};

	function href(r: Record<string, unknown>): string {
		const type = String(r.type);
		const slug = String(r.slug);
		return PATH[type]?.(slug) ?? '/';
	}
</script>

<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Recherche</h1>
	<input
		type="search"
		bind:value={q}
		placeholder="Chercher…"
		class="mt-4 w-full max-w-reader rounded border border-border bg-panel px-3 py-2 font-ui"
	/>

	{#if q.trim() && results.length === 0}
		<p class="mt-6 italic text-muted">Aucun résultat.</p>
	{/if}

	<ul class="mt-6 space-y-2">
		{#each results as r (r.id)}
			<li>
				<a href={href(r)} class="block rounded border border-border bg-panel p-3 hover:border-accent">
					<span class="font-ui text-xs uppercase text-muted">{r.type}</span>
					<span class="ml-2 font-heading">{r.title}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>
