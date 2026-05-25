<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Quote, Topic, Work } from '$lib/schema';
	import { watchHashSelection } from '../hash-select';
	import { bindEditorShortcuts } from '../editor-utils.svelte';

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

	type SortKey = 'id' | 'author' | 'topic' | 'status' | 'missing-fr';
	const SORT_OPTIONS: { value: SortKey; label: string }[] = [
		{ value: 'id', label: 'ID' },
		{ value: 'author', label: 'Auteur (A→Z)' },
		{ value: 'topic', label: 'Sujet' },
		{ value: 'status', label: 'Statut (brouillons d’abord)' },
		{ value: 'missing-fr', label: 'Sans traduction française' }
	];
	let sortBy = $state<SortKey>('id');
	type FilterKey = 'no-fr' | 'no-work' | 'no-ref' | 'draft';
	const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
		{ value: 'no-fr', label: 'Sans fr' },
		{ value: 'no-work', label: 'Sans œuvre' },
		{ value: 'no-ref', label: 'Sans référence' },
		{ value: 'draft', label: 'Brouillon' }
	];
	let activeFilters = $state<Set<FilterKey>>(new Set());
	function toggleFilter(f: FilterKey) {
		const next = new Set(activeFilters);
		if (next.has(f)) next.delete(f);
		else next.add(f);
		activeFilters = next;
	}

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

	$effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

	function wrapItalics(field: 'fr' | 'en' | 'latin' | 'greek' | 'context') {
		if (!selected) return;
		const el = document.getElementById(`ta-${field}`) as HTMLTextAreaElement | null;
		if (!el) return;
		const v = el.value;
		const s = el.selectionStart ?? 0;
		const e = el.selectionEnd ?? 0;
		const before = v.slice(0, s);
		const sel = v.slice(s, e) || 'texte';
		const after = v.slice(e);
		const nv = `${before}*${sel}*${after}`;
		update(field, nv);
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(s + 1, s + 1 + sel.length);
		});
	}

	const topicById = $derived(new Map(topics.map((t) => [t.id, t])));

	const authorById = $derived(new Map(authors.map((a) => [a.id, a])));

	const filtered = $derived.by(() => {
		const needle = search.toLowerCase();
		const passes = items
			.map((q, i) => ({ q, i }))
			.filter(({ q }) => {
				if (needle) {
					const a = authorById.get(q.authorId);
					if (
						!(q.fr ?? '').toLowerCase().includes(needle) &&
						!(q.title ?? '').toLowerCase().includes(needle) &&
						!(q.reference ?? '').toLowerCase().includes(needle) &&
						!(a?.name ?? '').toLowerCase().includes(needle)
					)
						return false;
				}
				if (activeFilters.has('no-fr') && q.fr) return false;
				if (activeFilters.has('no-work') && q.workId != null) return false;
				if (activeFilters.has('no-ref') && q.reference) return false;
				if (activeFilters.has('draft') && q.status !== 'draft') return false;
				return true;
			});

		const cmp = (a: (typeof passes)[number], b: (typeof passes)[number]) => {
			switch (sortBy) {
				case 'author': {
					const na = authorById.get(a.q.authorId)?.name ?? '';
					const nb = authorById.get(b.q.authorId)?.name ?? '';
					return na.localeCompare(nb, 'fr') || a.q.id - b.q.id;
				}
				case 'topic': {
					const ta = topicById.get(a.q.topicIds[0] ?? -1)?.label ?? '';
					const tb = topicById.get(b.q.topicIds[0] ?? -1)?.label ?? '';
					return ta.localeCompare(tb, 'fr') || a.q.id - b.q.id;
				}
				case 'status': {
					const sa = a.q.status === 'draft' ? 0 : 1;
					const sb = b.q.status === 'draft' ? 0 : 1;
					return sa - sb || a.q.id - b.q.id;
				}
				case 'missing-fr': {
					const ma = a.q.fr ? 1 : 0;
					const mb = b.q.fr ? 1 : 0;
					return ma - mb || a.q.id - b.q.id;
				}
				default:
					return a.q.id - b.q.id;
			}
		};
		return passes.slice().sort(cmp);
	});

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

	let savedFlash = $state(false);
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
			savedFlash = true;
			setTimeout(() => (savedFlash = false), 1500);
		} finally {
			saving = false;
		}
	}

	$effect(() =>
		bindEditorShortcuts({
			isDirty: () => dirty,
			isSaving: () => saving,
			save
		})
	);

	function selectByOffset(delta: number) {
		if (filtered.length === 0) return;
		const visible = filtered.map((f) => f.i);
		const pos = visible.indexOf(selectedIdx);
		const next =
			pos < 0
				? delta > 0
					? 0
					: visible.length - 1
				: (pos + delta + visible.length) % visible.length;
		const target = visible[next];
		if (target == null) return;
		selectedIdx = target;
		const id = items[target]?.id;
		if (id != null) {
			history.replaceState(null, '', `#${id}`);
			queueMicrotask(() =>
				document.getElementById(`row-${id}`)?.scrollIntoView({ block: 'center' })
			);
		}
	}

	const INPUT = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
	const TA = 'mt-1 w-full rounded border border-border bg-panel px-2 py-1';
	const TA_LG = 'mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1';
	const TA_SM = 'mt-1 h-20 w-full rounded border border-border bg-panel px-2 py-1';
</script>

<h1 class="font-heading text-2xl">Citations ({filtered.length} / {items.length})</h1>

