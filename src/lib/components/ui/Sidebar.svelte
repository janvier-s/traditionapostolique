<script lang="ts">
	import { page } from '$app/state';
	import { sidebar } from '$lib/stores/sidebar.svelte';
	import { buildPublicTaxonomy, type PublicTaxonomyNode } from '$lib/data';
	import SidebarItem from './SidebarItem.svelte';
	import type { Pillar } from '$lib/schema';

	const taxonomy = buildPublicTaxonomy();
	const PILLARS: { value: Pillar; label: string }[] = [
		{ value: 'dieu', label: 'Dieu, Trinité, Christ' },
		{ value: 'eglise', label: "L'Église et ses sources" },
		{ value: 'saints', label: 'Marie, les saints, miracles' },
		{ value: 'sacrements', label: 'Sacrements et liturgie' },
		{ value: 'vie', label: 'Vie chrétienne et prière' },
		{ value: 'fin', label: 'Les fins dernières' }
	];

	// Flatten all topic refs from a node tree for sidebar display + filtering
	function flattenTopicRefs(
		nodes: PublicTaxonomyNode[]
	): { href: string; label: string; count: number }[] {
		const result: { href: string; label: string; count: number }[] = [];
		for (const n of nodes) {
			if (n.topicRef) {
				result.push({ href: n.topicRef.href, label: n.topicRef.label, count: n.topicRef.count });
			}
			if (n.children.length > 0) {
				result.push(...flattenTopicRefs(n.children));
			}
		}
		return result;
	}

	const columns = PILLARS.map((p) => ({ ...p, items: flattenTopicRefs(taxonomy[p.value]) }));

	const filtered = $derived.by(() => {
		const f = sidebar.filter.trim().toLowerCase();
		if (!f) return columns;
		return columns
			.map((col) => ({
				...col,
				items: col.items.filter((t) => t.label.toLowerCase().includes(f))
			}))
			.filter((col) => col.items.length > 0);
	});

	const currentPath = $derived(page.url.pathname);
</script>

{#if sidebar.open}
	<aside
		aria-label="Plan des sujets"
		class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-panel font-ui text-sm md:block"
	>
		<div class="sticky top-0 z-10 border-b border-border bg-panel p-3">
			<input
				type="search"
				placeholder="Filtrer les sujets…"
				value={sidebar.filter}
				oninput={(e) => (sidebar.filter = e.currentTarget.value)}
				aria-label="Filtrer les sujets"
				class="w-full rounded border border-border bg-background px-2 py-1 font-ui text-sm focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			/>
		</div>
		<nav class="p-2">
			{#each filtered as col (col.value)}
				<details open class="mb-2">
					<summary
						class="cursor-pointer rounded px-2 py-1 font-ui font-medium text-foreground hover:bg-subtle/10"
					>
						{col.label}
					</summary>
					<ul class="ml-3 mt-1 space-y-0.5">
						{#each col.items as t (t.href)}
							<SidebarItem
								href={t.href}
								label={t.label}
								count={t.count}
								active={currentPath === t.href}
							/>
						{/each}
					</ul>
				</details>
			{/each}
			{#if filtered.length === 0}
				<p class="px-2 py-3 font-ui text-sm text-muted">Aucun sujet ne correspond.</p>
			{/if}
		</nav>
	</aside>
{/if}
