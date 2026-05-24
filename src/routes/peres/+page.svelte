<script lang="ts">
	import { authors, quotes } from '$lib/data';
	import { eraLabel, eraOrder } from '$lib/utils/era';
	import { sortKey, letterBucket } from '$lib/utils/sort-name';
	import { latestYear, centuryLabel } from '$lib/utils/century';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import type { Author, Era } from '$lib/schema';

	type SortKey = 'alpha' | 'chrono' | 'era' | 'role' | 'count';
	const SORT_STORAGE_KEY = 'peres:sortBy';
	const VALID_SORTS: SortKey[] = ['alpha', 'chrono', 'era', 'role', 'count'];
	function initialSort(): SortKey {
		if (typeof localStorage === 'undefined') return 'alpha';
		const v = localStorage.getItem(SORT_STORAGE_KEY) as SortKey | null;
		return v && VALID_SORTS.includes(v) ? v : 'alpha';
	}
	let sortBy = $state<SortKey>(initialSort());
	$effect(() => {
		if (typeof localStorage !== 'undefined') localStorage.setItem(SORT_STORAGE_KEY, sortBy);
	});
	const SORT_OPTIONS: { value: SortKey; label: string }[] = [
		{ value: 'alpha', label: 'Alphabétique' },
		{ value: 'chrono', label: 'Chronologique' },
		{ value: 'era', label: 'Par ère' },
		{ value: 'role', label: 'Par rôle' },
		{ value: 'count', label: 'Par fréquence' }
	];

	// Assign each author a single canonical "role" bucket. Order of the
	// checks below is the display order on the grouped index.
	const ROLE_ORDER = [
		'Apôtres',
		'Papes',
		'Docteurs de l’Église',
		'Pères cappadociens',
		'Évêques',
		'Martyrs',
		'Saints',
		'Conciles',
		'Théologiens & écrivains',
		'Écrits anonymes & pseudonymes',
		'Laïcs',
		'Autres'
	] as const;
	type Role = (typeof ROLE_ORDER)[number];
	function roleOf(a: Author): Role {
		const status = (a.status ?? '').split(',').map((s) => s.trim()).filter(Boolean);
		const fn = (a.function ?? '').split(',').map((s) => s.trim()).filter(Boolean);
		const name = a.name;
		const hasSaintPrefix = /^(St\.?|Ste\.?|Saint|Sainte)\s+/i.test(name);
		if (status.includes('Apôtre')) return 'Apôtres';
		if (/^Concile/i.test(name)) return 'Conciles';
		if (/^Pape/i.test(name) || fn.includes('Pape')) return 'Papes';
		if (status.includes('Docteur') || status.includes('Docteur œcuménique')) return 'Docteurs de l’Église';
		if (status.includes('Père cappadocien')) return 'Pères cappadociens';
		if (fn.includes('Évêque') || fn.includes('Archévêque')) return 'Évêques';
		if (status.includes('Martyr')) return 'Martyrs';
		if (status.includes('Saint') || hasSaintPrefix) return 'Saints';
		if (/^(Pseudo-|Anonyme|Inscriptions|Didachè|Hermas|Mathète|Segond Clément)/i.test(name)) return 'Écrits anonymes & pseudonymes';
		if (status.includes('Laïc')) return 'Laïcs';
		if (fn.some((f) => ['Theologien', 'Écrivain', 'Apologète', 'Philosophe', 'Historien', 'Moine', 'Prêtre', 'Hagiographe', 'Bibliste', 'Poète', 'Prêcheur'].includes(f))) return 'Théologiens & écrivains';
		return 'Autres';
	}

	const SANS_DATE = 'Sans date';
	function deathYear(a: Author): number {
		return latestYear(a.dates) ?? 9999;
	}
	function centuryOf(a: Author): string {
		return centuryLabel(a.dates) || SANS_DATE;
	}

	// Split an author's name into (core, honorifics[]) so the index can
	// display "Léon Ier (Pape, St.)" instead of "Pape St. Léon Ier" ·
	// the canonical name in the data still leads with the honorifics.
	function splitHonorifics(name: string): { core: string; titles: string[] } {
		const titles: string[] = [];
		let s = name;
		// Order matters: handle "Pape St." stack before bare "Pape" or "St."
		const PATTERNS: Array<[RegExp, string]> = [
			[/^Pape\s+(?=St\.?|Ste\.?|Saint|Sainte)/i, 'Pape'],
			[/^Pape\s+/i, 'Pape'],
			[/^St\.?\s+/i, 'St.'],
			[/^Ste\.?\s+/i, 'Ste.'],
			[/^Saint\s+/i, 'St.'],
			[/^Sainte\s+/i, 'Ste.']
		];
		// Apply iteratively so "Pape St." extracts both.
		let changed = true;
		while (changed) {
			changed = false;
			for (const [re, title] of PATTERNS) {
				if (re.test(s)) {
					titles.push(title);
					s = s.replace(re, '');
					changed = true;
					break;
				}
			}
		}
		return { core: s.trim(), titles };
	}

	// Quote counts per author · used by both the "Par fréquence" sort
	// and the small "× N" suffix shown next to each name.
	const quoteCounts = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of quotes) m.set(q.authorId, (m.get(q.authorId) ?? 0) + 1);
		return m;
	});

	type Group = { label: string; items: Author[] };

	const groups = $derived.by<Group[]>(() => {
		if (sortBy === 'alpha') {
			// Bucket by first letter of the stripped sort-key (Saint /
			// Pape prefixes ignored), then sort within each bucket.
			const buckets = new Map<string, Author[]>();
			for (const a of authors) {
				const b = letterBucket(a.name);
				if (!buckets.has(b)) buckets.set(b, []);
				buckets.get(b)!.push(a);
			}
			for (const arr of buckets.values()) arr.sort((x, y) => sortKey(x.name).localeCompare(sortKey(y.name), 'fr'));
			return [...buckets.entries()]
				.sort(([x], [y]) => x.localeCompare(y, 'fr'))
				.map(([label, items]) => ({ label, items }));
		}

		if (sortBy === 'chrono') {
			// Group by century · same visual treatment as alphabetical's
			// letter headers, just with "IVe siècle" labels. "Sans date"
			// authors collect into their own group at the end.
			const buckets = new Map<string, Author[]>();
			const order: string[] = [];
			for (const a of [...authors].sort((x, y) => deathYear(x) - deathYear(y))) {
				const c = centuryOf(a);
				if (!buckets.has(c)) {
					buckets.set(c, []);
					order.push(c);
				}
				buckets.get(c)!.push(a);
			}
			return order.map((label) => ({ label, items: buckets.get(label)! }));
		}

		if (sortBy === 'era') {
			return eraOrder
				.map<Group>((e: Era) => ({
					label: eraLabel(e),
					items: authors
						.filter((a) => a.era === e)
						.sort((x, y) => sortKey(x.name).localeCompare(sortKey(y.name), 'fr'))
				}))
				.filter((g) => g.items.length > 0);
		}

		if (sortBy === 'role') {
			return ROLE_ORDER.map<Group>((r) => ({
				label: r,
				items: authors
					.filter((a) => roleOf(a) === r)
					.sort((x, y) => sortKey(x.name).localeCompare(sortKey(y.name), 'fr'))
			})).filter((g) => g.items.length > 0);
		}

		// count
		const arr = [...authors].sort(
			(a, b) => (quoteCounts.get(b.id) ?? 0) - (quoteCounts.get(a.id) ?? 0)
		);
		return [{ label: '', items: arr }];
	});

	const totalAuthors = $derived(authors.length);
