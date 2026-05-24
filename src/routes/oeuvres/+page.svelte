<script lang="ts">
	import { works, authorById, quotes } from '$lib/data';
	import { sortKey, letterBucket } from '$lib/utils/sort-name';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Work, Author } from '$lib/schema';

	type SortKey = 'alpha' | 'author' | 'count';
	let sortBy = $state<SortKey>('alpha');
	const SORT_OPTIONS: { value: SortKey; label: string }[] = [
		{ value: 'alpha', label: 'Alphabétique' },
		{ value: 'author', label: 'Par auteur' },
		{ value: 'count', label: 'Par fréquence' }
	];

	// Quote counts per work · for the "× N" suffix and "Par fréquence" sort.
	const quoteCounts = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of quotes) {
			if (q.workId != null) m.set(q.workId, (m.get(q.workId) ?? 0) + 1);
		}
		return m;
	});

	type Group = { label: string; items: Work[] };

	const groups = $derived.by<Group[]>(() => {
		if (sortBy === 'alpha') {
			const buckets = new Map<string, Work[]>();
			for (const w of works) {
				const b = letterBucket(w.title);
				if (!buckets.has(b)) buckets.set(b, []);
				buckets.get(b)!.push(w);
			}
			for (const arr of buckets.values())
				arr.sort((x, y) => sortKey(x.title).localeCompare(sortKey(y.title), 'fr'));
			return [...buckets.entries()]
				.sort(([x], [y]) => x.localeCompare(y, 'fr'))
				.map(([label, items]) => ({ label, items }));
		}

		if (sortBy === 'author') {
			// Group by author (sorted) with works (sorted) under each.
			const byAuthor = new Map<number, { author: Author; items: Work[] }>();
			for (const w of works) {
				const a = authorById(w.authorId);
				if (!a) continue;
				let g = byAuthor.get(a.id);
				if (!g) {
					g = { author: a, items: [] };
					byAuthor.set(a.id, g);
				}
				g.items.push(w);
			}
			for (const g of byAuthor.values())
				g.items.sort((x, y) => sortKey(x.title).localeCompare(sortKey(y.title), 'fr'));
			// Compose the marginal label as "Author Name<\n>dates" so the
			// /oeuvres "Par auteur" view shows a date hint under each
			// author header · helps the reader locate the work in time
			// without clicking through to the Père page.
			return [...byAuthor.values()]
				.sort((x, y) => sortKey(x.author.name).localeCompare(sortKey(y.author.name), 'fr'))
				.map((g) => ({
					label: g.author.name + (g.author.dates ? `\n${g.author.dates}` : ''),
					items: g.items
				}));
		}

		// count
		const arr = [...works].sort(
			(a, b) => (quoteCounts.get(b.id) ?? 0) - (quoteCounts.get(a.id) ?? 0)
		);
		return [{ label: '', items: arr }];
	});

	const totalWorks = $derived(works.length);
</script>

<MetaTags
	title="Œuvres"
	description="Œuvres patristiques sources de l'anthologie."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<header class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<div></div>
		<div>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				Les Œuvres
			</h1>

			<div class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<p class="label-meta">
					{totalWorks} œuvres
				</p>
				<label class="flex items-baseline gap-2">
					<span class="label-meta">Tri</span>
					<select
						bind:value={sortBy}
						class="border-b border-foreground/15 bg-transparent py-[2px] pr-2 font-ui text-[12px] font-light uppercase tracking-[0.05em] text-foreground hover:border-active focus:border-active focus:outline-none"
					>
						{#each SORT_OPTIONS as o (o.value)}
							<option value={o.value}>{o.label}</option>
						{/each}
					</select>
				</label>
			</div>
		</div>
	</header>

	<div class="source-list">
		{#each groups as g (g.label || 'all')}
			<section class="source-block grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]">
				<div class="min-w-0">
					{#if g.label}
						{@const parts = g.label.split('\n')}
						<h2
							class="font-heading italic text-accent leading-[1.1]"
							style="font-size: {sortBy === 'alpha' ? '2.5rem' : '1.25rem'}; hyphens: auto;"
						>
							{parts[0]}
						</h2>
						{#if parts[1]}
							<p class="mt-1 font-ui text-[11px] font-light uppercase not-italic tracking-[0.05em] text-muted">
								{parts[1]}
							</p>
						{/if}
					{/if}
				</div>

				<ul class="space-y-2">
					{#each g.items as w (w.id)}
						{@const n = quoteCounts.get(w.id) ?? 0}
						{@const a = authorById(w.authorId)}
						<li class="flex items-baseline justify-between gap-4">
							<span class="min-w-0">
								<a href={`/oeuvres/${w.slug}`} class="font-body text-foreground hover:text-active">
									{w.title}
								</a>
								{#if a && sortBy !== 'author'}
									<span class="ml-2 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
										{a.name}
									</span>
								{/if}
							</span>
							{#if n > 0}
								<span class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
									{n}
								</span>
							{/if}
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
