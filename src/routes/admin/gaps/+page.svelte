<script lang="ts">
	let { data } = $props();

	type Group = {
		label: string;
		ids: number[];
		base: string;
		tone?: 'normal' | 'warn' | 'integrity';
	};
	type Section = { title: string; groups: Group[] };

	const sections: Section[] = $derived([
		{
			title: 'Intégrité des données',
			groups: [
				{ label: 'Quotes auteur inexistant', ids: data.brokenAuthor, base: '/admin/citations', tone: 'integrity' },
				{ label: 'Quotes œuvre inexistante', ids: data.brokenWork, base: '/admin/citations', tone: 'integrity' },
				{ label: 'Quote auteur ≠ œuvre auteur', ids: data.mismatchedQuoteAuthor, base: '/admin/citations', tone: 'integrity' },
				{ label: 'Quotes sans topicIds', ids: data.brokenTopicId, base: '/admin/citations', tone: 'integrity' }
			]
		},
		{
			title: 'Citations à enrichir',
			groups: [
				{ label: 'Sans traduction FR', ids: data.noFr, base: '/admin/citations', tone: 'warn' },
				{ label: 'Sans texte original', ids: data.noOriginal, base: '/admin/citations' },
				{ label: 'Sans référence', ids: data.noReference, base: '/admin/citations' },
				{ label: 'Sans contexte', ids: data.noContext, base: '/admin/citations' },
				{ label: 'Sans titre étude (œuvre générique)', ids: data.missingStudyTitle, base: '/admin/citations' },
				{ label: 'Sans archive', ids: data.noArchive, base: '/admin/citations' },
				{ label: 'Sans titre court', ids: data.noTitle, base: '/admin/citations' },
				{ label: 'Statut « brouillon »', ids: data.draftStatus, base: '/admin/citations' }
			]
		},
		{
			title: 'Auteurs',
			groups: [
				{ label: 'Auteurs sans bio', ids: data.authorsMissingBio, base: '/admin/auteurs' },
				{ label: 'Auteurs sans dates', ids: data.authorsMissingDates, base: '/admin/auteurs' },
				{ label: 'Auteurs sans citation', ids: data.authorsNoQuotes, base: '/admin/auteurs', tone: 'warn' },
				{ label: 'Auteurs sans œuvre', ids: data.authorsNoWorks, base: '/admin/auteurs' }
			]
		},
		{
			title: 'Œuvres',
			groups: [
				{ label: 'Œuvres sans description', ids: data.worksMissingDescription, base: '/admin/oeuvres' },
				{ label: 'Œuvres sans date de composition', ids: data.worksMissingCompositionDate, base: '/admin/oeuvres' },
				{ label: 'Œuvres sans citation', ids: data.worksNoQuotes, base: '/admin/oeuvres', tone: 'warn' }
			]
		},
		{
			title: 'Sujets',
			groups: [
				{ label: 'Sujets sans description', ids: data.topicsMissingDescription, base: '/admin/sujets' }
			]
		}
	]);

	function toneClass(t: Group['tone']): string {
		switch (t) {
			case 'integrity':
				return 'border-red-300 bg-red-50 hover:border-red-500';
			case 'warn':
				return 'border-amber-300 bg-amber-50 hover:border-amber-500';
			default:
				return 'border-border bg-panel hover:border-accent';
		}
	}
</script>

<h1 class="font-heading text-2xl">Gaps</h1>
<p class="mt-2 text-sm text-muted">
	Cohortes d'éléments incomplets ou incohérents. Clique sur un identifiant pour ouvrir l'élément
	dans son éditeur.
</p>

<div class="mt-6 space-y-10">
	{#each sections as s (s.title)}
		<section>
			<h2 class="font-heading text-lg">{s.title}</h2>
			<div class="mt-3 space-y-4">
				{#each s.groups as g (g.label)}
					<div>
						<h3 class="font-ui text-sm">
							{g.label}
							<span class="ml-1 font-light text-muted">({g.ids.length})</span>
						</h3>
						{#if g.ids.length > 0}
							<ul class="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
								{#each g.ids.slice(0, 300) as id (id)}
									<li>
										<a
											href={`${g.base}#${id}`}
											class={`rounded border px-2 py-0.5 text-xs transition-colors ${toneClass(g.tone)}`}
										>#{id}</a>
									</li>
								{/each}
								{#if g.ids.length > 300}
									<li class="text-xs text-muted">… +{g.ids.length - 300}</li>
								{/if}
							</ul>
						{:else}
							<p class="mt-1 text-xs italic text-emerald-700">✓ Aucun</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