</script>

<MetaTags
	title="Les Pères"
	description="Tous les Pères de l'Église cités dans l'anthologie."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
	<header class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<div></div>
		<div>
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				Les Pères
			</h1>

			<p class="mt-4 max-w-prose font-body text-base leading-[1.6] text-foreground">
				Cette liste rassemble les témoins de la Tradition apostolique cités sur le site. Outre les Pères de l’Église au sens strict, certains papes, conciles, ainsi que d’autres auteurs et écrits de l’Antiquité chrétienne y figurent également.
			</p>

			<!-- Sub-title row · count on the left, sort selector on the
			     right. Sort UI matches the topic page's Tri control. -->
			<div class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<p class="label-meta">
					{totalAuthors} pères
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

	{#if groups.length > 1 && groups.some((g) => g.label)}
		<nav aria-label="Sauter à un groupe" class="mb-8 flex flex-wrap gap-1">
			{#each groups as g (g.label || 'all')}
				{#if g.label}
					<a
						href={`#g-${encodeURIComponent(g.label)}`}
						class="rounded-full border border-foreground/15 px-2 py-[2px] font-ui text-[11px] font-light tracking-[0.05em] text-foreground transition-colors hover:border-active hover:text-active"
					>{g.label}</a>
				{/if}
			{/each}
		</nav>
	{/if}

	<div class="source-list">
		{#each groups as g (g.label || 'all')}
			<section
				id={g.label ? `g-${encodeURIComponent(g.label)}` : undefined}
				class="source-block grid scroll-mt-24 grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]"
			>
				<!-- Marginal heading · letter (alphabetical), era label,
				     or blank for the single-list sorts. -->
				<div class="min-w-0">
					{#if g.label}
						{@const cm = g.label.match(/^([IVXL]+)([a-z]+)\s+(\S+)$/)}
						<h2
							class="font-heading italic text-accent leading-[1.1]"
							style="font-size: {sortBy === 'alpha' ? '2.5rem' : '1.25rem'};"
						>
							{#if cm && sortBy === 'chrono'}
								{cm[1]}<span>{cm[2]}</span> {cm[3]}
							{:else}
								{g.label}
							{/if}
						</h2>
					{/if}
				</div>

				<ul class="space-y-2">
					{#each g.items as a (a.id)}
						{@const n = quoteCounts.get(a.id) ?? 0}
						{@const split = splitHonorifics(a.name)}
						<li class="flex items-baseline justify-between gap-4">
							<span class="min-w-0">
								<a href={`/peres/${a.slug}`} class="font-body text-foreground hover:text-active">
									{split.core}
									{#if split.titles.length > 0}
										<span class="ml-1 font-ui text-[11px] font-light normal-case tracking-[0.05em] text-muted">
											({split.titles.join(', ')})
										</span>
									{/if}
								</a>
								{#if a.dates}
									<span class="ml-2 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
										{a.dates}
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
