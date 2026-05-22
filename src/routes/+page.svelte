<script lang="ts">
	import { buildTopicTree, quotes } from '$lib/data';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';

	const tree = buildTopicTree();
	const totalTopics = tree.reduce((n, s) => n + s.topics.length, 0);
	const totalQuotes = quotes.length;
</script>

<MetaTags title="Accueil" description="Anthologie patristique française organisée par sujets." />

<article>
	<h1
		class="font-heading italic text-accent text-[clamp(2.5rem,5vw,4rem)] leading-[1.05]"
	>
		Anthologie patristique
	</h1>

	<p class="mt-8 max-w-prose font-body text-base leading-[1.75] text-foreground">
		Une lecture des Pères de l'Église organisée non par auteur ni par siècle, mais par sujet · ce
		qu'ils ont enseigné sur la prière, sur Marie, sur l'Eucharistie, sur l'Église. {totalQuotes.toLocaleString(
			'fr-FR'
		)} citations rassemblées sous {totalTopics} sujets.
	</p>

	<p class="mt-10 font-ui text-xs uppercase tracking-[0.22em] text-muted">
		Choisissez un sujet dans le sommaire à gauche.
	</p>
</article>
