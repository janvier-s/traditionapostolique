<script lang="ts">
	import type { QuoteSort } from '$lib/utils/filters';
	let { value, onChange }: { value: QuoteSort; onChange: (v: QuoteSort) => void } = $props();
	const OPTIONS: Array<[QuoteSort, string]> = [
		['date-asc', 'Date (du plus ancien)'],
		['date-desc', 'Date (du plus récent)'],
		['author', 'Auteur (A–Z)'],
		['work', 'Œuvre'],
		['canonical', 'Ordre canonique']
	];
</script>

<label class="font-ui text-xs text-muted">
	Tri
	<select
		class="ml-2 rounded border border-border bg-panel px-2 py-1 font-ui text-sm"
		{value}
		onchange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as QuoteSort)}
	>
		{#each OPTIONS as [v, label] (v)}
			<option value={v}>{label}</option>
		{/each}
	</select>
</label>
