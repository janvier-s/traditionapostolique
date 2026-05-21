<script lang="ts">
	import { onMount } from 'svelte';
	import type { Section, Topic } from '$lib/schema';

	let items = $state<Topic[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');
	let saving = $state(false);

	const SECTIONS: Section[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

	onMount(async () => {
		const res = await fetch('/admin/api/topics');
		items = await res.json();
	});

	const filtered = $derived(
		items
			.map((t, i) => ({ t, i }))
			.filter(({ t }) => t.label.toLowerCase().includes(search.toLowerCase()))
	);

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);

	function update<K extends keyof Topic>(key: K, value: Topic[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

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
		} finally {
			saving = false;
		}
	}

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
			{#each filtered as { t, i } (t.id)}
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
						{t.label} <span class="text-xs text-muted">#{t.id} · {t.section}</span>
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
					Libellé
					<input
						class={INPUT}
						value={selected.label}
						oninput={(e) => update('label', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label class="block">
					Section
					<select
						class={INPUT}
						value={selected.section}
						onchange={(e) =>
							update('section', (e.currentTarget as HTMLSelectElement).value as Section)}
					>
						{#each SECTIONS as s (s)}<option value={s}>{s}</option>{/each}
					</select>
				</label>
				<label class="block">
					Groupe
					<input
						class={INPUT}
						value={selected.groupe}
						oninput={(e) => update('groupe', (e.currentTarget as HTMLInputElement).value)}
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
			<p class="italic text-muted">Sélectionnez un sujet.</p>
		{/if}
	</div>
</div>
