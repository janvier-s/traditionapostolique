<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Quote, Topic, Work } from '$lib/schema';

	let items = $state<Quote[]>([]);
	let authors = $state<Author[]>([]);
	let works = $state<Work[]>([]);
	let topics = $state<Topic[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);
	let topicPick = $state<number | ''>('');

	const STATUSES: Array<'draft' | 'ok'> = ['draft', 'ok'];

	onMount(async () => {
		const [q, a, w, t] = await Promise.all([
			fetch('/admin/api/quotes'),
			fetch('/admin/api/authors'),
			fetch('/admin/api/works'),
			fetch('/admin/api/topics')
		]);
		items = await q.json();
		authors = await a.json();
		works = await w.json();
		topics = await t.json();
		items.sort((x, y) => x.id - y.id);
	});

	const topicById = $derived(new Map(topics.map((t) => [t.id, t])));

	const filtered = $derived(
		items
			.map((q, i) => ({ q, i }))
			.filter(({ q }) => {
				const needle = search.toLowerCase();
				if (!needle) return true;
				return (
					(q.fr ?? '').toLowerCase().includes(needle) ||
					(q.title ?? '').toLowerCase().includes(needle) ||
					(q.reference ?? '').toLowerCase().includes(needle)
				);
			})
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);

	function update<K extends keyof Quote>(key: K, value: Quote[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

	function updateLinks(key: 'primary' | 'archive', raw: string) {
		if (!selected) return;
		const links = { ...(selected.links ?? {}) };
		if (raw) links[key] = raw;
		else delete links[key];
		items[selectedIdx] = { ...selected, links };
		dirty = true;
	}

	function addTopic(id: number) {
		if (!selected) return;
		if (selected.topicIds.includes(id)) return;
		update('topicIds', [...selected.topicIds, id]);
	}

	function removeTopic(id: number) {
		if (!selected) return;
		if (selected.topicIds.length <= 1) return;
		update(
			'topicIds',
			selected.topicIds.filter((t) => t !== id)
		);
	}

	function listLabel(q: Quote): string {
		if (q.title?.trim()) return q.title;
		const fr = (q.fr ?? '').replace(/\s+/g, ' ').trim();
		return fr.length > 60 ? fr.slice(0, 60) + '…' : fr || '(vide)';
	}

	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/admin/api/quotes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(items)
			});
			if (!res.ok) {
				saveError = await res.text();
				return;
			}
			dirty = false;
		} finally {
			saving = false;
		}
	}

	const INPUT = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
	const TA = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
	const TA_LG = 'mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1';
	const TA_SM = 'mt-1 h-20 w-full rounded border border-border bg-panel px-2 py-1';
</script>

<h1 class="font-heading text-2xl">Citations ({items.length})</h1>

