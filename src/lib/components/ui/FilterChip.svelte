<script lang="ts">
	let { label, active, onToggle }: { label: string; active: boolean; onToggle: () => void } = $props();
</script>

<button
	type="button"
	onclick={onToggle}
	class="rounded-full border px-2.5 py-0.5 font-ui text-xs transition"
	class:border-accent={active}
	class:bg-accent={active}
	class:text-accent-text={active}
	class:border-border={!active}
>
	{label}
</button>
