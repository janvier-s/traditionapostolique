<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import QuotePanel from '$lib/components/ui/QuotePanel.svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let openQuote = $state<Quote | null>(data.quote);
</script>

<MetaTags title="Citation" />

<section class="px-6 py-10">
	<QuoteCard quote={data.quote} onOpenPanel={(q) => (openQuote = q)} />
</section>

{#if openQuote}
	<QuotePanel quote={openQuote} onClose={() => (openQuote = null)} />
{/if}
