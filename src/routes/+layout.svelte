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
				<div class="flex items-start gap-3">
					<svg
						class="mt-1 h-10 w-10 flex-shrink-0 text-accent"
						viewBox="0 0 40 40"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
					>
						<!-- Three minimal columns evoking a classical portico. -->
						<rect x="4" y="4" width="32" height="3" stroke-width="1.5" />
						<line x1="6" y1="9" x2="6" y2="32" stroke-width="1.5" />
						<line x1="14" y1="9" x2="14" y2="32" stroke-width="1.5" />
						<line x1="22" y1="9" x2="22" y2="32" stroke-width="1.5" />
						<line x1="30" y1="9" x2="30" y2="32" stroke-width="1.5" />
						<line x1="34" y1="9" x2="34" y2="32" stroke-width="1.5" />
						<rect x="2" y="34" width="36" height="3" stroke-width="1.5" />
					</svg>
					<div class="font-heading text-base uppercase leading-tight tracking-[0.28em] text-accent">
						Pères<br />de l'Église
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
			<!-- Mode toggle · sits between the logo hairline and the section
			     list. Two pill segments: Lecture (read) and Étude (study).
			     Active segment fills with the sage-olive active colour;
			     inactive segments are quiet outlines that read as muted
			     parent-row labels. -->
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
		</aside>

		<main class="min-w-0">
			{@render children()}
		</main>
	</div>
</div>
