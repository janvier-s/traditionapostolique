<script lang="ts">
	import type { Quote } from '$lib/schema';
	import { authorById, workById, topicById } from '$lib/data';
	import { deriveQuoteTitle } from '$lib/utils/derive-quote-title';
	import { formatCitation } from '$lib/utils/format-citation';
	import TopicChip from './TopicChip.svelte';
	import EraBadge from './EraBadge.svelte';

	let { quote, onOpenPanel }: { quote: Quote; onOpenPanel?: (q: Quote) => void } = $props();

	const author = $derived(authorById(quote.authorId));
	const work = $derived(quote.workId ? workById(quote.workId) : undefined);
	const topics = $derived(
		quote.topicIds
			.map((id) => topicById(id))
			.filter((t): t is NonNullable<typeof t> => t != null)
	);
	const title = $derived(author ? deriveQuoteTitle(quote, topics) : '');
	const citation = $derived(author ? formatCitation(quote, author, work) : '');

	let copied = $state(false);
	async function copyCitation() {
		if (!citation) return;
		try {
			await navigator.clipboard.writeText(citation);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// noop
		}
	}
</script>

{#if author}
	<article class="rounded-lg border border-border bg-panel p-5 md:p-6">
		<header class="mb-3 font-ui text-xs uppercase tracking-widest text-muted">
			{title}
		</header>

		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<div class="flex flex-wrap items-baseline gap-2">
				<span class="font-heading text-lg">{author.name}</span>
				{#if author.dates}<span class="text-sm text-muted">({author.dates})</span>{/if}
				<EraBadge era={author.era} />
			</div>
			{#if quote.reference}
				<span class="rounded bg-subtle/15 px-2 py-0.5 font-ui text-xs text-muted">{quote.reference}</span>
			{/if}
		</div>

		{#if quote.fr}
			<p class="mt-4 max-w-reader font-body text-lg leading-relaxed">{quote.fr}</p>
		{:else}
			<p class="mt-4 italic text-muted">Traduction française à venir.</p>
		{/if}

		<footer class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap gap-2">
				{#each topics as t (t.id)}
					<TopicChip topic={{ slug: t.slug, label: t.label }} />
				{/each}
			</div>
			{#if work}
				<a href={`/oeuvres/${work.slug}`} class="font-body text-sm italic text-muted hover:text-accent-text">
					{work.title}
				</a>
			{/if}
		</footer>

		<div class="mt-4 flex flex-wrap gap-2">
			{#if onOpenPanel}
				<button
					type="button"
					onclick={() => onOpenPanel?.(quote)}
					class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10"
				>Plus d'infos</button>
			{/if}
			<button
				type="button"
				onclick={copyCitation}
				class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10"
				aria-label="Copier la citation"
			>{copied ? 'Copié' : 'Copier la citation'}</button>
			<a
				href={`/citation/${quote.id}`}
				class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10"
			>Lien</a>
		</div>
	</article>
{/if}
