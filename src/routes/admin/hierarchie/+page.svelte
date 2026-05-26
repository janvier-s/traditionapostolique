<script lang="ts">
	import { buildPublicTaxonomy, type PublicTaxonomyNode } from '$lib/data';
	import type { Pillar } from '$lib/schema';

	const taxonomy = buildPublicTaxonomy();
	const PILLARS: { value: Pillar; label: string }[] = [
		{ value: 'dieu', label: 'Dieu, Trinité, Christ' },
		{ value: 'eglise', label: "L'Église et ses sources" },
		{ value: 'saints', label: 'Marie, les saints, miracles' },
		{ value: 'sacrements', label: 'Sacrements et liturgie' },
		{ value: 'vie', label: 'Vie chrétienne et prière' },
		{ value: 'fin', label: 'Les fins dernières' }
	];

	function totalCount(node: PublicTaxonomyNode): number {
		if (node.topicRef) return node.topicRef.count;
		return node.children.reduce((n, c) => n + totalCount(c), 0);
	}
</script>

<h1 class="font-heading text-2xl">Hiérarchie</h1>
<p class="mt-2 text-sm text-muted">
	Vue lecture seule de la taxonomie courante. Édition dans
	<a href="/admin/taxonomy" class="underline">/admin/taxonomy</a>.
</p>

<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
	{#each PILLARS as p (p.value)}
		<section class="rounded border border-border bg-panel/30 p-3">
			<h2 class="font-heading text-base">{p.label}</h2>
			<p class="mt-1 text-xs text-muted">{taxonomy[p.value].length} entrée(s) racine</p>
			<ul class="mt-3 space-y-2">
				{#each taxonomy[p.value] as n (n.id)}
					{@render renderNode(n, 0)}
				{/each}
			</ul>
		</section>
	{/each}
</div>

{#snippet renderNode(n: PublicTaxonomyNode, depth: number)}
	<li style:padding-left={`${depth * 0.75}rem`}>
		{#if n.umbrella}
			<span class="font-semibold text-sm">{n.umbrella.label}</span>
			<span class="ml-2 text-xs text-muted">{totalCount(n)} citation(s)</span>
			{#if n.children.length > 0}
				<ul class="mt-1">
					{#each n.children as c (c.id)}
						{@render renderNode(c, depth + 1)}
					{/each}
				</ul>
			{/if}
		{:else if n.topicRef}
			<a href={`/admin/sujets#row-${n.topicRef.topicId}`} class="text-sm hover:text-accent"
				>{n.topicRef.label}</a
			>
			<span class="ml-2 text-xs text-muted">{n.topicRef.count}</span>
		{/if}
	</li>
{/snippet}