<div class="mt-4 grid grid-cols-[320px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input
			type="search"
			placeholder="Filtrer (fr, titre, référence)…"
			bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1"
		/>
		<ul class="mt-2 max-h-[75vh] overflow-y-auto">
			{#each filtered as { q, i } (q.id)}
				<li>
					<button
						type="button"
						onclick={() => {
							selectedIdx = i;
						}}
						class={[
							'block w-full rounded px-2 py-1 text-left text-sm hover:bg-subtle/10',
							selectedIdx === i && 'bg-subtle/20'
						]}
					>
						<span class="text-xs text-muted">#{q.id}</span>
						{listLabel(q)}
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<div>
		{#if selected}
			<form
				class="space-y-3"
				onsubmit={(e) => {
					e.preventDefault();
					save();
				}}
			>
				<label class="block">
					Titre (phase 2, optionnel)
					<input
						class={INPUT}
						value={selected.title ?? ''}
						oninput={(e) =>
							update('title', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>

				<div class="grid grid-cols-2 gap-3">
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
						Œuvre
						<select
							class={INPUT}
							value={selected.workId ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								update('workId', v ? Number(v) : undefined);
							}}
						>
							<option value="">(aucune)</option>
							{#each works as w (w.id)}
								<option value={w.id}>{w.title} #{w.id}</option>
							{/each}
						</select>
					</label>
				</div>

				<div>
					<div class="font-ui text-sm">Sujets</div>
					<ul class="mt-1 flex flex-wrap gap-1">
						{#each selected.topicIds as tid (tid)}
							{@const t = topicById.get(tid)}
							<li
								class="inline-flex items-center gap-1 rounded border border-border bg-panel px-2 py-0.5 text-xs"
							>
								{t ? `${t.label} (${t.section})` : `#${tid} (inconnu)`}
								<button
									type="button"
									aria-label="Retirer le sujet"
									onclick={() => removeTopic(tid)}
									class="rounded px-1 text-muted hover:text-accent-text"
									disabled={selected.topicIds.length <= 1}>×</button
								>
							</li>
						{/each}
					</ul>
					<div class="mt-2 flex gap-2">
						<select
							class="rounded border border-border bg-panel px-2 py-1 text-sm"
							bind:value={topicPick}
						>
							<option value="">Ajouter un sujet…</option>
							{#each topics as t (t.id)}
								{#if !selected.topicIds.includes(t.id)}
									<option value={t.id}>{t.label} ({t.section}) #{t.id}</option>
								{/if}
							{/each}
						</select>
						<button
							type="button"
							onclick={() => {
								if (topicPick !== '') {
									addTopic(Number(topicPick));
									topicPick = '';
								}
							}}
							class="rounded border border-border bg-panel px-2 py-1 text-sm hover:bg-subtle/10"
							>Ajouter</button
						>
					</div>
				</div>

				<label class="block">
					Référence
					<input
						class={INPUT}
						value={selected.reference ?? ''}
						oninput={(e) =>
							update('reference', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>

				<label class="block">
					Français
					<textarea
						class={TA_LG}
						value={selected.fr ?? ''}
						oninput={(e) =>
							update('fr', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					Anglais
					<textarea
						class={TA_SM}
						value={selected.en ?? ''}
						oninput={(e) =>
							update('en', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					Latin
					<textarea
						class={TA_SM}
						value={selected.latin ?? ''}
						oninput={(e) =>
							update('latin', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					Grec / Syriaque
					<textarea
						class={TA_SM}
						value={selected.greek ?? ''}
						oninput={(e) =>
							update('greek', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					Contexte
					<textarea
						class={TA}
						value={selected.context ?? ''}
						oninput={(e) =>
							update('context', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						Migne
						<input
							class={INPUT}
							value={selected.migne ?? ''}
							oninput={(e) =>
								update('migne', (e.currentTarget as HTMLInputElement).value || undefined)}
						/>
					</label>
					<label class="block">
						Statut
						<select
							class={INPUT}
							value={selected.status ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								update('status', (v as 'draft' | 'ok') || undefined);
							}}
						>
							<option value="">(non défini)</option>
							{#each STATUSES as s (s)}<option value={s}>{s}</option>{/each}
						</select>
					</label>
				</div>

				<label class="block">
					Lien principal
					<input
						class={INPUT}
						value={selected.links?.primary ?? ''}
						oninput={(e) => updateLinks('primary', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>

				<label class="block">
					Lien archive
					<input
						class={INPUT}
						value={selected.links?.archive ?? ''}
						oninput={(e) => updateLinks('archive', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>

				<label class="block">
					Notes
					<textarea
						class={TA}
						value={selected.notes ?? ''}
						oninput={(e) =>
							update('notes', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<button
					type="submit"
					disabled={!dirty || saving}
					class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-accent-text disabled:opacity-50"
				>
					{saving ? 'Enregistrement…' : 'Enregistrer'}
				</button>
				{#if saveError}<p class="mt-2 text-sm text-red-600">{saveError}</p>{/if}
			</form>
		{:else}
			<p class="italic text-muted">Sélectionnez une citation.</p>
		{/if}
	</div>
</div>
