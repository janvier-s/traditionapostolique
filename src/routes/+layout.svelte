<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';
	import SidebarToggle from '$lib/components/ui/SidebarToggle.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	let { children } = $props();
</script>

<div class="flex min-h-screen bg-background font-body text-foreground">
	<Sidebar />
	<div class="min-w-0 flex-1">
		<header class="flex items-center justify-between border-b border-border px-6 py-3">
			<div class="flex items-center gap-3">
				<SidebarToggle />
				<a href="/" class="font-heading text-lg">Pères de l'Église</a>
			</div>
			<nav class="flex items-center gap-4 font-ui text-sm">
				<a href="/sujets" class="hover:text-accent-text">Sujets</a>
				<a href="/peres" class="hover:text-accent-text">Pères</a>
				<a href="/oeuvres" class="hover:text-accent-text">Œuvres</a>
				<a href="/recherche" class="hover:text-accent-text">Recherche</a>
				<ThemeToggle />
			</nav>
		</header>
		<main>{@render children()}</main>
	</div>
</div>
