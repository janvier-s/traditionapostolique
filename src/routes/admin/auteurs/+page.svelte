<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author, Era } from '$lib/schema';

	let items = $state<Author[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	const ERAS: Era[] = ['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval'];

	onMount(async () => {
		const res = await fetch('/admin/api/authors');
		items = await res.json();
	});

	const filtered = $derived(
		items
			.map((a, i) => ({ a, i }))
			.filter(({ a }) => a.name.toLowerCase().includes(search.toLowerCase()))
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);

	function update<K extends keyof Author>(key: K, value: Author[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

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
		} finally {
			saving = false;
		}
	}

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
						{a.name} <span class="text-xs text-muted">#{a.id}</span>
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
			<p class="italic text-muted">Sélectionnez un auteur.</p>
		{/if}
	</div>
</div>
