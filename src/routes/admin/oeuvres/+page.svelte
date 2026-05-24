<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Quote, Work } from '$lib/schema';
	import { watchHashSelection } from '../hash-select';
	import { bindEditorShortcuts } from '../editor-utils.svelte';

	let items = $state<Work[]>([]);
	let authors = $state<Author[]>([]);
	let quotes = $state<Quote[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	onMount(async () => {
		const [w, a, q] = await Promise.all([
			fetch('/admin/api/works').then((r) => r.json()),
			fetch('/admin/api/authors').then((r) => r.json()),
			fetch('/admin/api/quotes').then((r) => r.json())
		]);
		items = w;
		authors = a;
		quotes = q;
	});

	$effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

	const quoteCountByWork = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of quotes) if (q.workId != null) m.set(q.workId, (m.get(q.workId) ?? 0) + 1);
		return m;
	});

	const filtered = $derived(
		items
			.map((w, i) => ({ w, i }))
			.filter(({ w }) => w.title.toLowerCase().includes(search.toLowerCase()))
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);
	const selectedQuotes = $derived(selected ? quotes.filter((q) => q.workId === selected.id) : []);
	const selectedAuthor = $derived(selected ? authors.find((a) => a.id === selected.authorId) : null);

	function update<K extends keyof Work>(key: K, value: Work[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

	function updateAltTitles(raw: string) {
		const list = raw
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
		update('alternativeTitles', list.length ? list : undefined);
	}

	let savedFlash = $state(false);
	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/admin/api/works', {
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

<h1 class="font-heading text-2xl">Œuvres ({items.length})</h1>

<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input
			type="search"
			placeholder="Filtrer…"
			bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1"
		/>
		<ul class="mt-2 max-h-[70vh] overflow-y-auto">
			{#each filtered as { w, i } (w.id)}
				{@const n = quoteCountByWork.get(w.id) ?? 0}
				<li id={`row-${w.id}`}>
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
						<span class="min-w-0 truncate" class:text-muted={n === 0}>{w.title}</span>
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
				<span class="font-ui uppercase tracking-wider">Œuvre #{selected.id}</span>
				<a href={`/oeuvres/${selected.slug}`} target="_blank" rel="noopener" class="underline-offset-4 hover:text-active hover:underline">Voir publique ↗</a>
				{#if selectedAuthor}
					<a href={`/admin/auteurs#${selectedAuthor.id}`} class="underline-offset-4 hover:text-active hover:underline">Auteur · {selectedAuthor.name}</a>
				{/if}
				<span>·</span>
				<span>{selectedQuotes.length} citation{selectedQuotes.length > 1 ? 's' : ''}</span>
			</nav>
			<form
				class="space-y-3"
				onsubmit={(e) => {
					e.preventDefault();
					save();
				}}
			>
				<label class="block">
					Titre
					<input
						class={INPUT}
						value={selected.title}
						oninput={(e) => update('title', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label class="block">
					Titres alternatifs (un par ligne)
					<textarea
						class="mt-1 h-24 w-full rounded border border-border bg-panel px-2 py-1"
						value={(selected.alternativeTitles ?? []).join('\n')}
						oninput={(e) => updateAltTitles((e.currentTarget as HTMLTextAreaElement).value)}
					></textarea>
				</label>
				<label class="block">
					Auteur
					<select
						class={INPUT}
						value={selected.authorId}
						onchange={(e) =>
							update('authorId', Number((e.currentTarget as HTMLSelectElement).value))}
					>
						{#each authors as a (a.id)}
							<option value={a.id}>{a.name} #{a.id}</option>
						{/each}
					</select>
				</label>
				<label class="block">
					Description
					<textarea
						class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.description ?? ''}
						oninput={(e) =>
							update('description', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
				<label class="block">
					Lien
					<input
						class={INPUT}
						value={selected.link ?? ''}
						oninput={(e) =>
							update('link', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>
				<label class="block">
					Résumé (phase 2)
					<textarea
						class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.summary ?? ''}
						oninput={(e) =>
							update('summary', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
				<label class="block">
					Date de composition (phase 2)
					<input
						class={INPUT}
						value={selected.compositionDate ?? ''}
						oninput={(e) =>
							update('compositionDate', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
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
				<h2 class="font-ui text-xs uppercase tracking-wider text-muted">Citations ({selectedQuotes.length})</h2>
				{#if selectedQuotes.length === 0}
					<p class="mt-2 text-sm italic text-muted">Aucune citation rattachée.</p>
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
			<p class="italic text-muted">Sélectionnez une œuvre.</p>
		{/if}
	</div>
</div>
