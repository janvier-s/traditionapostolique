<script lang="ts">
	let { data } = $props();

	const groups = $derived<Array<[string, number[], string]>>([
		['Quotes sans FR', data.noFr, '/admin/citations'],
		['Quotes sans original', data.noOriginal, '/admin/citations'],
		['Quotes sans titre', data.noTitle, '/admin/citations'],
		['Quotes broken authorId', data.brokenAuthor, '/admin/citations'],
		['Quotes broken workId', data.brokenWork, '/admin/citations'],
		['Quotes sans archive', data.noArchive, '/admin/citations'],
		['Auteurs sans bio', data.authorsMissingBio, '/admin/auteurs'],
		['Œuvres sans description', data.worksMissingDescription, '/admin/oeuvres']
	]);
</script>

<h1 class="font-heading text-2xl">Gaps</h1>

<div class="mt-4 space-y-6">
	{#each groups as [label, ids, base] (label)}
		<section>
			<h2 class="font-heading text-lg">{label} ({ids.length})</h2>
			<ul class="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
				{#each ids.slice(0, 200) as id (id)}
					<li>
						<a
							href={`${base}#${id}`}
							class="rounded border border-border bg-panel px-2 py-0.5 text-xs hover:border-accent"
							>#{id}</a
						>
					</li>
				{/each}
				{#if ids.length > 200}
					<li class="text-xs text-muted">… +{ids.length - 200}</li>
				{/if}
			</ul>
		</section>
	{/each}
</div>
