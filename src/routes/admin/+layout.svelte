<script lang="ts">
	let { children } = $props();
</script>

<div class="px-6 py-6">
	<nav class="mb-6 flex gap-4 border-b border-border pb-2 font-ui text-sm">
		<a href="/admin">Accueil</a>
		<a href="/admin/auteurs">Auteurs</a>
		<a href="/admin/oeuvres">Œuvres</a>
		<a href="/admin/sujets">Sujets</a>
		<a href="/admin/hierarchie">Hiérarchie</a>
		<a href="/admin/taxonomy">Taxonomie</a>
		<a href="/admin/citations">Citations</a>
		<a href="/admin/bercot">Bercot</a>
		<a href="/admin/gaps">Gaps</a>
	</nav>
	{@render children()}
</div>
