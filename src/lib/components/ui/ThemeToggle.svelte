<script lang="ts">
	import { theme, cycleTheme } from '$lib/stores/theme.svelte';
	const LABEL: Record<string, string> = {
		light: 'Clair',
		sepia: 'Sépia',
		dark: 'Sombre',
		amoled: 'AMOLED'
	};
</script>

<button
	type="button"
	onclick={cycleTheme}
	class="rounded border border-border bg-panel px-3 py-1 font-ui text-sm hover:bg-subtle/10"
	aria-label="Changer de thème"
>
	{LABEL[theme.value]}
</button>
