<script lang="ts">
	import { buildPublicTaxonomy, type PublicTaxonomyNode } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Pillar } from '$lib/schema';

	const taxonomy = buildPublicTaxonomy();
	const PILLARS: { value: Pillar; label: string; subtitle: string }[] = [
		{ value: 'dieu', label: 'Dieu, Trinité, Christ', subtitle: 'Le mystère de Dieu' },
		{
			value: 'eglise',
			label: "L'Église et ses sources",
			subtitle: "L'Église, la Tradition, l'Écriture"
		},
		{ value: 'saints', label: 'Marie, les saints, miracles', subtitle: 'La communion des saints' },
		{ value: 'sacrements', label: 'Sacrements et liturgie', subtitle: 'Le culte chrétien' },
		{ value: 'vie', label: 'Vie chrétienne et prière', subtitle: 'Morale, ascèse, prière' },
		{ value: 'fin', label: 'Les fins dernières', subtitle: 'Eschatologie' }
	];

	function totalCount(node: PublicTaxonomyNode): number {
		if (node.topicRef) return node.topicRef.count;
		return node.children.reduce((n, c) => n + totalCount(c), 0);
	}
	function topicCount(nodes: PublicTaxonomyNode[]): number {
		let n = 0;
		for (const x of nodes) {
			if (x.topicRef) n++;
			n += topicCount(x.children);
		}
		return n;
	}
	const totalTopics = PILLARS.reduce((n, p) => n + topicCount(taxonomy[p.value]), 0);
</script>

<MetaTags
	title="Sujets"
	fullTitle="Les sujets traités dans la Tradition Apostolique"
	description="Index thématique de la Tradition Apostolique : les principaux articles de la foi chrétienne traités par les Pères de l'Église — Dieu, le Christ, l'Église, les sacrements, la morale, la fin des temps."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<header
		class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]"
	>
		<div></div>
		<div>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				Les Sujets
			</h1>
			<p class="mt-3 label-meta">{totalTopics} sujets</p>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-12 md:grid-cols-2 xl:grid-cols-3">
		{#each PILLARS as p (p.value)}
			<section>
				<h2 class="font-heading italic text-accent leading-[1.1]" style="font-size: 1.5rem;">
					{p.label}
				</h2>
				<p class="label-meta mt-1">{p.subtitle}</p>
				<ul class="mt-4 space-y-1">
					{#each taxonomy[p.value] as n (n.id)}
						{@render renderListNode(n, 0)}
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</article>

{#snippet renderListNode(n: PublicTaxonomyNode, depth: number)}
	{#if n.umbrella}
		<li style:padding-left={`${depth * 0.75}rem`}>
			<div class="flex items-baseline justify-between gap-2">
				{#if n.umbrella.primaryHref}
					<a
						href={n.umbrella.primaryHref}
						class="font-body font-semibold text-foreground hover:text-accent">{n.umbrella.label}</a
					>
				{:else}
					<span class="font-body font-semibold">{n.umbrella.label}</span>
				{/if}
				<span class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted"
					>{totalCount(n) || '—'}</span
				>
			</div>
		</li>
		{#each n.children as c (c.id)}
			{@render renderListNode(c, depth + 1)}
		{/each}
	{:else if n.topicRef}
		<li style:padding-left={`${depth * 0.75}rem`} class="flex items-baseline justify-between gap-2">
			<a href={n.topicRef.href} class="min-w-0 font-body text-foreground hover:text-accent"
				>{n.topicRef.label}</a
			>
			<span class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted"
				>{n.topicRef.count || '—'}</span
			>
		</li>
	{/if}
{/snippet}
