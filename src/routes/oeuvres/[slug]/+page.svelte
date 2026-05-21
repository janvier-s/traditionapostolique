<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
</script>

<section class="px-6 py-10">
	<header>
		<h1 class="font-heading text-3xl">{data.work.title}</h1>
		{#if data.work.alternativeTitles?.length}
			<p class="italic text-muted">{data.work.alternativeTitles.join(' · ')}</p>
		{/if}
		<p class="mt-2 text-sm text-muted">
			par <a href={`/peres/${data.author.slug}`} class="hover:text-accent-text"
				>{data.author.name}</a
			>
		</p>
		{#if data.work.description}<p class="mt-4 max-w-reader">{data.work.description}</p>{/if}
		{#if data.work.link}
			<a
				href={data.work.link}
				target="_blank"
				rel="noopener"
				class="mt-2 inline-block text-accent-text">Source →</a
			>
		{/if}
	</header>

	<section class="mt-10">
		<h2 class="font-heading text-2xl">Citations ({data.quotes.length})</h2>
		<div class="mt-4 space-y-6">
			{#each data.quotes as q (q.id)}
				<QuoteCard quote={q} onOpenPanel={(qq) => (openQuote = qq)} />
			{/each}
		</div>
	</section>
</section>

<StudyPanel quote={openQuote} onClose={() => (openQuote = null)} />
