<script lang="ts">
	let {
		href,
		label,
		count,
		active = false
	}: { href: string; label: string; count?: number; active?: boolean } = $props();
</script>

<li>
	<a
		{href}
		aria-current={active ? 'page' : undefined}
		class="flex items-center justify-between gap-2 rounded border-l-2 px-2 py-1 font-ui text-sm hover:bg-subtle/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		class:border-accent={active}
		class:border-transparent={!active}
		class:bg-accent={active}
		class:bg-opacity-10={active}
		class:text-accent-text={active}
		class:font-medium={active}
		class:text-foreground={!active}
	>
		<span class="truncate">{label}</span>
		{#if typeof count === 'number'}
			<span class="shrink-0 rounded bg-subtle/20 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
				{count}
			</span>
		{/if}
	</a>
</li>
