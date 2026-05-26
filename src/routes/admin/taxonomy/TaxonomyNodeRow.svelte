<script lang="ts">
	import type { TaxonomyNode, Topic } from '$lib/schema';
	import Self from './TaxonomyNodeRow.svelte';

	let {
		node,
		onChange,
		onMoveUp,
		onMoveDown,
		topics,
		depth = 0
	}: {
		node: TaxonomyNode;
		onChange: (next: TaxonomyNode | null) => void;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		topics: Topic[];
		depth?: number;
	} = $props();

	const isUmbrella = $derived(node.label != null);
	const isTopicRef = $derived(node.topicId != null);

	function update<K extends keyof TaxonomyNode>(key: K, value: TaxonomyNode[K]) {
		onChange({ ...node, [key]: value });
	}
	function addUmbrella() {
		const children = [
			...(node.children ?? []),
			{ id: crypto.randomUUID(), label: 'Nouveau thème', children: [] }
		];
		onChange({ ...node, children });
	}
	function addTopicRef() {
		const children = [
			...(node.children ?? []),
			{ id: crypto.randomUUID(), topicId: topics[0]?.id ?? 0 }
		];
		onChange({ ...node, children });
	}
	function replaceChild(idx: number, child: TaxonomyNode | null) {
		const arr = [...(node.children ?? [])];
		if (child == null) arr.splice(idx, 1);
		else arr[idx] = child;
		onChange({ ...node, children: arr });
	}
	function moveChildUp(idx: number) {
		if (idx === 0) return;
		const arr = [...(node.children ?? [])];
		const tmp = arr[idx - 1]!;
		arr[idx - 1] = arr[idx]!;
		arr[idx] = tmp;
		onChange({ ...node, children: arr });
	}
	function moveChildDown(idx: number) {
		const arr = [...(node.children ?? [])];
		if (idx >= arr.length - 1) return;
		const tmp = arr[idx]!;
		arr[idx] = arr[idx + 1]!;
		arr[idx + 1] = tmp;
		onChange({ ...node, children: arr });
	}
</script>

<div class="border-l border-border pl-3">
	<div class="flex items-center gap-2 py-1">
		{#if isUmbrella}
			<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Thème</span>
			<input
				class="grow rounded border border-border bg-panel px-2 py-1 text-sm"
				value={node.label ?? ''}
				oninput={(e) => update('label', (e.currentTarget as HTMLInputElement).value)}
			/>
		{:else if isTopicRef}
			<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Sujet</span>
			<select
				class="grow rounded border border-border bg-panel px-2 py-1 text-sm"
				value={node.topicId ?? 0}
				onchange={(e) => update('topicId', Number((e.currentTarget as HTMLSelectElement).value))}
			>
				{#each topics as t (t.id)}
					<option value={t.id}>{t.label}</option>
				{/each}
			</select>
			<label class="flex items-center gap-1 text-xs">
				<input
					type="checkbox"
					checked={node.primary === true}
					onchange={(e) =>
						update('primary', (e.currentTarget as HTMLInputElement).checked || undefined)}
				/>
				principal
			</label>
		{/if}

		<button
			type="button"
			class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
			onclick={() => onMoveUp?.()}>↑</button
		>
		<button
			type="button"
			class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
			onclick={() => onMoveDown?.()}>↓</button
		>
		{#if isUmbrella}
			<button
				type="button"
				class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
				onclick={addUmbrella}>+ thème</button
			>
			<button
				type="button"
				class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
				onclick={addTopicRef}>+ sujet</button
			>
		{/if}
		<button
			type="button"
			class="rounded border border-border bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
			onclick={() => onChange(null)}>×</button
		>
	</div>

	{#if isUmbrella && node.children && node.children.length > 0}
		<div class="ml-2">
			{#each node.children as c, idx (c.id)}
				<Self
					node={c}
					{topics}
					depth={depth + 1}
					onChange={(next) => replaceChild(idx, next)}
					onMoveUp={() => moveChildUp(idx)}
					onMoveDown={() => moveChildDown(idx)}
				/>
			{/each}
		</div>
	{/if}
</div>
