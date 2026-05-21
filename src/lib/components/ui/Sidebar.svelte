<script lang="ts">
	import { page } from '$app/state';
	import { sidebar } from '$lib/stores/sidebar.svelte';
	import { buildTopicTree } from '$lib/data';
	import SidebarItem from './SidebarItem.svelte';

	const tree = buildTopicTree();

	const filtered = $derived.by(() => {
		const f = sidebar.filter.trim().toLowerCase();
		if (!f) return tree;
		return tree
			.map((s) => ({
				...s,
				topics: s.topics.filter((t) => t.label.toLowerCase().includes(f))
			}))
			.filter((s) => s.topics.length > 0);
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
			{#each filtered as section (section.section)}
				<details open class="mb-2">
					<summary
						class="cursor-pointer rounded px-2 py-1 font-ui font-medium text-foreground hover:bg-subtle/10"
					>
						<span class="mr-1 text-muted">{section.section}.</span>{section.groupe}
					</summary>
					<ul class="ml-3 mt-1 space-y-0.5">
						{#each section.topics as t (t.id)}
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
