<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Work } from '$lib/schema';

	let items = $state<Work[]>([]);
	let authors = $state<Author[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	onMount(async () => {
		const [worksRes, authorsRes] = await Promise.all([
			fetch('/admin/api/works'),
			fetch('/admin/api/authors')
		]);
		items = await worksRes.json();
		authors = await authorsRes.json();
	});

	const filtered = $derived(
		items
			.map((w, i) => ({ w, i }))
			.filter(({ w }) => w.title.toLowerCase().includes(search.toLowerCase()))
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);

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
		} finally {
			saving = false;
		}
	}

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
				<li>
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
						{w.title} <span class="text-xs text-muted">#{w.id}</span>
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
							update(
								'compositionDate',
								(e.currentTarget as HTMLInputElement).value || undefined
							)}
					/>
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
			<p class="italic text-muted">Sélectionnez une œuvre.</p>
		{/if}
	</div>
</div>
