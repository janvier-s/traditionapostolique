<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { buildPublicTaxonomy, type PublicTaxonomyNode } from '$lib/data';
	import JsonLd from '$lib/components/ui/JsonLd.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import type { Pillar } from '$lib/schema';

	let { children } = $props();

	const SITE_URL = 'https://traditionapostolique.fr';
	// Site-wide WebSite + SearchAction · enables Google's sitelinks
	// searchbox and registers the site name canonically across all routes.
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Tradition Apostolique',
		alternateName: 'Tradition Apostolique · anthologie patristique',
		url: SITE_URL,
		inLanguage: 'fr-FR',
		description: "Anthologie française du témoignage des Pères de l'Église, sujet par sujet.",
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${SITE_URL}/recherche?q={search_term_string}`
			},
			'query-input': 'required name=search_term_string'
		}
	};

	const taxonomy = buildPublicTaxonomy();
	const PILLARS: { value: Pillar; label: string }[] = [
		{ value: 'dieu', label: 'Dieu, Trinité, Christ' },
		{ value: 'eglise', label: "L'Église et ses sources" },
		{ value: 'saints', label: 'Marie, les saints, miracles' },
		{ value: 'sacrements', label: 'Sacrements et liturgie' },
		{ value: 'vie', label: 'Vie chrétienne et prière' },
		{ value: 'fin', label: 'Les fins dernières' }
	];

	// Derive the active topic slug from the URL.
	const activeSlug = $derived.by(() => {
		const m = page.url.pathname.match(/^\/sujets\/([^/]+)$/);
		return m ? m[1] : null;
	});

	// Explicit user toggle state. Presence = explicit choice; absence = default closed.
	const pillarToggles = new SvelteMap<string, boolean>();
	const umbrellaToggles = new SvelteMap<string, boolean>();

	function isPillarOpen(p: string): boolean {
		const e = pillarToggles.get(p);
		return e === undefined ? false : e;
	}
	function togglePillar(p: string) {
		pillarToggles.set(p, !isPillarOpen(p));
	}
	function isUmbrellaOpen(id: string): boolean {
		const e = umbrellaToggles.get(id);
		return e === undefined ? false : e;
	}
	function toggleUmbrella(id: string) {
		umbrellaToggles.set(id, !isUmbrellaOpen(id));
	}
	function openUmbrella(id: string) {
		if (umbrellaToggles.get(id) === true) return;
		umbrellaToggles.set(id, true);
	}

	// Hide nav entries with zero quotes attached: empty topic-refs are
	// dropped entirely; umbrellas whose descendants are all empty are
	// dropped too (otherwise expanding reveals nothing).
	function hasContent(n: PublicTaxonomyNode): boolean {
		if (n.topicRef) return n.topicRef.count > 0;
		return n.children.some(hasContent);
	}
</script>

<JsonLd data={websiteSchema} />

<ThemeToggle
	class="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center text-[1.5rem] text-accent transition-colors hover:text-foreground"
/>

<div class="min-h-screen bg-background font-body text-foreground">
	<div
		class="grid grid-cols-1 gap-x-4 px-6 py-8 lg:grid-cols-[330px_1fr] lg:px-12 lg:py-10"
		class:lg:gap-x-16={page.url.pathname === '/'}
		class:lg:gap-x-4={page.url.pathname !== '/'}
	>
		<aside
			class="lg:sticky lg:top-10 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:pr-3 lg:flex lg:flex-col"
		>
			<!-- Logo · architectural mark + tracked small-caps wordmark. -->
			<a href="/" class="block" aria-label="Tradition Apostolique · Accueil">
				<div class="flex items-end gap-3">
					<div
						class="dark:hidden h-20 flex-shrink-0 bg-accent"
						style="width:3.3rem;mask:url(/logo.svg) center/contain no-repeat;-webkit-mask:url(/logo.svg) center/contain no-repeat"
						aria-hidden="true"
					></div>
					<img
						src="/logo-dark.png"
						alt=""
						aria-hidden="true"
						class="hidden dark:block h-20 w-auto"
					/>
					<div
						class="pb-1 font-heading text-base uppercase leading-tight tracking-[0.28em] text-accent"
					>
						Tradition<br />Apostolique
					</div>
				</div>
			</a>

			<!-- Secondary indices · alternative entry points into the
			     corpus. Sits ABOVE the scrollable region so it stays
			     anchored when the topic accordion scrolls. The hairline
			     below is full-width of the rail (not the w-10 short rule)
			     so it reads as a section divider rather than an underline
			     attached to "Pères". -->
			<nav
				aria-label="Index alternatifs"
				class="mt-10 flex items-baseline gap-3 font-ui font-light flex-shrink-0"
				style="font-size: 0.9em; line-height: 1.25em;"
			>
				<a
					href="/peres"
					class="py-[7px] uppercase tracking-[0.05em] transition-colors hover:text-accent"
					class:text-accent={page.url.pathname.startsWith('/peres')}
					class:font-medium={page.url.pathname.startsWith('/peres')}
				>
					Pères
				</a>
				<span aria-hidden="true">·</span>
				<a
					href="/oeuvres"
					class="py-[7px] uppercase tracking-[0.05em] transition-colors hover:text-accent"
					class:text-accent={page.url.pathname.startsWith('/oeuvres')}
					class:font-medium={page.url.pathname.startsWith('/oeuvres')}
				>
					Œuvres
				</a>
				<span aria-hidden="true">·</span>
				<a
					href="/sujets"
					class="py-[7px] uppercase tracking-[0.05em] transition-colors hover:text-accent"
					class:text-accent={page.url.pathname === '/sujets'}
					class:font-medium={page.url.pathname === '/sujets'}
				>
					Sujets
				</a>
			</nav>

			<div class="mt-2 mb-4 h-px w-full bg-border flex-shrink-0"></div>

			<div class="lg:min-h-0 lg:flex-1 lg:overflow-y-auto rail-scroll">
				<!--
				Rail nav styled to churchfathers.org's `.navigation`:
				· font-family: Poppins (their Proxima Nova analogue)
				· uppercase, weight 300, letter-spacing .05em
				· each section row has 9px vertical padding
				· active state → oxblood accent + medium weight (color
				  alone is too quiet at body-text size)
				· expanded children get a left hairline border and step
				  down to ~12px (their .folder-child a { font-size: .75em })
			-->
				<nav aria-label="Sujets" class="font-ui font-light">
					<ul>
						{#each PILLARS as p (p.value)}
							{@const visibleNodes = (taxonomy[p.value] ?? []).filter(hasContent)}
							{@const pillarOpen = isPillarOpen(p.value)}
							{#if visibleNodes.length > 0}
								<li>
									<button
										type="button"
										onclick={() => togglePillar(p.value)}
										aria-expanded={pillarOpen}
										class="flex w-full items-baseline justify-between gap-2 py-[9px] text-left uppercase transition-colors hover:text-accent"
										style="font-size: 1em; line-height: 1.25em; letter-spacing: 0.05em;"
									>
										<span>{p.label}</span>
										<span aria-hidden="true" class="font-heading text-[22px] leading-none"
											>{pillarOpen ? '−' : '+'}</span
										>
									</button>
									{#if pillarOpen}
										<ul
											class="mb-2 border-l border-foreground/15 pl-4 normal-case tracking-normal"
											style="font-size: 0.9em;"
										>
											{#each visibleNodes as n (n.id)}
												{@render renderNode(n)}
											{/each}
										</ul>
									{/if}
								</li>
							{/if}
						{/each}
					</ul>
				</nav>
			</div>
		</aside>

		<main class="min-w-0">
			{@render children()}
		</main>
	</div>

	<footer class="border-t border-border mt-16 px-6 py-8 lg:px-12">
		<nav aria-label="Pied de page" class="flex flex-wrap items-baseline gap-x-6 gap-y-2 label-meta">
			<a href="/" class="hover:text-accent hover:underline underline-offset-4">Accueil</a>
			<a href="/sujets" class="hover:text-accent hover:underline underline-offset-4">Sujets</a>
			<a href="/peres" class="hover:text-accent hover:underline underline-offset-4">Pères</a>
			<a href="/oeuvres" class="hover:text-accent hover:underline underline-offset-4">Œuvres</a>
			<a href="/recherche" class="hover:text-accent hover:underline underline-offset-4">Recherche</a
			>
			<a href="/a-propos" class="hover:text-accent hover:underline underline-offset-4">À propos</a>
			<a href="/mentions-legales" class="hover:text-accent hover:underline underline-offset-4"
				>Mentions légales</a
			>
		</nav>
		<p class="mt-4 label-meta">Tradition Apostolique &middot; anthologie patristique</p>
	</footer>
</div>

{#snippet renderNode(n: PublicTaxonomyNode)}
	{#if hasContent(n)}
		<li class="relative">
			{#if n.umbrella}
				{@const open = isUmbrellaOpen(n.id)}
				{@const visibleChildren = n.children.filter(hasContent)}
				<div class="flex items-baseline gap-2 py-[7px]">
					{#if n.umbrella.primaryHref}
						<a
							href={n.umbrella.primaryHref}
							onclick={() => openUmbrella(n.id)}
							class="grow transition-colors hover:text-accent">{n.umbrella.label}</a
						>
					{:else}
						<button
							type="button"
							onclick={() => toggleUmbrella(n.id)}
							class="grow text-left transition-colors hover:text-accent">{n.umbrella.label}</button
						>
					{/if}
					{#if visibleChildren.length > 0}
						<button
							type="button"
							onclick={() => toggleUmbrella(n.id)}
							aria-expanded={open}
							aria-label={`${open ? 'Fermer' : 'Ouvrir'} ${n.umbrella.label}`}
							class="shrink-0 transition-colors hover:text-accent"
						>
							<span aria-hidden="true" class="font-heading text-[18px] leading-none"
								>{open ? '−' : '+'}</span
							>
						</button>
					{/if}
				</div>
				{#if open && visibleChildren.length > 0}
					<ul class="border-l border-foreground/15 pl-3 mt-0.5 mb-1" style="font-size: 0.95em;">
						{#each visibleChildren as c (c.id)}
							{@render renderNode(c)}
						{/each}
					</ul>
				{/if}
			{:else if n.topicRef}
				{@const isActive = n.topicRef.slug === activeSlug}
				<a
					href={n.topicRef.href}
					class="block py-[5px] transition-colors hover:text-accent"
					class:text-accent={isActive}
					class:font-medium={isActive}>{n.topicRef.label}</a
				>
			{/if}
		</li>
	{/if}
{/snippet}
