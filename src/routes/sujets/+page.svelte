<script lang="ts">
	import { buildTopicTree } from '$lib/data';
	const tree = buildTopicTree();
</script>

<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Sujets</h1>
	<p class="mt-2 max-w-reader text-muted">Organisés en {tree.length} sections.</p>

	<div class="mt-8 space-y-10">
		{#each tree as s (s.section)}
			<section id={`section-${s.section}`}>
				<h2 class="font-heading text-2xl">
					<span class="mr-1 text-muted">{s.section}.</span>{s.groupe}
				</h2>
				<ul class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each s.topics as t (t.id)}
						<li>
							<a href={t.href} class="block rounded border border-border bg-panel p-3 hover:border-accent">
								<span>{t.label}</span>
								<span class="ml-1 text-xs text-muted">({t.count})</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</section>
