<script lang="ts">
	import { buildTopicTree } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const tree = buildTopicTree();
</script>

<MetaTags
	title="Sujets"
	fullTitle="Les sujets traités dans la Tradition Apostolique"
	description="Index thématique de la Tradition Apostolique : les principaux articles de la foi chrétienne traités par les Pères de l'Église — Dieu, le Christ, l'Église, les sacrements, la morale, la fin des temps."
/>

<article>
	<h1
		class="font-heading italic text-accent text-[clamp(2.5rem,5vw,4rem)] leading-[1.05]"
	>
		Sujets
	</h1>

	<div class="mt-12 space-y-12">
		{#each tree as s (s.section)}
			<section id={`section-${s.section}`}>
				<h2
					class="font-heading text-base uppercase tracking-[0.18em] text-accent md:text-lg"
				>
					{s.groupe}
				</h2>
				<ul class="mt-4 divide-y divide-border border-y border-border">
					{#each s.topics as t (t.id)}
						<li>
							<a
								href={t.href}
								class="group flex items-baseline justify-between gap-6 py-2.5 font-body text-[15px] text-foreground hover:text-accent"
							>
								<span>{t.label}</span>
								<span class="shrink-0 font-ui text-xs uppercase tracking-[0.18em] text-subtle">
									{t.count}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</article>
