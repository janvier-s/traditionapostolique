<script lang="ts">
	import { applyFiltersAndSort, type QuoteFilters, type QuoteSort } from '$lib/utils/filters';
	import { eraOrder, eraLabel } from '$lib/utils/era';
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import FilterChip from '$lib/components/ui/FilterChip.svelte';
	import SortSelect from '$lib/components/ui/SortSelect.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();

	let filters = $state<QuoteFilters>({ ere: [], region: [], langue: [], pere: [] });
	let sort = $state<QuoteSort>('date-asc');
	let openQuote = $state<Quote | null>(null);

	const allRegions = $derived(
		Array.from(new Set(data.authors.map((a) => a.region).filter((r): r is string => !!r))).sort()
	);
	const allLanguages = $derived(
		Array.from(new Set(data.authors.flatMap((a) => a.language))).sort()
	);

	const filtered = $derived(
		applyFiltersAndSort(data.matching, data.authors, filters, sort, data.works)
	);

	function toggleEra(v: (typeof eraOrder)[number]) {
		const arr = filters.ere ?? [];
		filters = { ...filters, ere: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
	}
	function toggleRegion(v: string) {
		const arr = filters.region ?? [];
		filters = { ...filters, region: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
	}
	function toggleLangue(v: string) {
		const arr = filters.langue ?? [];
		filters = { ...filters, langue: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
	}
</script>

<section class="px-6 py-10">
	<header>
		<div class="font-ui text-xs uppercase tracking-widest text-muted">
			Section {data.topic.section} · {data.topic.groupe}
		</div>
		<h1 class="mt-1 font-heading text-3xl">{data.topic.label}</h1>
		{#if data.topic.description}
			<p class="mt-2 max-w-reader text-muted">{data.topic.description}</p>
		{/if}
	</header>

	<div class="my-6 flex flex-wrap items-center gap-3 border-y border-border py-3">
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Ère</span>
			{#each eraOrder as e (e)}
				<FilterChip label={eraLabel(e)} active={filters.ere?.includes(e) ?? false} onToggle={() => toggleEra(e)} />
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Région</span>
			{#each allRegions as r (r)}
				<FilterChip label={r} active={filters.region?.includes(r) ?? false} onToggle={() => toggleRegion(r)} />
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Langue</span>
			{#each allLanguages as l (l)}
				<FilterChip label={l} active={filters.langue?.includes(l) ?? false} onToggle={() => toggleLangue(l)} />
			{/each}
		</div>
		<div class="ml-auto"><SortSelect value={sort} onChange={(v) => (sort = v)} /></div>
	</div>

	<p class="mb-4 font-ui text-sm text-muted">{filtered.length} citations</p>

	<div class="space-y-6">
		{#each filtered as q (q.id)}
			<QuoteCard quote={q} onOpenPanel={(qq) => (openQuote = qq)} />
		{:else}
			<p class="italic text-muted">Aucune citation ne correspond à ces filtres.</p>
		{/each}
	</div>
</section>

<StudyPanel quote={openQuote} onClose={() => (openQuote = null)} />
