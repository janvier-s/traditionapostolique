<script lang="ts">
	import { buildTopicTree } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const tree = buildTopicTree();
	const totalTopics = tree.reduce((n, s) => n + s.topics.length, 0);
</script>

<MetaTags
	title="Sujets"
	fullTitle="Les sujets traités dans la Tradition Apostolique"
	description="Index thématique de la Tradition Apostolique : les principaux articles de la foi chrétienne traités par les Pères de l'Église — Dieu, le Christ, l'Église, les sacrements, la morale, la fin des temps."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<!-- Header laid out with empty marginal column so the H1 left-aligns
	     with the topic lists below · matches /peres and /oeuvres. -->
	<header
		class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]"
	>
		<div></div>
		<div>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				Les Sujets
			</h1>

			<p class="mt-3 label-meta">
				{totalTopics} sujets
			</p>

			<p class="mt-3 max-w-prose font-body text-base leading-[1.6] text-foreground">
				Cet index thématique rassemble les principaux articles de la foi chrétienne tels que les ont
				traités les Pères de l’Église : Dieu, le Christ, l’Église, les sacrements, la morale, la fin
				des temps.
			</p>
		</div>
	</header>

	<div class="source-list">
		{#each tree as s (s.section)}
			<section
				id={`section-${s.section}`}
				class="source-block grid scroll-mt-24 grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]"
			>
				<!-- Marginal section header · italic Playfair to match the
				     letter headers on /peres and /oeuvres. -->
				<div class="min-w-0">
					<h2
						class="font-heading italic text-accent leading-[1.1]"
						style="font-size: 1.5rem; hyphens: auto;"
					>
						{s.groupe}
					</h2>
				</div>

				<ul class="space-y-2">
					{#each s.topics as t (t.id)}
						<li class="flex items-baseline justify-between gap-4">
							<a href={t.href} class="min-w-0 font-body text-foreground hover:text-accent">
								{t.label}
							</a>
							<span
								class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted"
							>
								{t.count}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</article>

<style>
	.source-block + .source-block {
		margin-top: 2.5rem;
		padding-top: 2.5rem;
		border-top: 1px solid var(--color-border);
	}
</style>
