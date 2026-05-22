<script lang="ts">
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import { workById, topicById } from '$lib/data';
	import { eraLabelSingular } from '$lib/utils/era';
	import type { Quote, Topic } from '$lib/schema';

	let { data } = $props();

	// French Roman-numeral century from death year · same helper as the
	// topic page. Kept inline to avoid a circular import for what is
	// effectively two lines.
	const ROMAN = [
		'I','II','III','IV','V','VI','VII','VIII','IX','X',
		'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'
	];
	function centuryLabel(dates: string | undefined): string {
		if (!dates) return '';
		const ys = dates.match(/\d{1,4}/g);
		if (!ys) return '';
		const c = Math.ceil(Math.max(...ys.map(Number)) / 100);
		return `${ROMAN[c - 1] ?? c}e siècle`;
	}

	// Group this Father's quotes by topic · the marginal column then
	// becomes a topic header (small-caps oxblood) and the right column
	// holds the quotes. Mirrors the topic page but with author and
	// topic roles swapped. Topics keep their section order.
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

	function citationOf(q: Quote): string {
		const parts: string[] = [];
		const work = q.workId ? workById(q.workId) : undefined;
		if (work) parts.push(work.title);
		if (q.reference) parts.push(q.reference);
		return parts.join(', ');
	}

	const century = $derived(centuryLabel(data.author.dates));
</script>

<MetaTags
	title={data.author.name}
	description={`Citations patristiques de ${data.author.name}.`}
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<header class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<div></div>
		<div>
			<!-- Back link · returns to the Père index so a reader can keep
			     browsing other Fathers from the same starting point. Sage-
			     olive on hover, matching the rail-nav register. -->
			<a
				href="/peres"
				class="mb-4 inline-flex items-baseline gap-1 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
			>
				<span aria-hidden="true">←</span> Tous les Pères
			</a>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				{data.author.name}
			</h1>
			{#if data.author.originalName}
				<p class="mt-2 font-body italic text-muted">{data.author.originalName}</p>
			{/if}

			<!-- Author metadata strip · dates + century + era + region,
			     in the same uppercase Proxima register as the topic page's
			     marginal info column. Reads as page metadata, not as a
			     bio paragraph. -->
			<div class="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
				{#if data.author.dates}<span>{data.author.dates}</span>{/if}
				{#if century}
					{@const cm = century.match(/^([IVXL]+)([a-z]+)\s+(\S+)$/)}
					<span>·</span>
					<span>
						{#if cm}{cm[1]}<span class="normal-case">{cm[2]}</span> {cm[3]}{:else}{century}{/if}
					</span>
				{/if}
				<span>·</span><span>{eraLabelSingular(data.author.era)}</span>
				{#if data.author.region}
					<span>·</span><span>{data.author.region.split(',').map((s) => s.trim()).filter(Boolean).join(' · ')}</span>
				{/if}
			</div>

			<p class="mt-4 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
				{data.quotes.length} citation{data.quotes.length > 1 ? 's' : ''}
				·
				{groups.length} sujet{groups.length > 1 ? 's' : ''}
			</p>
		</div>
	</header>

	<div class="source-list">
		{#each groups as g (g.topic.id)}
			<section class="source-block grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]">
				<!-- Marginal topic header · the role the author's name plays
				     on the topic page is filled here by the topic's name.
				     Links back to the topic page so a reader can jump from
				     "everything by Augustine on Trinity" to "everything on
				     Trinity (any author)". -->
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
						{@const cite = citationOf(q)}
						{@const work = q.workId ? workById(q.workId) : null}
						<div id={`q-${q.id}`} class="scroll-mt-24">
							<p
								class="font-body text-foreground"
								style="white-space: pre-line;"
							>
								{#if q.fr}
									<span>&ldquo;{q.fr}&rdquo;</span>
								{:else}
									<span class="italic text-muted">Traduction française à venir.</span>
								{/if}
							</p>
							{#if cite}
								<!-- Work title links to the Œuvre page so a reader
								     can pivot from "this author on this topic" to
								     "everything from this work". Same affordance
								     as on the topic page. -->
								<p class="mt-2 font-body text-muted">
									&mdash;
									{#if work}
										<a
											href={`/oeuvres/${work.slug}`}
											class="italic hover:text-active"
										>{work.title}</a>{#if q.reference}<span class="italic">, {q.reference}</span>{/if}
									{:else}
										<em class="italic">{cite}</em>
									{/if}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</article>

<style>
	.source-block + .source-block {
		margin-top: 3.5rem;
		padding-top: 3.5rem;
		border-top: 1px solid var(--color-border);
	}
</style>
