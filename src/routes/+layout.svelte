<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { buildTopicTree, topicBySlug } from '$lib/data';
	import type { Section } from '$lib/schema';
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

	const tree = buildTopicTree();

	// Derive the active topic from the URL. Used both to highlight the
	// current item in the rail and to auto-expand its parent section.
	const activeSlug = $derived.by(() => {
		const m = page.url.pathname.match(/^\/sujets\/([^/]+)$/);
		return m ? m[1] : null;
	});
	const activeTopic = $derived(activeSlug ? topicBySlug(activeSlug) : null);
	const activeSection = $derived(activeTopic?.section ?? null);

	// Manually toggled accordion state. A section is considered open if
	// it's either in `manuallyOpen` OR it contains the current active
	// topic. We do not write the active section into `manuallyOpen`
	// because we want the auto-open behaviour to track URL changes (e.g.
	// after navigating between topics) without leaving stale opens behind.
	let manuallyOpen = $state<Set<Section>>(new Set());

	function toggleSection(section: Section) {
		const next = new Set(manuallyOpen);
		if (next.has(section)) next.delete(section);
		else next.add(section);
		manuallyOpen = next;
	}

	function isOpen(section: Section): boolean {
		return manuallyOpen.has(section) || section === activeSection;
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
						{#each tree as s (s.section)}
							{@const open = isOpen(s.section)}
							{@const hasActiveChild = s.section === activeSection}
							<li>
								<button
									type="button"
									onclick={() => toggleSection(s.section)}
									aria-expanded={open}
									aria-controls={`section-${s.section}-children`}
									class="flex w-full items-baseline justify-between gap-2 py-[9px] text-left uppercase transition-colors hover:text-accent"
									class:text-accent={hasActiveChild}
									class:font-medium={hasActiveChild}
									style="font-size: 1em; line-height: 1.25em; letter-spacing: 0.05em;"
								>
									<span>{s.groupe}</span>
									<span aria-hidden="true" class="font-heading text-[22px] leading-none"
										>{open ? '−' : '+'}</span
									>
								</button>

								{#if open}
									<ul
										id={`section-${s.section}-children`}
										class="mb-2 border-l border-foreground/15 pl-4 normal-case tracking-normal"
										style="font-size: 0.9em;"
									>
										{#each s.topics as t (t.id)}
											{@const isActive = t.slug === activeSlug}
											<li class="relative">
												{#if isActive}
													<!-- Guillemet · oxblood › sits in the rail's
												     left gutter as a directional "you are
												     reading this" marker. Native French
												     typography, lighter than a fleuron.
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
													class="block py-[7px] transition-colors hover:text-accent"
													class:text-accent={isActive}
													class:font-medium={isActive}
												>
													{t.label}
												</a>
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