<div class="mt-4 grid grid-cols-[320px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input
			type="search"
			placeholder="Filtrer (fr, titre, référence, auteur)…"
			bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1"
		/>
		<label class="mt-2 flex items-center gap-2 text-xs text-muted">
			<span>Tri</span>
			<select
				bind:value={sortBy}
				class="flex-1 rounded border border-border bg-panel px-2 py-1 text-foreground"
			>
				{#each SORT_OPTIONS as o (o.value)}
					<option value={o.value}>{o.label}</option>
				{/each}
			</select>
		</label>
		<div class="mt-2 flex flex-wrap gap-1">
			{#each FILTER_OPTIONS as f (f.value)}
				{@const active = activeFilters.has(f.value)}
				<button
					type="button"
					onclick={() => toggleFilter(f.value)}
					aria-pressed={active}
					class="rounded-full border border-border px-2 py-[2px] text-[11px] transition-colors hover:border-active"
					class:bg-active={active}
					class:border-active={active}
					class:text-background={active}
					class:text-foreground={!active}>{f.label}</button
				>
			{/each}
		</div>
		<ul class="mt-2 max-h-[70vh] overflow-y-auto">
			{#each filtered as { q, i } (q.id)}
				{@const a = authorById.get(q.authorId)}
				<li id={`row-${q.id}`}>
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
						<div class="flex items-baseline gap-1.5 text-[11px] text-muted">
							<span>#{q.id}</span>
							{#if a}<span class="truncate">· {a.name}</span>{/if}
							{#if q.status === 'draft'}<span
									class="ml-auto rounded bg-amber-100 px-1 text-[10px] text-amber-700">draft</span
								>{/if}
							{#if !q.fr}<span class="rounded bg-red-100 px-1 text-[10px] text-red-700">no fr</span
								>{/if}
						</div>
						<span class="line-clamp-2">{listLabel(q)}</span>
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<div>
		{#if selected}
			{@const sa = authors.find((a) => a.id === selected!.authorId)}
			{@const sw = selected.workId ? works.find((w) => w.id === selected!.workId) : null}
			<nav class="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted">
				<span class="font-ui uppercase tracking-wider">Citation #{selected.id}</span>
				<button
					type="button"
					onclick={() => selectByOffset(-1)}
					class="underline-offset-4 hover:text-accent hover:underline"
					title="Précédent">← Préc</button
				>
				<button
					type="button"
					onclick={() => selectByOffset(1)}
					class="underline-offset-4 hover:text-accent hover:underline"
					title="Suivant">Suiv →</button
				>
				<a
					href={`/citation/${selected.id}`}
					target="_blank"
					rel="noopener"
					class="underline-offset-4 hover:text-accent hover:underline">Voir publique ↗</a
				>
				{#if sa}
					<a
						href={`/admin/auteurs#${sa.id}`}
						class="underline-offset-4 hover:text-accent hover:underline">Auteur · {sa.name}</a
					>
				{/if}
				{#if sw}
					<a
						href={`/admin/oeuvres#${sw.id}`}
						class="underline-offset-4 hover:text-accent hover:underline">Œuvre · {sw.title}</a
					>
				{/if}
				{#each selected.topicIds as tid (tid)}
					{@const t = topicById.get(tid)}
					{#if t}
						<a
							href={`/admin/sujets#${t.id}`}
							class="underline-offset-4 hover:text-accent hover:underline">Sujet · {t.label}</a
						>
					{/if}
				{/each}
			</nav>
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
								{t ? `${t.label} (${t.pillar ?? '—'})` : `#${tid} (inconnu)`}
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
							{#each [
								{ key: 'credo',      label: 'Credo — Profession de la foi (CCC I)' },
								{ key: 'sacrements', label: 'Sacrements et liturgie (CCC II)' },
								{ key: 'vie',        label: 'Vie en Christ — Morale (CCC III)' },
								{ key: 'priere',     label: 'Prière (CCC IV)' },
								{ key: '',           label: 'Non classé' }
							] as grp (grp.key)}
								{@const grpTopics = topics.filter(
									(t) => (t.pillar ?? '') === grp.key && !selected.topicIds.includes(t.id)
								)}
								{#if grpTopics.length > 0}
									<optgroup label={grp.label}>
										{#each grpTopics as t (t.id)}
											<option value={t.id}>{t.label} #{t.id}</option>
										{/each}
									</optgroup>
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
					Titre étude (précision en mode Étude)
					<input
						class={INPUT}
						placeholder="ex. Lettre 15. Au pape Damase."
						value={selected.studyTitle ?? ''}
						oninput={(e) =>
							update('studyTitle', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
					<p class="mt-1 text-xs text-muted">
						Affiché en mode Étude à la place du titre court de l'œuvre. À utiliser quand le titre de
						l'œuvre est générique (« Lettres », « Sermons »…) et que l'on connaît la pièce précise.
					</p>
				</label>

				<div class="block">
					<div class="flex items-baseline justify-between">
						<label for="ta-fr">Français</label>
						<button
							type="button"
							onclick={() => wrapItalics('fr')}
							class="rounded border border-border bg-panel px-2 py-0.5 text-xs italic hover:bg-subtle/10"
							title="Entoure la sélection de * * (italique)">I</button
						>
					</div>
					<textarea
						id="ta-fr"
						class={TA_LG}
						value={selected.fr ?? ''}
						oninput={(e) =>
							update('fr', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
					<p class="mt-1 text-xs text-muted">
						Astuce&nbsp;: entourez un texte de <code>*</code> pour le rendre en italique.
					</p>
				</div>

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
		{:else}
			<p class="italic text-muted">Sélectionnez une citation.</p>
		{/if}
	</div>
</div>
