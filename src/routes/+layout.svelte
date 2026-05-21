<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground font-body">
	<header class="border-b border-border px-6 py-4">
		<a href="/" class="font-heading text-xl">Pères de l'Église</a>
	</header>
	<main>
		{@render children()}
	</main>
</div>
