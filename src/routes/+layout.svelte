<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { buildTopicTree, topicBySlug } from '$lib/data';
	import type { Section } from '$lib/schema';
	import { mode, setMode } from '$lib/stores/mode.svelte';

	let { children } = $props();

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

<div class="min-h-screen bg-background font-body text-foreground">
	<div class="grid grid-cols-1 gap-x-12 px-6 py-8 lg:grid-cols-[330px_1fr] lg:gap-x-12 lg:px-12 lg:py-10">
		<aside class="lg:sticky lg:top-10 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto rail-scroll lg:pr-3">
			<!-- Logo · architectural mark + tracked small-caps wordmark. -->
			<a href="/" class="block" aria-label="Accueil">
				<div class="flex items-end gap-3">
					<div
						class="h-20 flex-shrink-0 bg-accent"
						style="width:3.3rem;mask:url(/logo.svg) center/contain no-repeat;-webkit-mask:url(/logo.svg) center/contain no-repeat"
						aria-hidden="true"
					></div>
					<div class="pb-1 font-heading text-base uppercase leading-tight tracking-[0.28em] text-accent">
						Tradition<br />Apostolique
					</div>
				</div>
			</a>

			<!-- Short hairline matching the reference. -->
			<div class="mt-10 mb-6 h-px w-10 bg-border"></div>

			<!--
				Rail nav styled to churchfathers.org's `.navigation`:
				· font-family: Poppins (their Proxima Nova analogue)
				· uppercase, weight 300, letter-spacing .05em
				· each section row has 9px vertical padding
				· hover/active state → sage-olive #bfb68c (--color-active)
				· expanded children get a left hairline border and step
				  down to ~12px (their .folder-child a { font-size: .75em })
			-->
			<!-- Sidebar typography per spec:
			     · whole rail uses Proxima Nova Light (300)
			     · parent (section) labels: font-size 1em, letter-spacing
			       .05em, line-height 1.25em
			     · child (topic) links: font-size .75em
			     The +/− glyph inherits the parent button colour so it
			     tracks the section's hover / active state instead of
			     staying a fixed muted grey. -->
			<!-- Mode toggle · only visible on a topic-detail page
			     (/sujets/<slug>) because that's the only surface where
			     Lecture vs Étude actually changes the rendering. Showing
			     it on the homepage, index, Pères / Œuvres pages would
			     make it look like a global setting that does nothing on
			     those routes. -->
			{#if /^\/sujets\/[^/]+$/.test(page.url.pathname)}
			<div
				class="mb-8 inline-flex rounded-full border border-foreground/15 p-[2px] font-ui text-[11px] font-light uppercase tracking-[0.1em]"
				role="group"
				aria-label="Mode de lecture"
			>
				<button
					type="button"
					onclick={() => setMode('read')}
					aria-pressed={mode.value === 'read'}
					class="rounded-full px-3 py-1 transition-colors hover:text-active"
					class:bg-active={mode.value === 'read'}
					class:text-foreground={mode.value === 'read'}
					class:text-muted={mode.value !== 'read'}
				>
					Lecture
				</button>
				<button
					type="button"
					onclick={() => setMode('study')}
					aria-pressed={mode.value === 'study'}
					class="rounded-full px-3 py-1 transition-colors hover:text-active"
					class:bg-active={mode.value === 'study'}
					class:text-foreground={mode.value === 'study'}
					class:text-muted={mode.value !== 'study'}
				>
					Étude
				</button>
			</div>
			{/if}

			<nav aria-label="Sujets" class="font-ui font-light">
				<ul>
					{#each tree as s (s.section)}
						{@const open = isOpen(s.section)}
						<li>
							<button
								type="button"
								onclick={() => toggleSection(s.section)}
								aria-expanded={open}
								aria-controls={`section-${s.section}-children`}
								class="flex w-full items-baseline justify-between gap-2 py-[9px] text-left uppercase transition-colors hover:text-active"
								class:text-active={open}
								style="font-size: 1em; line-height: 1.25em; letter-spacing: 0.05em;"
							>
								<span>{s.groupe}</span>
								<span
									aria-hidden="true"
									class="font-heading text-[22px] leading-none"
								>{open ? '−' : '+'}</span>
							</button>

							{#if open}
								<ul
									id={`section-${s.section}-children`}
									class="mb-2 border-l border-foreground/15 pl-4 normal-case tracking-normal"
									style="font-size: 0.9em;"
								>
									{#each s.topics as t (t.id)}
										{@const isActive = t.slug === activeSlug}
										<li>
											<a
												href={t.href}
												class="block py-[7px] transition-colors hover:text-active"
												class:text-active={isActive}
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

			<!-- Secondary indices · alternative entry points into the
			     corpus. Kept visually quieter than the section list so the
			     rail still reads as primarily a topic browser. -->
			<div class="mt-8 mb-6 h-px w-10 bg-border"></div>
			<ul class="font-ui font-light" style="font-size: 0.9em; line-height: 1.25em;">
				<li>
					<a
						href="/peres"
						class="block py-[7px] uppercase tracking-[0.05em] transition-colors hover:text-active"
						class:text-active={page.url.pathname.startsWith('/peres')}
					>
						Pères
					</a>
				</li>
				<li>
					<a
						href="/oeuvres"
						class="block py-[7px] uppercase tracking-[0.05em] transition-colors hover:text-active"
						class:text-active={page.url.pathname.startsWith('/oeuvres')}
					>
						Œuvres
					</a>
				</li>
			</ul>
		</aside>

		<main class="min-w-0">
			{@render children()}
		</main>
	</div>
</div>
