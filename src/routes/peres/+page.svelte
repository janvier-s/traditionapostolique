<script lang="ts">
	import { authors } from '$lib/data';
	import { eraLabel, eraOrder } from '$lib/utils/era';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	let sortMode = $state<'chrono' | 'alpha'>('chrono');

	const grouped = $derived.by(() => {
		if (sortMode === 'alpha') {
			return [
				{ era: null, items: [...authors].sort((a, b) => a.name.localeCompare(b.name, 'fr')) }
			];
		}
		return eraOrder
			.map((era) => ({
				era,
				items: authors
					.filter((a) => a.era === era)
					.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
			}))
			.filter((g) => g.items.length > 0);
	});
</script>

<MetaTags
	title="Pères"
	description="Pères de l'Église, organisés par époque ou alphabétiquement."
/>

<section class="px-6 py-10">
	<div class="flex items-baseline justify-between">
		<h1 class="font-heading text-3xl">Pères</h1>
		<select
			bind:value={sortMode}
			class="rounded border border-border bg-panel px-2 py-1 font-ui text-sm"
		>
			<option value="chrono">Par époque</option>
			<option value="alpha">Alphabétique</option>
		</select>
	</div>

	<div class="mt-6 space-y-8">
		{#each grouped as g (g.era ?? 'all')}
			<section>
				{#if g.era}<h2 class="font-heading text-xl">{eraLabel(g.era)}</h2>{/if}
				<ul class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each g.items as a (a.id)}
						<li>
							<a
								href={`/peres/${a.slug}`}
								class="block rounded border border-border bg-panel p-3 hover:border-accent"
							>
								<span class="font-heading">{a.name}</span>
								{#if a.dates}<span class="ml-2 text-sm text-muted">{a.dates}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</section>
