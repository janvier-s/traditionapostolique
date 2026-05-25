<script lang="ts">
	import type { BercotEntry, BercotStatus, Topic } from '$lib/schema';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';
	import BercotCardEditor from './BercotCardEditor.svelte';

	let { data } = $props();

	type View = 'topic' | 'ungrouped';
	let view = $state<View>('topic');
	let selectedTopicId = $state<number | null>(null);
	let statusFilter = $state<BercotStatus | 'all'>('all');
	let search = $state('');

	// Stats across all bercot entries
	const stats = $derived.by(() => {
		const acc: Record<BercotStatus | 'total', number> = {
			total: 0,
			pending: 0,
			kept: 0,
			rejected: 0,
			published: 0
		};
		for (const b of data.bercot) {
			acc.total++;
			acc[b.status]++;
		}
		return acc;
	});

	// Topic tree flattened for the sidebar
	const topicFlat = $derived.by(() => flattenTree(buildTopicTree(data.topics)));
	const topicFiltered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return topicFlat;
		return topicFlat.filter((n) => n.topic.label.toLowerCase().includes(q));
	});

	const bercotCountByTopic = $derived.by(() => {
		const m = new Map<number, number>();
		for (const b of data.bercot) {
			for (const tid of b.mappedTopicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
		}
		return m;
	});

	const selectedTopic = $derived(
		selectedTopicId != null ? data.topics.find((t) => t.id === selectedTopicId) ?? null : null
	);

	const candidatesForTopic = $derived.by(() => {
		if (!selectedTopic) return [];
		return data.bercot.filter(
			(b) =>
				b.mappedTopicIds.includes(selectedTopic.id) &&
				(statusFilter === 'all' || b.status === statusFilter)
		);
	});
	const siteQuotesForTopic = $derived.by(() => {
		if (!selectedTopic) return [];
		return data.quotes.filter((q) => q.topicIds.includes(selectedTopic.id));
	});

	const ungroupedEntries = $derived(data.bercot.filter((b) => b.mappedTopicIds.length === 0));
	const ungroupedBySource = $derived.by(() => {
		const m = new Map<string, BercotEntry[]>();
		for (const b of ungroupedEntries) {
			const k = b.sourceEntry;
			const arr = m.get(k) ?? [];
			arr.push(b);
			m.set(k, arr);
		}
		return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
	});

	const STATUS_LABEL: Record<BercotStatus | 'all', string> = {
		all: 'Tous',
		pending: 'À examiner',
		kept: 'Retenus',
		rejected: 'Rejetés',
		published: 'Publiés'
	};
	const STATUS_TONE: Record<BercotStatus, string> = {
		pending: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
		kept: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
		rejected: 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30',
		published: 'bg-sky-500/15 text-sky-700 border-sky-500/30'
	};

	const STATUSES: (BercotStatus | 'all')[] = ['all', 'pending', 'kept', 'rejected', 'published'];

	let activeId = $state<string | null>(null);
	let lastTrigger = $state<HTMLElement | null>(null);
	const activeEntry = $derived(
		activeId ? data.bercot.find((b) => b.id === activeId) ?? null : null
	);
	const activeSiblings = $derived(view === 'topic' ? candidatesForTopic : ungroupedEntries);
	const activeIndex = $derived.by(() => {
		if (!activeId) return -1;
		return activeSiblings.findIndex((b) => b.id === activeId);
	});

	function navigate(delta: -1 | 1) {
		if (activeIndex === -1) return;
		const next = activeSiblings[activeIndex + delta];
		if (next) activeId = next.id;
	}

	function onEditorSaved(updated: BercotEntry) {
		const i = data.bercot.findIndex((b) => b.id === updated.id);
		if (i !== -1) data.bercot[i] = updated;
	}

	function onEditorPublished(updated: BercotEntry, _newQuoteId: number) {
		onEditorSaved(updated);
		// Refresh quotes list lazily so any other view that uses it sees the new draft
		void fetch('/admin/api/quotes')
			.then((r) => r.json())
			.then((qs) => (data.quotes = qs));
	}
</script>

<h1 class="font-heading text-2xl">Bercot ({stats.total})</h1>
<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
	<span><strong class="text-fg">{stats.pending}</strong> en attente</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.kept}</strong> retenus</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.rejected}</strong> rejetés</span>
	<span>·</span>
	<span><strong class="text-fg">{stats.published}</strong> publiés</span>
</div>

<div class="mt-4 flex gap-2 border-b border-border pb-2 text-sm">
	<button
		type="button"
		onclick={() => (view = 'topic')}
		class={['rounded px-2 py-1', view === 'topic' && 'bg-subtle/20']}>Par sujet</button
	>
	<button
		type="button"
		onclick={() => (view = 'ungrouped')}
		class={['rounded px-2 py-1', view === 'ungrouped' && 'bg-subtle/20']}
		>Non rattachés ({ungroupedEntries.length})</button
	>
</div>

