<script lang="ts">
	import '../app.css';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground font-body">
	<header class="flex items-center justify-between border-b border-border px-6 py-4">
		<a href="/" class="font-heading text-xl">Pères de l'Église</a>
		<ThemeToggle />
	</header>
	<main>
		{@render children()}
	</main>
</div>
