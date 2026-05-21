<script lang="ts">
	import { buildTopicTree, authors, quotes } from '$lib/data';
	import SectionTile from '$lib/components/peres/SectionTile.svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const tree = buildTopicTree();
	const featuredAuthors = authors.slice(0, 6);
	const totalQuotes = quotes.length;
</script>

<MetaTags title="Accueil" description="Anthologie patristique française organisée par sujets." />

<section class="border-b border-border px-6 py-12">
	<h1 class="font-heading text-4xl text-heading md:text-5xl">Pères de l'Église</h1>
	<p class="mt-3 max-w-reader font-body text-lg text-muted">
		Anthologie patristique française organisée par sujets. {totalQuotes} citations, {authors.length}
		Pères.
	</p>
	<form action="/recherche" class="mt-6 max-w-reader">
		<input
			type="search"
			name="q"
			placeholder="Chercher dans le corpus…"
			aria-label="Chercher dans le corpus"
			class="w-full rounded border border-border bg-panel px-3 py-2 font-ui focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		/>
	</form>
</section>

<section class="px-6 py-10">
	<h2 class="font-heading text-2xl text-heading">Parcourir par section</h2>
	<div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
		{#each tree as s (s.section)}
			<SectionTile
				section={s.section}
				groupe={s.groupe}
				count={s.topics.length}
				href={`/sujets#section-${s.section}`}
			/>
		{/each}
	</div>
</section>

<section class="border-t border-border bg-panel px-6 py-10">
	<h2 class="font-heading text-2xl text-heading">Pères en vedette</h2>
	<ul class="mt-4 flex flex-wrap gap-3">
		{#each featuredAuthors as a (a.id)}
			<li>
				<a
					href={`/peres/${a.slug}`}
					class="rounded-full border border-border bg-background px-3 py-1 font-ui text-sm hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					{a.name}
				</a>
			</li>
		{/each}
	</ul>
</section>
