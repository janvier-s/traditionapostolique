<script lang="ts">
	import { eraLabel } from '$lib/utils/era';
	import type { Era } from '$lib/schema';
	let { era }: { era: Era } = $props();
</script>

<span
	class="rounded border border-border bg-subtle/10 px-1.5 py-0.5 font-ui text-[10px] uppercase tracking-wider text-muted"
>
	{eraLabel(era)}
</span>
