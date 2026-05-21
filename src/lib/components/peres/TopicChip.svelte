<script lang="ts">
	let { topic }: { topic: { slug: string; label: string } } = $props();
</script>

<a
	href={`/sujets/${topic.slug}`}
	class="rounded-full border border-border bg-panel px-2 py-0.5 font-ui text-xs text-muted hover:border-accent hover:text-foreground"
>
	{topic.label}
</a>
