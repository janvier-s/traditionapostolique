<script lang="ts">
	import type { Taxonomy, TaxonomyNode } from '$lib/schema';
	import TaxonomyNodeRow from './TaxonomyNodeRow.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let taxonomy = $state<Taxonomy>(data.taxonomy);
	let dirty = $state(false);
	let saving = $state(false);
	let saveError = $state('');
	let savedFlash = $state(false);

	const PILLARS = ['dieu', 'eglise', 'saints', 'sacrements', 'vie', 'fin'] as const;
	const PILLAR_LABELS: Record<(typeof PILLARS)[number], string> = {
		dieu: 'Dieu, Trinité, Christ',
		eglise: "L'Église et ses sources",
		saints: 'Marie, les saints, miracles',
		sacrements: 'Sacrements et liturgie',
		vie: 'Vie chrétienne et prière',
		fin: 'Les fins dernières'
	};

	function updateRoot(pillar: (typeof PILLARS)[number], idx: number, next: TaxonomyNode | null) {
		const arr = [...taxonomy[pillar]];
		if (next == null) arr.splice(idx, 1);
		else arr[idx] = next;
		taxonomy = { ...taxonomy, [pillar]: arr };
		dirty = true;
	}
	function moveRootUp(pillar: (typeof PILLARS)[number], idx: number) {
		if (idx === 0) return;
		const arr = [...taxonomy[pillar]];
		const tmp = arr[idx - 1]!;
		arr[idx - 1] = arr[idx]!;
		arr[idx] = tmp;
		taxonomy = { ...taxonomy, [pillar]: arr };
		dirty = true;
	}
	function moveRootDown(pillar: (typeof PILLARS)[number], idx: number) {
		const arr = [...taxonomy[pillar]];
		if (idx >= arr.length - 1) return;
		const tmp = arr[idx]!;
		arr[idx] = arr[idx + 1]!;
		arr[idx + 1] = tmp;
		taxonomy = { ...taxonomy, [pillar]: arr };
		dirty = true;
	}
	function addRootUmbrella(pillar: (typeof PILLARS)[number]) {
		taxonomy = {
			...taxonomy,
			[pillar]: [
				...taxonomy[pillar],
				{ id: crypto.randomUUID(), label: 'Nouveau thème', children: [] }
			]
		};
		dirty = true;
	}
	function addRootTopicRef(pillar: (typeof PILLARS)[number]) {
		taxonomy = {
			...taxonomy,
			[pillar]: [
				...taxonomy[pillar],
				{ id: crypto.randomUUID(), topicId: data.topics[0]?.id ?? 0 }
			]
		};
		dirty = true;
	}

	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/admin/api/taxonomy', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(taxonomy)
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
</script>

<h1 class="font-heading text-2xl">Taxonomie</h1>
<p class="mt-2 text-sm text-muted">
	Constructeur du menu de navigation. Thèmes (étiquettes regroupantes) et sujets (références aux
	topics existants).
</p>

<div
	class="sticky top-0 z-10 mt-4 -mx-6 flex items-baseline gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur"
>
	<button
		type="button"
		disabled={!dirty || saving}
		onclick={save}
		class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
	>
		{saving ? 'Enregistrement…' : 'Enregistrer'}
	</button>
	{#if dirty}<span class="text-xs text-amber-600">● Modifications non enregistrées</span>{/if}
	{#if savedFlash}<span class="text-xs text-emerald-600">✓ Enregistré</span>{/if}
	{#if saveError}<span class="text-xs text-red-600">{saveError}</span>{/if}
</div>

<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
	{#each PILLARS as p (p)}
		<section class="rounded border border-border bg-panel/30 p-3">
			<header class="mb-3 flex items-baseline justify-between gap-2">
				<h2 class="font-heading text-lg">{PILLAR_LABELS[p]}</h2>
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
						onclick={() => addRootUmbrella(p)}>+ thème</button
					>
					<button
						type="button"
						class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
						onclick={() => addRootTopicRef(p)}>+ sujet</button
					>
				</div>
			</header>
			<div class="space-y-1">
				{#each taxonomy[p] as node, idx (node.id)}
					<TaxonomyNodeRow
						{node}
						topics={data.topics}
						onChange={(next) => updateRoot(p, idx, next)}
						onMoveUp={() => moveRootUp(p, idx)}
						onMoveDown={() => moveRootDown(p, idx)}
					/>
				{/each}
			</div>
		</section>
	{/each}
</div>
