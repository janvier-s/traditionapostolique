<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import QuotePanel from '$lib/components/ui/QuotePanel.svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
	// Sync the open quote with the route param. SvelteKit reuses the
	// component across /citation/1 → /citation/2 navigation, so without
	// this effect the panel would stay pinned to the first quote.
	$effect(() => {
		openQuote = data.quote;
	});
</script>

<MetaTags title="Citation" />

<section class="px-6 py-10">
	<QuoteCard quote={data.quote} onOpenPanel={(q) => (openQuote = q)} />
</section>

{#if openQuote}
	{#key openQuote.id}
		<QuotePanel quote={openQuote} onClose={() => (openQuote = null)} />
	{/key}
{/if}
