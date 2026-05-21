<script lang="ts">
	let {
		section,
		groupe,
		count,
		href
	}: { section: string; groupe: string; count: number; href: string } = $props();
</script>

<a
	{href}
	class="block rounded-lg border border-border bg-panel p-4 transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
>
	<div class="font-ui text-xs uppercase tracking-widest text-muted">Section {section}</div>
	<div class="mt-1 font-heading text-xl text-heading">{groupe}</div>
	<div class="mt-2 font-ui text-sm text-muted">{count} sujets</div>
</a>
