<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
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

<StudyPanel quote={openQuote} onClose={() => (openQuote = null)} />
