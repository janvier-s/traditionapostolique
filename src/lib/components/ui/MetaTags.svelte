<script lang="ts">
	let {
		title,
		description,
		canonical
	}: { title: string; description?: string; canonical?: string } = $props();
	const full = $derived(`${title} · Tradition Apostolique`);
</script>

<svelte:head>
	<title>{full}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if canonical}<link rel="canonical" href={canonical} />{/if}
	<meta property="og:title" content={full} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
