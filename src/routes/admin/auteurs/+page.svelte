<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Era, Quote, Work } from '$lib/schema';
	import { watchHashSelection } from '../hash-select';
	import { bindEditorShortcuts } from '../editor-utils.svelte';

	let items = $state<Author[]>([]);
	let works = $state<Work[]>([]);
	let quotes = $state<Quote[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	const ERAS: Era[] = ['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval'];

	onMount(async () => {
		const [a, w, q] = await Promise.all([
			fetch('/admin/api/authors').then((r) => r.json()),
			fetch('/admin/api/works').then((r) => r.json()),
			fetch('/admin/api/quotes').then((r) => r.json())
		]);
		items = a;
		works = w;
		quotes = q;
	});

	const quoteCountByAuthor = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of quotes) m.set(q.authorId, (m.get(q.authorId) ?? 0) + 1);
		return m;
	});

	$effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

	const filtered = $derived(
		items
			.map((a, i) => ({ a, i }))
			.filter(({ a }) => a.name.toLowerCase().includes(search.toLowerCase()))
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);
	const selectedWorks = $derived(selected ? works.filter((w) => w.authorId === selected.id) : []);
	const selectedQuotes = $derived(selected ? quotes.filter((q) => q.authorId === selected.id) : []);

	function update<K extends keyof Author>(key: K, value: Author[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

	let savedFlash = $state(false);
	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/admin/api/authors', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(items)
			});
			if (!res.ok) {
				saveError = await res.text();
				return;
			}
			dirty = false;
			savedFlash = true;
			setTimeout(() => (savedFlash = false), 1500);
		} finally {
			saving = false;
		}
	}

	$effect(() => bindEditorShortcuts({ isDirty: () => dirty, isSaving: () => saving, save }));

	const INPUT = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
</script>

<h1 class="font-heading text-2xl">Auteurs ({items.length})</h1>

<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input
			type="search"
			placeholder="Filtrer…"
			bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1"
		/>
		<ul class="mt-2 max-h-[70vh] overflow-y-auto">
			{#each filtered as { a, i } (a.id)}
				{@const n = quoteCountByAuthor.get(a.id) ?? 0}
				<li id={`row-${a.id}`}>
					<button
						type="button"
						onclick={() => {
							selectedIdx = i;
						}}
						class={[
							'block w-full rounded px-2 py-1 text-left hover:bg-subtle/10',
							selectedIdx === i && 'bg-subtle/20'
						]}
					>
						<span class="flex items-baseline justify-between gap-2">
							<span class="min-w-0 truncate" class:text-muted={n === 0}>{a.name}</span>
							<span class="shrink-0 font-ui text-[11px] font-light text-muted">{n || '—'}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<div>
		{#if selected}
			<nav class="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted">
				<span class="font-ui uppercase tracking-wider">Auteur #{selected.id}</span>
				<a href={`/peres/${selected.slug}`} target="_blank" rel="noopener" class="underline-offset-4 hover:text-active hover:underline">Voir publique ↗</a>
				<span>·</span>
				<span>{selectedQuotes.length} citation{selectedQuotes.length > 1 ? 's' : ''}</span>
				<span>·</span>
				<span>{selectedWorks.length} œuvre{selectedWorks.length > 1 ? 's' : ''}</span>
			</nav>
			<form
				class="space-y-3"
				onsubmit={(e) => {
					e.preventDefault();
					save();
				}}
			>
				<label class="block">
					Nom
					<input
						class={INPUT}
						value={selected.name}
						oninput={(e) => update('name', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label class="block">
					Nom d'origine
					<input
						class={INPUT}
						value={selected.originalName ?? ''}
						oninput={(e) =>
							update('originalName', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Ère
					<select
						class={INPUT}
						value={selected.era}
						onchange={(e) => update('era', (e.currentTarget as HTMLSelectElement).value as Era)}
					>
						{#each ERAS as e (e)}<option value={e}>{e}</option>{/each}
					</select>
				</label>
				<label class="block">
					Dates
					<input
						class={INPUT}
						value={selected.dates ?? ''}
						oninput={(e) =>
							update('dates', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Région
					<input
						class={INPUT}
						value={selected.region ?? ''}
						oninput={(e) =>
							update('region', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Fonction
					<input
						class={INPUT}
						value={selected.function ?? ''}
						oninput={(e) =>
							update('function', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Statut
					<input
						class={INPUT}
						value={selected.status ?? ''}
						oninput={(e) =>
							update('status', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Bio courte
					<textarea
						class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.bioShort ?? ''}
						oninput={(e) =>
							update('bioShort', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
				<label class="block">
					Bio longue (phase 2, Markdown)
					<textarea
						class="mt-1 h-48 w-full rounded border border-border bg-panel px-2 py-1 font-mono text-xs"
						value={selected.bioLong ?? ''}
						oninput={(e) =>
							update('bioLong', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
				<div class="sticky bottom-0 -mx-4 mt-6 flex items-baseline gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
					<button
						type="submit"
						disabled={!dirty || saving}
						class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
					>
						{saving ? 'Enregistrement…' : 'Enregistrer'}
					</button>
					<span class="text-xs text-muted">⌘/Ctrl + S</span>
					{#if dirty}<span class="text-xs text-amber-600">● Modifications non enregistrées</span>{/if}
					{#if savedFlash}<span class="text-xs text-emerald-600">✓ Enregistré</span>{/if}
				</div>
				{#if saveError}<p class="mt-2 text-sm text-red-600">{saveError}</p>{/if}
			</form>

			<section class="mt-8 border-t border-border pt-6">
				<h2 class="font-ui text-xs uppercase tracking-wider text-muted">Œuvres ({selectedWorks.length})</h2>
				{#if selectedWorks.length === 0}
					<p class="mt-2 text-sm italic text-muted">Aucune œuvre rattachée.</p>
				{:else}
					<ul class="mt-2 space-y-1 text-sm">
						{#each selectedWorks as w (w.id)}
							<li>
								<a href={`/admin/oeuvres#${w.id}`} class="hover:text-active hover:underline">{w.title}</a>
								<span class="ml-1 text-xs text-muted">#{w.id}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="mt-8 border-t border-border pt-6">
				<h2 class="font-ui text-xs uppercase tracking-wider text-muted">Citations ({selectedQuotes.length})</h2>
				{#if selectedQuotes.length === 0}
					<p class="mt-2 text-sm italic text-muted">Aucune citation.</p>
				{:else}
					<ul class="mt-2 max-h-[40vh] space-y-1 overflow-y-auto text-sm">
						{#each selectedQuotes as q (q.id)}
							<li class="truncate">
								<a href={`/admin/citations#${q.id}`} class="hover:text-active hover:underline">
									<span class="text-xs text-muted">#{q.id}</span>
									{(q.fr ?? q.en ?? '(vide)').replace(/\s+/g, ' ').slice(0, 80)}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{:else}
			<p class="italic text-muted">Sélectionnez un auteur.</p>
		{/if}
	</div>
</div>
