<script lang="ts">
	import { sidebar, toggleSidebar } from '$lib/stores/sidebar.svelte';
</script>

<button
	type="button"
	onclick={toggleSidebar}
	aria-label="Afficher ou masquer le plan des sujets"
	aria-pressed={sidebar.open}
	title="Plan des sujets"
	class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel font-ui text-muted hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<line x1="2.5" y1="4" x2="13.5" y2="4" />
		<line x1="2.5" y1="8" x2="13.5" y2="8" />
		<line x1="2.5" y1="12" x2="13.5" y2="12" />
	</svg>
</button>