{#if view === 'topic'}
	<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
		<aside class="border-r border-border pr-4">
			<input
				type="search"
				placeholder="Filtrer les sujets…"
				bind:value={search}
				class="w-full rounded border border-border bg-panel px-2 py-1 text-sm"
			/>
			<ul class="mt-2 max-h-[70vh] overflow-y-auto">
				{#each topicFiltered as { topic: t, depth } (t.id)}
					{@const n = bercotCountByTopic.get(t.id) ?? 0}
					<li>
						<button
							type="button"
							onclick={() => (selectedTopicId = t.id)}
							class={[
								'block w-full rounded px-2 py-1 text-left text-sm hover:bg-subtle/10',
								selectedTopicId === t.id && 'bg-subtle/20'
							]}
							style={depth > 0 ? `padding-left: ${0.5 + depth * 1}rem` : ''}
						>
							<span class="flex items-baseline justify-between gap-2">
								<span class="min-w-0 truncate" class:text-muted={n === 0}>
									{#if depth > 0}<span class="mr-1 text-muted" aria-hidden="true">↳</span>{/if}
									{t.label}
								</span>
								<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</aside>

		<div>
			{#if !selectedTopic}
				<p class="italic text-muted">Sélectionnez un sujet pour voir les citations rattachées.</p>
			{:else}
				<header class="mb-4">
					<h2 class="font-heading text-xl">{selectedTopic.label}</h2>
					<p class="text-xs text-muted">
						{siteQuotesForTopic.length} citation(s) en ligne · {candidatesForTopic.length} candidat(s)
						Bercot
					</p>
				</header>

				{#if siteQuotesForTopic.length > 0}
					<details class="mb-4 rounded border border-border bg-panel/30 p-3 text-sm">
						<summary class="cursor-pointer font-ui uppercase tracking-wider text-muted">
							Citations en ligne ({siteQuotesForTopic.length})
						</summary>
						<ul class="mt-2 max-h-60 space-y-1 overflow-y-auto">
							{#each siteQuotesForTopic as q (q.id)}
								<li class="truncate">
									<a
										href={`/admin/citations#${q.id}`}
										class="hover:text-accent hover:underline"
									>
										<span class="text-xs text-muted">#{q.id}</span>
										{(q.fr ?? q.en ?? '(vide)').replace(/\s+/g, ' ').slice(0, 100)}
									</a>
								</li>
							{/each}
						</ul>
					</details>
				{:else}
					<p class="mb-4 text-xs italic text-muted">Aucune citation en ligne pour ce sujet.</p>
				{/if}

				<div class="mb-3 flex flex-wrap gap-1 text-xs">
					{#each STATUSES as s (s)}
						<button
							type="button"
							onclick={() => (statusFilter = s)}
							class={[
								'rounded border border-border px-2 py-0.5',
								statusFilter === s ? 'bg-subtle/20' : 'hover:bg-subtle/10'
							]}
						>
							{STATUS_LABEL[s]}
						</button>
					{/each}
				</div>

				<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
					{#each candidatesForTopic as b (b.id)}
						<button
							type="button"
							onclick={(e) => {
								lastTrigger = e.currentTarget as HTMLElement;
								activeId = b.id;
							}}
							class="block w-full rounded border border-border bg-panel/30 p-3 text-left text-sm hover:bg-subtle/10"
						>
							<div class="mb-1 flex items-center justify-between gap-2">
								<span class="text-[10px] uppercase tracking-wider text-muted">
									{b.sourceEntry}{b.subsection ? ` · ${b.subsection}` : ''}
								</span>
								<span class={['rounded border px-1.5 py-0.5 text-[10px]', STATUS_TONE[b.status]]}>
									{STATUS_LABEL[b.status]}
								</span>
							</div>
							<p class="line-clamp-3 leading-snug">{b.en}</p>
							<p class="mt-2 text-[11px] text-muted">{b.attribution}</p>
							{#if b.dedupMatch != null && b.status !== 'published'}
								<p class="mt-1 text-[10px] text-sky-700">
									~ correspond à quote #{b.dedupMatch}
								</p>
							{/if}
							{#if b.siteQuoteId != null}
								<p class="mt-1 text-[11px] text-sky-700">
									→ quote #{b.siteQuoteId}
								</p>
							{/if}
						</button>
					{/each}
					{#if candidatesForTopic.length === 0}
						<p class="text-sm italic text-muted">Aucun candidat Bercot pour ce filtre.</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="mt-4">
		<p class="mb-3 text-sm text-muted">
			Entrées du dictionnaire de Bercot qui ne sont rattachées à aucun sujet existant. Groupées
			par entrée d'origine — créez un nouveau sujet à partir de chacune si elle vous intéresse.
		</p>
		<ul class="space-y-3">
			{#each ungroupedBySource as [entry, items] (entry)}
				<li class="rounded border border-border bg-panel/30 p-3">
					<header class="mb-2 flex items-baseline justify-between gap-2">
						<h3 class="font-heading text-base">{entry}</h3>
						<span class="text-xs text-muted">{items.length} citation(s)</span>
					</header>
					<ul class="space-y-1 text-sm">
						{#each items.slice(0, 3) as b (b.id)}
							<li class="truncate text-muted">"{b.en.slice(0, 120)}…"</li>
						{/each}
						{#if items.length > 3}
							<li class="text-xs italic text-muted">… +{items.length - 3} de plus</li>
						{/if}
					</ul>
					<!-- TODO T13: "Créer un sujet" button -->
				</li>
			{/each}
		</ul>
	</div>
{/if}

{#if activeEntry}
	<BercotCardEditor
		entry={activeEntry}
		entries={activeSiblings}
		topics={data.topics}
		authors={data.authors}
		onClose={() => {
			activeId = null;
			lastTrigger?.focus();
			lastTrigger = null;
		}}
		onSaved={onEditorSaved}
		onPublished={onEditorPublished}
		onNavigate={navigate}
	/>
{/if}
