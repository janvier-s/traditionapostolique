<script lang="ts">
	let { data }: { data: unknown } = $props();
	const json = $derived(JSON.stringify(data).replace(/</g, '\\u003c'));
	const TAG_OPEN = '<' + 'script type="application/ld+json">';
	const TAG_CLOSE = '<' + '/' + 'script>';
	const block = $derived(TAG_OPEN + json + TAG_CLOSE);
</script>

<svelte:head>
	{@html block}
</svelte:head>
