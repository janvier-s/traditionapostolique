<script lang="ts">
	import { mode, setMode } from '$lib/stores/mode.svelte';
</script>

<div
	class="inline-flex rounded-full border border-foreground/15 p-[2px] font-ui text-[11px] font-bold uppercase tracking-[0.1em]"
	role="group"
	aria-label="Mode de lecture"
>
	<button
		type="button"
		onclick={() => setMode('read')}
		aria-pressed={mode.value === 'read'}
		class="rounded-full px-3 py-1 transition-colors hover:text-accent"
		class:bg-active={mode.value === 'read'}
		class:text-white={mode.value === 'read'}
		class:text-muted={mode.value !== 'read'}
	>
		Lecture
	</button>
	<button
		type="button"
		onclick={() => setMode('study')}
		aria-pressed={mode.value === 'study'}
		class="rounded-full px-3 py-1 transition-colors hover:text-accent"
		class:bg-active={mode.value === 'study'}
		class:text-white={mode.value === 'study'}
		class:text-muted={mode.value !== 'study'}
	>
		Étude
	</button>
</div>
