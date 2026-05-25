<script lang="ts">
	import { onMount } from 'svelte';
	import type { Quote, Topic, Pillar } from '$lib/schema';
	import { watchHashSelection } from '../hash-select';
	import { bindEditorShortcuts } from '../editor-utils.svelte';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';
	import { isTheme as isThemeFn } from '$lib/data/topic-helpers';

	let items = $state<Topic[]>([]);
	let quotes = $state<Quote[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	const PILLARS: { value: Pillar; label: string }[] = [
		{ value: 'credo', label: 'Credo — Profession de la foi (CCC I)' },
		{ value: 'sacrements', label: 'Sacrements et liturgie (CCC II)' },
		{ value: 'vie', label: 'Vie en Christ — Morale (CCC III)' },
		{ value: 'priere', label: 'Prière (CCC IV)' }
	];

	onMount(async () => {
		const [t, q] = await Promise.all([
			fetch('/admin/api/topics').then((r) => r.json()),
			fetch('/admin/api/quotes').then((r) => r.json())
		]);
		items = t;
		quotes = q;
	});

	$effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

	const quoteCountByTopic = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of quotes) for (const tid of q.topicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
		return m;
	});

	// Sidebar list: tree-flattened, search filters at any depth
	const flat = $derived.by(() =>
		flattenTree(buildTopicTree(items)).map((n) => ({
			...n,
			idx: items.findIndex((t) => t.id === n.topic.id)
		}))
	);
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return flat;
		return flat.filter((n) => n.topic.label.toLowerCase().includes(q));
	});

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);
	const selectedIsTopLevel = $derived(selected?.parentId == null);
	const selectedIsTheme = $derived(selected ? isThemeFn(selected.id, items) : false);
	const selectedDirectQuoteCount = $derived(
		selected ? quotes.filter((q) => q.topicIds.includes(selected.id)).length : 0
	);
	const selectedSiblings = $derived(
		selected?.parentId != null
			? items.filter((t) => t.parentId === selected!.parentId && t.id !== selected!.id)
			: []
	);

	// Available parents: only top-level topics, excluding the current one
	const parentOptions = $derived.by(() => {
		if (!selected) return items.filter((t) => t.parentId == null);
		return items.filter((t) => t.parentId == null && t.id !== selected.id);
	});

	const selectedQuotes = $derived(
		selected ? quotes.filter((q) => q.topicIds.includes(selected.id)) : []
	);

	function update<K extends keyof Topic>(key: K, value: Topic[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

	let savedFlash = $state(false);
	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/admin/api/topics', {
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

<h1 class="font-heading text-2xl">Sujets ({items.length})</h1>

<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input
			type="search"
			placeholder="Filtrer…"
			bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1"
		/>
		<ul class="mt-2 max-h-[70vh] overflow-y-auto">
			{#each filtered as { topic: t, depth, idx } (t.id)}
				{@const n = quoteCountByTopic.get(t.id) ?? 0}
				<li id={`row-${t.id}`}>
					<button
						type="button"
						onclick={() => {
							selectedIdx = idx;
						}}
						class={[
							'block w-full rounded px-2 py-1 text-left hover:bg-subtle/10',
							selectedIdx === idx && 'bg-subtle/20'
						]}
						style={depth > 0 ? `padding-left: ${0.5 + depth * 1}rem` : ''}
					>
						{#if isThemeFn(t.id, items)}
							<span class="mr-1 rounded bg-subtle/20 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-muted">THÈME</span>
						{:else if t.primary === true}
							<span class="mr-1 rounded bg-accent/15 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-accent">PRINCIPAL</span>
						{/if}
						<span class="flex items-baseline justify-between gap-2">
							<span class="min-w-0 truncate" class:text-muted={n === 0}>
								{#if depth > 0}<span class="mr-1 text-muted" aria-hidden="true">↳</span>{/if}
								{t.label}
							</span>
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
				<span class="font-ui uppercase tracking-wider">Sujet #{selected.id}</span>
				<a
					href={`/sujets/${selected.slug}`}
					target="_blank"
					rel="noopener"
					class="underline-offset-4 hover:text-accent hover:underline">Voir publique ↗</a
				>
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
					Libellé
					<input
						class={INPUT}
						value={selected.label}
						oninput={(e) => update('label', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label class="block">
					Parent
					<select
						class={INPUT}
						value={selected.parentId ?? ''}
						onchange={(e) => {
							const v = (e.currentTarget as HTMLSelectElement).value;
							update('parentId', v === '' ? undefined : Number(v));
						}}
					>
						<option value="">(racine — sujet de premier niveau)</option>
						{#each parentOptions as p (p.id)}
							<option value={p.id}>{p.label}</option>
						{/each}
					</select>
				</label>
				{#if selected.parentId != null}
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={selected.primary === true}
							onchange={(e) => {
								const checked = (e.currentTarget as HTMLInputElement).checked;
								if (checked) {
									for (const s of selectedSiblings) {
										const idx = items.findIndex((t) => t.id === s.id);
										const sibling = idx >= 0 ? items[idx] : undefined;
										if (sibling?.primary) {
											items[idx] = { ...sibling, primary: undefined };
										}
									}
									update('primary', true);
								} else {
									update('primary', undefined);
								}
								dirty = true;
							}}
						/>
						<span class="text-sm">Aspect principal (porte le nom du thème)</span>
					</label>
				{/if}
				{#if selectedIsTopLevel}
					<label class="block">
						Pilier (CCC)
						<select
							class={INPUT}
							value={selected.pillar ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value as Pillar | '';
								update('pillar', v === '' ? undefined : v);
							}}
						>
							<option value="">(non classé)</option>
							{#each PILLARS as p (p.value)}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</label>
				{:else}
					<p class="text-xs italic text-muted">
						Pilier hérité du sujet parent.
					</p>
				{/if}
				<label class="block">
					Ordre
					<input
						type="number"
						class={INPUT}
						value={selected.order ?? ''}
						oninput={(e) => {
							const v = (e.currentTarget as HTMLInputElement).value;
							update('order', v === '' ? undefined : Number(v));
						}}
					/>
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
				{#if selectedIsTheme && selectedDirectQuoteCount > 0}
					<div class="rounded border border-amber-600/40 bg-amber-50/10 p-3 text-sm">
						<p class="font-semibold text-amber-700">
							⚠️ Ce thème porte {selectedDirectQuoteCount} citation(s) directe(s).
						</p>
						<p class="mt-1 text-amber-700/80">
							Les thèmes ne doivent pas porter de citations. Déplacez-les vers l'aspect principal via
							<a href="/admin/migration" class="underline">/admin/migration</a>.
						</p>
					</div>
				{/if}
				<div
					class="sticky bottom-0 -mx-4 mt-6 flex items-baseline gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur"
				>
					<button
						type="submit"
						disabled={!dirty || saving}
						class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
					>
						{saving ? 'Enregistrement…' : 'Enregistrer'}
					</button>
					<span class="text-xs text-muted">⌘/Ctrl + S</span>
					{#if dirty}<span class="text-xs text-amber-600">● Modifications non enregistrées</span
						>{/if}
					{#if savedFlash}<span class="text-xs text-emerald-600">✓ Enregistré</span>{/if}
				</div>
				{#if saveError}<p class="mt-2 text-sm text-red-600">{saveError}</p>{/if}
			</form>

			<section class="mt-8 border-t border-border pt-6">
				<h2 class="font-ui text-xs uppercase tracking-wider text-muted">
					Citations ({selectedQuotes.length})
				</h2>
				{#if selectedQuotes.length === 0}
					<p class="mt-2 text-sm italic text-muted">Aucune citation rattachée.</p>
				{:else}
					<ul class="mt-2 max-h-[40vh] space-y-1 overflow-y-auto text-sm">
						{#each selectedQuotes as q (q.id)}
							<li class="truncate">
								<a href={`/admin/citations#${q.id}`} class="hover:text-accent hover:underline">
									<span class="text-xs text-muted">#{q.id}</span>
									{(q.fr ?? q.en ?? '(vide)').replace(/\s+/g, ' ').slice(0, 80)}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{:else}
			<p class="italic text-muted">Sélectionnez un sujet.</p>
		{/if}
	</div>
</div>
