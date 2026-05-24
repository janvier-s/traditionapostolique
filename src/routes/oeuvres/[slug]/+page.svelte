<script lang="ts">
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import { topicById } from '$lib/data';
	import type { Quote, Topic } from '$lib/schema';
	import { renderFr } from '$lib/utils/render-fr';
	import ModeToggle from '$lib/components/ui/ModeToggle.svelte';
	import QuotePanelAside from '$lib/components/ui/QuotePanelAside.svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import JsonLd from '$lib/components/ui/JsonLd.svelte';
	import { mode } from '$lib/stores/mode.svelte';
	import { onMount } from 'svelte';

	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
	function openPanel(q: Quote) {
		openQuote = q;
		if (typeof history !== 'undefined') history.replaceState(null, '', `#q-${q.id}`);
	}
	function closePanel() {
		openQuote = null;
		if (typeof history !== 'undefined')
			history.replaceState(null, '', window.location.pathname + window.location.search);
	}
	onMount(() => {
		const m = window.location.hash.match(/^#q-(\d+)$/);
		if (!m) return;
		const id = Number(m[1]);
		const q = data.quotes.find((x) => x.id === id);
		if (q) {
			openQuote = q;
			requestAnimationFrame(() => {
				document.getElementById(`q-${id}`)?.scrollIntoView({ block: 'center' });
			});
		}
	});
	$effect(() => {
		if (!openQuote) return;
		function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePanel(); }
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	// Group the work's quotes by topic · the marginal column shows the
	// topic, the right column holds the actual quote text. Same shape
	// as the Father page, just scoped to one work.
	type Group = {
		topic: Topic;
		quotes: Quote[];
	};
	const groups = $derived.by<Group[]>(() => {
		const byTopic = new Map<number, Group>();
		for (const q of data.quotes) {
			for (const tid of q.topicIds) {
				const t = topicById(tid);
				if (!t) continue;
				let g = byTopic.get(tid);
				if (!g) {
					g = { topic: t, quotes: [] };
					byTopic.set(tid, g);
				}
				g.quotes.push(q);
			}
		}
		return [...byTopic.values()].sort((x, y) => x.topic.id - y.topic.id);
	});
</script>

<MetaTags
	title={data.work.title}
	type="article"
	description={data.work.description ?? `Citations tirées de ${data.work.title} (${data.author.name}).`}
/>
<JsonLd
	data={{
		'@context': 'https://schema.org',
		'@type': 'CreativeWork',
		name: data.work.title,
		alternateName: data.work.alternativeTitles ?? undefined,
		inLanguage: 'fr-FR',
		description: data.work.description ?? undefined,
		author: {
			'@type': 'Person',
			name: data.author.name,
			url: `https://traditionapostolique.fr/peres/${data.author.slug}`
		},
		url: `https://traditionapostolique.fr/oeuvres/${data.work.slug}`,
		about: groups.map((g) => ({ '@type': 'Thing', name: g.topic.label }))
	}}
/>

<article
	style={`--author-col: ${openQuote ? '140px' : '210px'}; --quote-gap: ${openQuote ? '1rem' : '3rem'};`}
	class={openQuote ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-x-8' : ''}
>
<div class="min-w-0">
	<header class="mb-12 grid grid-cols-1 items-end gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<div>
			<ModeToggle />
		</div>
		<div>
			<Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Œuvres', href: '/oeuvres' }, { label: `${data.author.name}`, href: `/peres/${data.author.slug}` }, { label: data.work.title }]} />
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				{data.work.title}
			</h1>
			{#if data.work.alternativeTitles?.length}
				<p class="mt-2 font-body italic text-muted">
					{data.work.alternativeTitles.join(' · ')}
				</p>
			{/if}

			<!-- Attribution + meta strip. The author name is a link to
			     the Père page so a reader can pivot from "this work" to
			     "everything by this author". -->
			<p class="mt-4 label-meta">
				<a href={`/peres/${data.author.slug}`} class="hover:text-active">
					{data.author.name}
				</a>
			</p>

			{#if data.work.description}
				<p class="mt-4 max-w-prose font-body text-[15px] leading-[1.7] text-foreground">
					{data.work.description}
				</p>
			{/if}

			{#if data.work.link}
				<a
					href={data.work.link}
					target="_blank"
					rel="noopener"
					class="mt-3 inline-flex items-baseline gap-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-active hover:underline"
				>
					Source <span aria-hidden="true">↗</span>
				</a>
			{/if}

			<p class="mt-4 label-meta">
				{data.quotes.length} citation{data.quotes.length > 1 ? 's' : ''}
				·
				{groups.length} sujet{groups.length > 1 ? 's' : ''}
			</p>
		</div>
	</header>

	<div class="source-list">
		{#each groups as g (g.topic.id)}
			<section class="source-block grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]">
				<div class="min-w-0">
					<h2
						class="font-heading uppercase leading-[1.15] tracking-[0.04em] text-accent"
						style="font-size: 20px; hyphens: auto;"
					>
						<a href={`/sujets/${g.topic.slug}`} class="hover:text-active">
							{g.topic.label}
						</a>
					</h2>
				</div>

				<div>
					{#each g.quotes as q, i (q.id)}
						{#if i > 0}
							<div class="my-5 h-px w-10 bg-border" aria-hidden="true"></div>
						{/if}
						<div id={`q-${q.id}`} class="scroll-mt-24">
							<p
								class="font-body text-foreground"
								style="white-space: pre-line;"
							>
								{#if q.fr}
									<span>&ldquo;{@html renderFr(q.fr)}&rdquo;</span>
								{:else}
									<span class="italic text-muted">Traduction française à venir.</span>
								{/if}
							</p>
							{#if q.reference}
								<p class="mt-2 font-body text-muted">
									&mdash; <em class="italic">{q.reference}</em>
								</p>
							{/if}
							{#if mode.value === 'study'}
								<div class="mt-3">
									<button
										type="button"
										onclick={() => (openQuote?.id === q.id ? closePanel() : openPanel(q))}
										aria-expanded={openQuote?.id === q.id}
										class="label-meta-link"
									>
										{openQuote?.id === q.id ? 'Fermer' : "Plus d'info"} <span aria-hidden="true">&rarr;</span>
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if openQuote}
	<QuotePanelAside quote={openQuote} onClose={closePanel} label="À propos de la citation" />
{/if}
</article>

<style>
	.source-block + .source-block {
		margin-top: 3.5rem;
		padding-top: 3.5rem;
		border-top: 1px solid var(--color-border);
	}
</style>
