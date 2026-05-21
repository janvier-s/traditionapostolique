<script lang="ts">
	import { works, authorById } from '$lib/data';
	const sorted = [...works].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
</script>

<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Œuvres</h1>
	<ul class="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
		{#each sorted as w (w.id)}
			<li>
				<a
					href={`/oeuvres/${w.slug}`}
					class="block rounded border border-border bg-panel p-3 hover:border-accent"
				>
					<span class="font-heading">{w.title}</span>
					<div class="text-sm text-muted">{authorById(w.authorId)?.name ?? ''}</div>
				</a>
			</li>
		{/each}
	</ul>
</section>
