<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import QuotePanel from '$lib/components/ui/QuotePanel.svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import JsonLd from '$lib/components/ui/JsonLd.svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
	// Sync the open quote with the route param. SvelteKit reuses the
	// component across /citation/1 → /citation/2 navigation, so without
	// this effect the panel would stay pinned to the first quote.
	$effect(() => {
		openQuote = data.quote;
	});

	// SEO-friendly title/description derived from the quote itself so
	// every permalink has unique <title> + <meta description> + H1.
	const authorName = $derived(data.author?.name ?? 'Père de l’Église');
	const firstTopic = $derived(data.topics[0]?.label ?? '');
	const titleText = $derived(firstTopic ? `${authorName} sur ${firstTopic}` : `Citation de ${authorName}`);
	const excerpt = $derived(
		(data.quote.fr ?? data.quote.en ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
	);
	const description = $derived(
		excerpt ? `« ${excerpt}${excerpt.length >= 200 ? '…' : ''} »` : `Citation patristique de ${authorName}.`
	);
</script>

<MetaTags title={titleText} type="article" description={description} />

<JsonLd
	data={{
		'@context': 'https://schema.org',
		'@type': 'Quotation',
		text: data.quote.fr ?? data.quote.en ?? '',
		inLanguage: data.quote.fr ? 'fr-FR' : 'en',
		creator: data.author
			? {
					'@type': 'Person',
					name: data.author.name,
					url: `https://traditionapostolique.fr/peres/${data.author.slug}`
				}
			: undefined,
		isPartOf: data.work
			? {
					'@type': 'CreativeWork',
					name: data.work.title,
					url: `https://traditionapostolique.fr/oeuvres/${data.work.slug}`
				}
			: undefined,
		about: data.topics.map((t) => ({ '@type': 'Thing', name: t!.label }))
	}}
/>

<section class="px-6 py-10">
	<Breadcrumbs items={[
		{ label: 'Accueil', href: '/' },
		...(data.topics[0] ? [{ label: 'Sujets', href: '/sujets' }, { label: data.topics[0].label, href: `/sujets/${data.topics[0].slug}` }] : []),
		...(data.author ? [{ label: data.author.name, href: `/peres/${data.author.slug}` }] : []),
		{ label: `Citation #${data.quote.id}` }
	]} />
	<h1 class="font-heading italic text-accent leading-[1.1]" style="font-size: clamp(1.75rem, 3vw, 2.25rem);">
		{titleText}
	</h1>
	<QuoteCard quote={data.quote} onOpenPanel={(q) => (openQuote = q)} />
</section>

{#if openQuote}
	{#key openQuote.id}
		<QuotePanel quote={openQuote} onClose={() => (openQuote = null)} />
	{/key}
{/if}
