<script lang="ts">
	import EraBadge from '$lib/components/peres/EraBadge.svelte';
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
</script>

<MetaTags
	title={data.author.name}
	description={data.author.bioShort ?? `Citations de ${data.author.name}`}
/>

<section class="px-6 py-10">
	<header>
		<h1 class="font-heading text-3xl">{data.author.name}</h1>
		{#if data.author.originalName}<p class="italic text-muted">{data.author.originalName}</p>{/if}
		<div class="mt-2 flex flex-wrap items-center gap-3 font-ui text-sm text-muted">
			<EraBadge era={data.author.era} />
			{#if data.author.dates}<span>{data.author.dates}</span>{/if}
			{#if data.author.region}<span>· {data.author.region}</span>{/if}
			{#if data.author.function}<span>· {data.author.function}</span>{/if}
		</div>
		{#if data.author.bioShort}
			<p class="mt-4 max-w-reader font-body text-lg">{data.author.bioShort}</p>
		{/if}
	</header>

	{#if data.works.length > 0}
		<section class="mt-10">
			<h2 class="font-heading text-2xl">Œuvres</h2>
			<ul class="mt-3 space-y-1 font-body">
				{#each data.works as w (w.id)}
					<li><a href={`/oeuvres/${w.slug}`} class="hover:text-accent-text">{w.title}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

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
