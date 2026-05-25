<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { buildPublicTreeNested, topicBySlug } from '$lib/data';
	import JsonLd from '$lib/components/ui/JsonLd.svelte';

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

	const tree = buildPublicTreeNested();

	// Derive the active topic from the URL. Used both to highlight the
	// current item in the rail and to auto-expand its parent pillar/theme.
	const activeSlug = $derived.by(() => {
		const m = page.url.pathname.match(/^\/sujets\/([^/]+)$/);
		return m ? m[1] : null;
	});
	const activeTopic = $derived(activeSlug ? topicBySlug(activeSlug) : null);
	const activePillar = $derived(activeTopic?.pillar ?? null);
	// Active theme = the parent topic when the active topic is an aspect
	const activeThemeId = $derived(activeTopic?.parentId ?? null);

	// Explicit user toggle state. presence = explicit choice (true/false);
	// absence = auto (follow active pillar / theme). This lets the user close
	// the currently-active pillar — which was impossible with the old Set model
	// where activePillar always overrode manual state.
	let pillarToggles = $state<Map<string, boolean>>(new Map());
	let themeToggles = $state<Map<number, boolean>>(new Map());

	function isPillarOpen(pillar: string): boolean {
		const explicit = pillarToggles.get(pillar);
		if (explicit !== undefined) return explicit;
		return pillar === activePillar;
	}

	function togglePillar(pillar: string) {
		const cur = isPillarOpen(pillar);
		const m = new Map(pillarToggles);
		m.set(pillar, !cur);
		pillarToggles = m;
	}

	function isThemeOpen(themeId: number): boolean {
		const explicit = themeToggles.get(themeId);
		if (explicit !== undefined) return explicit;
		return themeId === activeThemeId;
	}

	function toggleTheme(themeId: number) {
		const cur = isThemeOpen(themeId);
		const m = new Map(themeToggles);
		m.set(themeId, !cur);
		themeToggles = m;
	}
</script>

<JsonLd data={websiteSchema} />

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
						class="h-20 flex-shrink-0 bg-accent"
						style="width:3.3rem;mask:url(/logo.svg) center/contain no-repeat;-webkit-mask:url(/logo.svg) center/contain no-repeat"
						aria-hidden="true"
					></div>
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
						{#each tree as col (col.pillar)}
							{@const pillarOpen = isPillarOpen(col.pillar)}
							{@const hasActiveChild = col.pillar === activePillar}
							<li>
								<button
									type="button"
									onclick={() => togglePillar(col.pillar)}
									aria-expanded={pillarOpen}
									aria-controls={`pillar-${col.pillar}-children`}
									class="flex w-full items-baseline justify-between gap-2 py-[9px] text-left uppercase transition-colors hover:text-accent"
									class:text-accent={hasActiveChild}
									class:font-medium={hasActiveChild}
									style="font-size: 1em; line-height: 1.25em; letter-spacing: 0.05em;"
								>
									<span>{col.label}</span>
									<span aria-hidden="true" class="font-heading text-[22px] leading-none"
										>{pillarOpen ? '−' : '+'}</span
									>
								</button>

								{#if pillarOpen}
									<ul
										id={`pillar-${col.pillar}-children`}
										class="mb-2 border-l border-foreground/15 pl-4 normal-case tracking-normal"
										style="font-size: 0.9em;"
									>
										{#each col.topics as t (t.id)}
											<li class="relative">
												{#if t.isTheme && t.children}
													{@const themeOpen = isThemeOpen(t.id)}
													{@const themeActive =
														t.id === activeTopic?.id || t.id === activeThemeId}
													<!-- Theme row: label is a real link, +/- is an independent button -->
													<div class="flex items-baseline gap-2 py-[7px]">
														{#if themeActive}
															<!-- Guillemet · oxblood › sits in the rail's
															     left gutter as a directional marker.
															     Optical alignment: nudged up 2px from
															     true center since the › glyph's visual
															     mass sits below its em-box midline. -->
															<span
																aria-hidden="true"
																class="absolute text-accent leading-none"
																style="font-size: 22px; right: calc(100% + 4px); top: calc(50% - 1px); transform: translateY(-50%);"
																>›</span
															>
														{/if}
														<a
															href={t.href}
															class="grow transition-colors hover:text-accent"
															class:text-accent={themeActive}
															class:font-medium={themeActive}
														>
															{t.label}
														</a>
														<button
															type="button"
															onclick={() => toggleTheme(t.id)}
															aria-expanded={themeOpen}
															aria-controls={`theme-${t.id}-children`}
															aria-label={`${themeOpen ? 'Fermer' : 'Ouvrir'} ${t.label}`}
															class="shrink-0 transition-colors hover:text-accent"
														>
															<span
																aria-hidden="true"
																class="font-heading text-[18px] leading-none"
																>{themeOpen ? '−' : '+'}</span
															>
														</button>
													</div>

													{#if themeOpen}
														<ul
															id={`theme-${t.id}-children`}
															class="mt-0.5 mb-1 border-l border-foreground/15 pl-3"
															style="font-size: 0.95em;"
														>
															{#each t.children as child (child.id)}
																{@const isActive = child.slug === activeSlug}
																<li class="relative">
																	{#if isActive}
																		<span
																			aria-hidden="true"
																			class="absolute text-accent leading-none"
																			style="font-size: 22px; right: calc(100% + 4px); top: calc(50% - 1px); transform: translateY(-50%);"
																			>›</span
																		>
																	{/if}
																	<a
																		href={child.href}
																		class="block py-[5px] transition-colors hover:text-accent"
																		class:text-accent={isActive}
																		class:font-medium={isActive}
																	>
																		{child.label}
																	</a>
																</li>
															{/each}
														</ul>
													{/if}
												{:else}
													{@const isActive = t.slug === activeSlug}
													{#if isActive}
														<span
															aria-hidden="true"
															class="absolute text-accent leading-none"
															style="font-size: 22px; right: calc(100% + 4px); top: calc(50% - 1px); transform: translateY(-50%);"
															>›</span
														>
													{/if}
													<a
														href={t.href}
														class="block py-[7px] transition-colors hover:text-accent"
														class:text-accent={isActive}
														class:font-medium={isActive}
													>
														{t.label}
													</a>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</li>
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
