<script lang="ts">
	import { page } from '$app/state';
	import JsonLd from './JsonLd.svelte';

	export type Crumb = { label: string; href?: string };
	let { items }: { items: Crumb[] } = $props();

	// JSON-LD BreadcrumbList · all items get an item URL (Google ignores
	// the last one's URL but it's harmless to include).
	const schema = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.label,
			item: c.href ? `${page.url.origin}${c.href}` : `${page.url.origin}${page.url.pathname}`
		}))
	});
</script>

<nav aria-label="Fil d'Ariane" class="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 label-meta">
	{#each items as c, i (i)}
		{#if c.href && i < items.length - 1}
			<a href={c.href} class="hover:text-active hover:underline underline-offset-4">{c.label}</a>
			<span aria-hidden="true">/</span>
		{:else}
			<span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
		{/if}
	{/each}
</nav>

<JsonLd data={schema} />
