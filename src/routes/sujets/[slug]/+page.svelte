<script lang="ts">
	import { onMount } from 'svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import { authorById, workById, topicById } from '$lib/data';
	import { renderFr, escapeHtml } from '$lib/utils/render-fr';
	import { inlineCitation } from '$lib/utils/format-citation';
	import { looksLikeMigne, parseMigne } from '$lib/utils/migne';
	import type { Quote, Era, Author } from '$lib/schema';
	import { eraOrder, eraLabel, eraLabelSingular } from '$lib/utils/era';
	import { mode } from '$lib/stores/mode.svelte';
	import ModeToggle from '$lib/components/ui/ModeToggle.svelte';
	import { fitHeading } from '$lib/utils/fit-heading';
	import QuotePanelAside from '$lib/components/ui/QuotePanelAside.svelte';
	import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';
	import JsonLd from '$lib/components/ui/JsonLd.svelte';
	import {
		ROMAN_NUMERALS,
		ordinalSuffix,
		latestYear,
		centuryNumber,
		centuryLabel
	} from '$lib/utils/century';

	let { data } = $props();

	// Insert a single line break before the first short connector word
	// ("de", "d'") so names like "Augustin d'Hippone" wrap as
	// "Augustin / d'Hippone" in the narrow marginal column. Skipped for
	// councils ("Concile de Carthage de 397") because repeated breaks on
	// "de" would shred a name that reads better on one or two lines and
	// would let the surrounding year fall off on its own.
	function breakName(name: string): string {
		// The output is injected via `{@html}`, so every text segment has
		// to be HTML-escaped before we splice in `<br/>` markers · today
		// the data is hand-curated and safe, but a future import could
		// otherwise become an injection vector.
		if (/^Concile/i.test(name)) return escapeHtml(name);
		const parts = name.split(' ').map(escapeHtml);
		for (let i = 1; i < parts.length; i++) {
			const w = parts[i];
			if (!w) continue;
			if (w.replace(/['’]|&#39;/g, '').length <= 2) {
				parts[i] = `<br/>${w}`;
				break;
			}
		}
		return parts.join(' ');
	}

	// Group quotes by author so each author/source gets a single marginal
	// header (cf. churchfathers.org), with all of that author's quotes
	// flowing alongside in the right column. Within each group, quotes
	// keep their data order. Groups are sorted chronologically by the
	// author's latest dated year.
	type Group = {
		authorId: number;
		author: NonNullable<ReturnType<typeof authorById>>;
		quotes: Quote[];
	};

	// Study-mode century filter. Empty Set = "no filter, show everything";
	// otherwise show only authors whose century is in the set.
	let centuryFilter = $state<Set<number>>(new Set());

	function authorCentury(a: Author): number {
		return centuryNumber(a.dates) ?? 0;
	}

	function toggleCentury(c: number) {
		const next = new Set(centuryFilter);
		if (next.has(c)) next.delete(c);
		else next.add(c);
		centuryFilter = next;
	}

	function clearCenturyFilter() {
		centuryFilter = new Set();
	}

	// Sort options for the Study filter bar. Default chronological-asc
	// gives the reader patristic time-flow (apostolic → medieval); the
	// other two are common scholarly reorderings.
	type SortKey = 'chrono-asc' | 'chrono-desc' | 'author-az';
	let sortBy = $state<SortKey>('chrono-asc');
	const SORT_OPTIONS: { value: SortKey; label: string }[] = [
		{ value: 'chrono-asc', label: 'Chronologique ↑' },
		{ value: 'chrono-desc', label: 'Chronologique ↓' },
		{ value: 'author-az', label: 'Auteur (A–Z)' }
	];

	// Available centuries for the filter bar · only show chips for
	// centuries that actually appear on this topic's authors.
	const centuriesOnPage = $derived.by<number[]>(() => {
		const seen = new Set<number>();
		for (const q of data.matching) {
			const a = authorById(q.authorId);
			if (!a) continue;
			const c = authorCentury(a);
			if (c > 0) seen.add(c);
		}
		return [...seen].sort((x, y) => x - y);
	});

	const groups = $derived.by<Group[]>(() => {
		const byAuthor = new Map<number, Group>();
		const activeCenturyFilter = mode.value === 'study' && centuryFilter.size > 0 ? centuryFilter : null;
		for (const q of data.matching) {
			const a = authorById(q.authorId);
			if (!a) continue;
			if (activeCenturyFilter && !activeCenturyFilter.has(authorCentury(a))) continue;
			let g = byAuthor.get(a.id);
			if (!g) {
				g = { authorId: a.id, author: a, quotes: [] };
				byAuthor.set(a.id, g);
			}
			g.quotes.push(q);
		}
		const arr = [...byAuthor.values()];
		// In Read mode the sort is fixed chronological-asc to keep the page
		// quiet and predictable. The Study sort selector only affects
		// `mode.value === 'study'`.
		const activeSort: SortKey = mode.value === 'study' ? sortBy : 'chrono-asc';
		if (activeSort === 'author-az') {
			arr.sort((x, y) => x.author.name.localeCompare(y.author.name, 'fr'));
		} else {
			const dir = activeSort === 'chrono-desc' ? -1 : 1;
			arr.sort((x, y) => dir * ((latestYear(x.author.dates) ?? 9999) - (latestYear(y.author.dates) ?? 9999)));
		}
		return arr;
	});

	const totalShown = $derived(groups.reduce((n, g) => n + g.quotes.length, 0));

	// Study-mode "Plus d'info" panel state. `openQuote` drives both the
	// panel's visibility and its content. When set, the page layout
	// splits into a two-column grid · the quotes column on the left,
	// the panel on the right · pushing rather than overlaying (cf.
	// catechismecatholique.com).
	let openQuote = $state<Quote | null>(null);

	// Topic-level panel · shares the right-column slot with the quote
	// panel. Opening one closes the other (only one can be visible at
	// once · they fight for the same physical space).
	type TopicTab = 'presentation' | 'auteurs' | 'migne';
	let topicPanelOpen = $state(false);
	let topicActiveTab = $state<TopicTab>('presentation');
	const TOPIC_TABS: { id: TopicTab; label: string }[] = [
		{ id: 'presentation', label: 'Présentation' },
		{ id: 'auteurs', label: 'Auteurs' },
		{ id: 'migne', label: 'Migne' }
	];

	function openPanel(q: Quote) {
		openQuote = q;
		topicPanelOpen = false;
		// Reflect the open quote in the URL hash so the panel state is
		// linkable and shareable. `replaceState` keeps the back-button
		// behaviour quiet · we don't want every open to add a history entry.
		if (typeof history !== 'undefined') {
			history.replaceState(null, '', `#q-${q.id}`);
		}
	}
	function closePanel() {
		openQuote = null;
		if (typeof history !== 'undefined') {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}
	}
	function openTopicPanel() {
		topicPanelOpen = true;
		topicActiveTab = 'presentation';
		openQuote = null;
		if (typeof history !== 'undefined') {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}
	}
	function closeTopicPanel() {
		topicPanelOpen = false;
	}

	const anyPanelOpen = $derived(openQuote !== null || topicPanelOpen);

	// Stats for the topic-level panel · author roster (with quote counts)
	// and the era distribution across the topic's quotes.
	const topicAuthors = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const q of data.matching) counts.set(q.authorId, (counts.get(q.authorId) ?? 0) + 1);
		return [...counts.entries()]
			.map(([id, n]) => ({ author: authorById(id), n }))
			.filter((x): x is { author: Author; n: number } => x.author != null)
			.sort((x, y) => (latestYear(x.author.dates) ?? 9999) - (latestYear(y.author.dates) ?? 9999));
	});

	const topicEraBreakdown = $derived.by(() => {
		const counts = new Map<Era, number>();
		for (const q of data.matching) {
			const a = authorById(q.authorId);
			if (!a) continue;
			counts.set(a.era, (counts.get(a.era) ?? 0) + 1);
		}
		return eraOrder
			.filter((e) => counts.has(e))
			.map((e) => ({ era: e, n: counts.get(e) ?? 0 }));
	});

	// Migne index for the topic · parse each quote's `migne` field into
	// (series, volume, col), dedupe by exact ref string, and sort by
	// series → volume → column. Each entry remembers which quote IDs use
	// it so the Migne tab can deep-link straight to the relevant quote.
	type MigneRow = {
		ref: string;
		series: 'PG' | 'PL';
		volume: number;
		col: number;
		quoteIds: number[];
	};
	const topicMigneIndex = $derived.by<MigneRow[]>(() => {
		const byRef = new Map<string, MigneRow>();
		for (const q of data.matching) {
			if (!q.migne || !looksLikeMigne(q.migne)) continue;
			const parsed = parseMigne(q.migne);
			if (!parsed) continue;
			const existing = byRef.get(q.migne);
			if (existing) existing.quoteIds.push(q.id);
			else byRef.set(q.migne, { ref: q.migne, ...parsed, quoteIds: [q.id] });
		}
		return [...byRef.values()].sort((a, b) => {
			if (a.series !== b.series) return a.series.localeCompare(b.series);
			if (a.volume !== b.volume) return a.volume - b.volume;
			return a.col - b.col;
		});
	});

	// On mount, if the URL carries a `#q-N` hash, open that quote's
	// panel and scroll the quote into view. `onMount` runs once after
	// initial render, which is exactly when we want this.
	onMount(() => {
		const m = window.location.hash.match(/^#q-(\d+)$/);
		if (!m) return;
		const id = Number(m[1]);
		const q = data.matching.find((x) => x.id === id);
		if (!q) return;
		openQuote = q;
		// Defer the scroll until after the panel has rendered, otherwise
		// the layout is still single-column and the target's final
		// position is wrong.
		requestAnimationFrame(() => {
			document.getElementById(`q-${id}`)?.scrollIntoView({
				block: 'center',
				behavior: 'instant' as ScrollBehavior
			});
		});
	});

	// Close on Escape · matches the prior overlay panel's affordance.
	// Routes to whichever panel is currently open.
	$effect(() => {
		if (!openQuote && !topicPanelOpen) return;
		function onKey(e: KeyboardEvent) {
			if (e.key !== 'Escape') return;
			if (openQuote) closePanel();
			else if (topicPanelOpen) closeTopicPanel();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	const citationOf = (q: Quote) => inlineCitation(q, q.workId ? workById(q.workId) ?? undefined : undefined);
</script>

<MetaTags
	title={data.topic.label}
	separator="d'après la"
	type="article"
	description={data.topic.description ?? `Citations patristiques sur ${data.topic.label}.`}
/>
<JsonLd
	data={{
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: `${data.topic.label} d'après la Tradition Apostolique`,
		description: data.topic.description ?? `Citations patristiques sur ${data.topic.label}.`,
		inLanguage: 'fr-FR',
		isPartOf: { '@type': 'WebSite', name: 'Tradition Apostolique', url: 'https://traditionapostolique.fr' },
		about: { '@type': 'Thing', name: data.topic.label }
	}}
/>

<article
	class={anyPanelOpen
		? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-x-12'
		: ''}
	style={`--author-col: ${anyPanelOpen ? '140px' : '200px'}; --quote-gap: ${anyPanelOpen ? '0px' : '1rem'}; --author-name-size: ${anyPanelOpen ? '20px' : '24px'};`}
>
<div class="min-w-0">
	<!-- Description intentionally omitted · the topic label and the
	     quotes themselves carry the page. Data still carries descriptions
	     for SEO (see MetaTags above) and for resurrection if we change
	     our minds later. The title sits in the right grid column so it
	     left-aligns with the quote paragraphs, not with the source
	     headers · matches the reference. -->
	<header class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<div></div>
		<div>
			<Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Sujets', href: '/sujets' }, { label: data.topic.label }]} />
			<h1
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
			>
				{data.topic.label}
			</h1>
			<!-- Sub-title row · citation count on the left, study-mode
			     "À propos du sujet" trigger on the right. Sits directly
			     under the title so the topic metadata reads as a property
			     of the topic itself. -->
			<div class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<p class="label-meta">
					{totalShown} citation{totalShown > 1 ? 's' : ''}
				</p>
				{#if mode.value === 'study' && !topicPanelOpen}
					<button
						type="button"
						onclick={openTopicPanel}
						aria-expanded={topicPanelOpen}
						class="inline-flex items-baseline gap-2 label-meta-link"
					>
						À propos du sujet
						<span aria-hidden="true">→</span>
					</button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Mode toggle (marginal column) + Siècle filter (main column) on the
	     same row, both bottom-aligned so the toggle baseline meets the
	     'Siècle' label baseline. -->
	<div class="mb-12 grid grid-cols-1 items-baseline gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
		<ModeToggle />

		{#if mode.value === 'study'}
			<div>
			<div
				class="flex flex-wrap items-baseline gap-x-2 gap-y-2 border-b border-border pb-4"
			>
				<span
					class="mr-2 label-meta"
				>Siècle</span>
				{#each centuriesOnPage as c (c)}
					{@const active = centuryFilter.has(c)}
					<button
						type="button"
						onclick={() => toggleCentury(c)}
						aria-pressed={active}
						class="rounded-full border border-foreground/15 px-3 py-[3px] font-ui text-[12px] font-light uppercase tracking-[0.05em] transition-colors hover:border-active"
						class:bg-active={active}
						class:border-active={active}
						class:text-background={active}
						class:text-foreground={!active}
					>
						{ROMAN_NUMERALS[c - 1] ?? c}<span class="lowercase">{ordinalSuffix(c)}</span>
					</button>
				{/each}
				{#if centuryFilter.size > 0}
					<button
						type="button"
						onclick={clearCenturyFilter}
						class="ml-2 label-meta-link"
					>
						Réinitialiser
					</button>
				{/if}

				<!-- Sort selector · pushed to the right of the filter bar. The
				     <select> inherits Proxima Light from the body but we force
				     uppercase tracking via Tailwind classes so it matches the
				     era chips' typographic register. -->
				<!-- When a panel is open the filter column is narrow · pushing
				     Tri to the right with `ml-auto` would force a wrap and
				     leave the row visually unbalanced. Drop the right-push
				     in that case so Tri flows immediately after the era
				     chips / Réinitialiser link. -->
				<label class="flex items-baseline gap-2" class:ml-auto={!anyPanelOpen}>
					<span class="label-meta">Tri</span>
					<select
						bind:value={sortBy}
						class="border-b border-foreground/15 bg-transparent py-[2px] pr-2 font-ui text-[12px] font-light uppercase tracking-[0.05em] text-foreground hover:border-active focus:border-active focus:outline-none"
					>
						{#each SORT_OPTIONS as o (o.value)}
							<option value={o.value}>{o.label}</option>
						{/each}
					</select>
				</label>
			</div>
		</div>
		{/if}
	</div>

	<div class="source-list">
		{#if groups.length === 0}
			<p
				class="grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr] font-body italic text-muted"
			>
				<span></span>
				<span>Aucune citation ne correspond à ces filtres.</span>
			</p>
		{/if}
		{#each groups as g (g.authorId)}
			{@const groupCentury = centuryLabel(g.author.dates)}
			<section aria-label={`Citations de ${g.author.name}`} class="source-block grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]">
				<!-- Marginal source header: small-caps oxblood, the author's
				     name standing in for the source the way "THE PROTO-
				     EVANGELIUM OF JAMES" does in the reference. -->
				<div class="min-w-0">
					<!-- Proper French hyphenation for names that exceed the
					     narrow marginal column (e.g. "ATHA-NASE D'ALEXANDRIE"
					     when the panel is open and `--author-col` is 140px).
					     Relies on `lang="fr"` set on <html>; browsers use
					     French syllable-break rules to insert soft hyphens. -->
					<h2
						use:fitHeading={{ shrunkPx: 20 }}
						class="font-heading uppercase leading-[1.15] tracking-[0.04em] text-accent"
						style="font-size: var(--author-name-size); hyphens: auto;"
					>
						<!-- Author name links to the Père page · everything by
						     this Father across topics. Hover transitions to the
						     sage-olive active colour like the rail nav. -->
						<a href={`/peres/${g.author.slug}`} class="hover:text-active">
							{@html breakName(g.author.name)}
						</a>
					</h2>
					<!-- Author metadata is Study-mode-exclusive. Read mode shows
					     just the name to keep the page quiet. Study mode adds
					     dates, century, and era · matching how a study reader
					     wants to place each father chronologically. -->
					{#if mode.value === 'study'}
						{#if g.author.dates}
							<p class="mt-2 font-ui text-[12px] uppercase tracking-[0.05em] text-muted">
								{g.author.dates}
							</p>
						{/if}
						{#if groupCentury}
							<!-- Render the ordinal suffix ("er", "e") in lowercase
							     even though the parent line is text-transform: uppercase.
							     Otherwise "IVe siècle" becomes "IVE SIÈCLE" which reads
							     as a typographic mistake. -->
							{@const m = groupCentury.match(/^([IVXL]+)([a-z]+)\s+(\S+)$/)}
							<p class="font-ui text-[12px] uppercase tracking-[0.05em] text-muted">
								{#if m}
									{m[1]}<span class="normal-case">{m[2]}</span> {m[3]}
								{:else}
									{groupCentury}
								{/if}
							</p>
						{/if}
						<p class="font-ui text-[12px] uppercase tracking-[0.05em] text-muted">
							{eraLabelSingular(g.author.era)}
						</p>
					{/if}
				</div>

				<div>
					{#each g.quotes as q, i (q.id)}
						{#if i > 0}
							<!-- Small 40px hairline between quotes from the same
							     author · echoes the rule under the logo in the rail.
							     `aria-hidden` keeps it out of the accessibility tree. -->
							<div
								class="my-5 h-px w-10 bg-border"
								aria-hidden="true"
							></div>
						{/if}
						{@const cite = citationOf(q)}
						{@const isOpen = openQuote?.id === q.id}
						{@const work = q.workId ? workById(q.workId) : null}
						{@const otherTopics = q.topicIds
							.filter((tid) => tid !== data.topic.id)
							.map((tid) => topicById(tid))
							.filter((t): t is NonNullable<typeof t> => t != null)}
						<!-- Permalink anchor for the quote · the URL hash
						     `#q-{id}` deep-links here and (in Study mode) auto-
						     opens the panel. `scroll-mt-24` keeps the quote
						     comfortably below the page's top edge when the
						     browser jumps to the anchor. -->
						<div id={`q-${q.id}`} class="scroll-mt-24">
							<!-- `white-space: pre-line` preserves the paragraph
							     breaks already stored in the data (consecutive
							     `\n\n`) without us having to parse for numbered
							     markers like "7." / "8.". Single newlines also
							     render as a line break · acceptable since the
							     source data never uses soft wraps within a
							     paragraph. -->
							<p class="font-body text-foreground" style="white-space: pre-line;">
								{#if q.fr}
									<span>&ldquo;{@html renderFr(q.fr)}&rdquo;</span>
								{:else}
									<span class="italic text-muted">Traduction française à venir.</span>
								{/if}
							</p>
							{#if cite}
								<!-- Attribution sits on its own line below the quote,
								     led by an em dash · no parens, no trailing period.
								     The work title (if any) is linked to the Œuvre
								     page so a reader can pivot into "everything from
								     this work". The reference tail stays plain text. -->
								<p class="mt-2 font-body text-muted">
									&mdash;
									{#if work}
										<a
											href={`/oeuvres/${work.slug}`}
											class="italic hover:text-active"
										>{work.title}</a>{#if q.reference}<span class="italic">, {q.reference}</span>{/if}
									{:else}
										<em class="italic">{cite}</em>
									{/if}
								</p>
							{/if}

							{#if mode.value === 'study'}
								<!-- Footer row · cross-topic chips on the left, the
								     Plus d'info / Fermer trigger on the right. Chips
								     are the OTHER topics this quote belongs to (the
								     current topic is filtered out) so the reader can
								     follow the same quote into adjacent themes. -->
								<div
									class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2"
								>
									<!-- Cross-topic chips · the "Voir aussi" prefix +
									     pill-shaped chips with an inline arrow glyph
									     make it obvious these are links to ADJACENT
									     topics, not generic styling. A bare underlined
									     label read as quiet meta text and the
									     navigational intent was being missed. -->
									{#if otherTopics.length > 0}
										<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
											<span class="label-meta">
												Voir aussi
											</span>
											{#each otherTopics as t (t.id)}
												<a
													href={`/sujets/${t.slug}`}
													class="inline-flex items-baseline gap-1 rounded-full border border-foreground/15 px-2 py-[2px] font-ui text-[11px] font-light uppercase tracking-[0.05em] text-foreground transition-colors hover:border-active hover:bg-active/10 hover:text-active"
												>
													{t.label}
													<span aria-hidden="true" class="text-[10px]">→</span>
												</a>
											{/each}
										</div>
									{:else}
										<div></div>
									{/if}
									<button
										type="button"
										onclick={() => (isOpen ? closePanel() : openPanel(q))}
										aria-expanded={isOpen}
										class="label-meta-link"
									>
										{isOpen ? 'Fermer' : "Plus d'info"} <span aria-hidden="true">&rarr;</span>
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if topicPanelOpen}
	<!-- Topic-level study panel · sits in the same right column as the
	     quote panel. Mutually exclusive with `openQuote` (opening one
	     closes the other) so they never compete for the same slot. -->
	<aside
		aria-label="À propos du sujet"
		class="mt-12 border-t border-border pt-8 lg:mt-0 lg:border-t-0 lg:border-l lg:border-border lg:pl-8 lg:pt-0 lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto rail-scroll"
	>
		<header class="mb-6 flex items-baseline justify-between gap-4">
			<h2
				class="font-heading italic text-accent leading-[1.1]"
				style="font-size: 1.5rem;"
			>
				{data.topic.label}
			</h2>
			<button
				type="button"
				onclick={closeTopicPanel}
				aria-label="Fermer"
				class="font-heading text-[28px] leading-none text-muted hover:text-active"
			>×</button>
		</header>

		<div
			role="tablist"
			aria-label="Sections du sujet"
			class="mb-6 flex gap-1 border-b border-border"
		>
			{#each TOPIC_TABS as t (t.id)}
				{@const isActive = topicActiveTab === t.id}
				<button
					type="button"
					role="tab"
					aria-selected={isActive}
					onclick={() => (topicActiveTab = t.id)}
					class="-mb-px border-b px-3 py-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] transition-colors"
					class:border-active={isActive}
					class:text-active={isActive}
					class:border-transparent={!isActive}
					class:text-muted={!isActive}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="font-body text-[14px] leading-[1.5]">
			{#if topicActiveTab === 'presentation'}
				{#if data.topic.description}
					<section class="mb-8">
						<p style="white-space: pre-line;">{@html renderFr(data.topic.description)}</p>
					</section>
				{/if}

				<section>
					<h3 class="label-meta">Répartition</h3>
					<dl class="mt-3 space-y-1 text-[14px]">
						{#each topicEraBreakdown as row (row.era)}
							<div class="flex items-baseline justify-between gap-4">
								<dt>{eraLabel(row.era)}</dt>
								<dd class="font-ui text-[12px] font-light text-muted">{row.n}</dd>
							</div>
						{/each}
						<div class="flex items-baseline justify-between gap-4 border-t border-border pt-1">
							<dt class="label-meta">Total</dt>
							<dd class="font-ui text-[12px] font-light text-muted">{data.matching.length}</dd>
						</div>
					</dl>
				</section>

				{#if !data.topic.description}
					<p class="italic text-muted">Aucune description disponible pour ce sujet.</p>
				{/if}
			{:else if topicActiveTab === 'auteurs'}
				<ul class="space-y-1 text-[14px]">
					{#each topicAuthors as { author, n } (author.id)}
						<li class="flex items-baseline justify-between gap-4">
							<span>
								{author.name}
								{#if author.dates}
									<span class="ml-1 font-ui text-[11px] font-light text-muted">{author.dates}</span>
								{/if}
							</span>
							<span class="font-ui text-[12px] font-light text-muted">{n}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<!-- Migne tab · collated PG / PL index for the topic. Each
				     row links to the first quote that uses that ref via
				     the `#q-N` hash. Shows the author + work title so
				     the reader can identify the source without opening
				     the quote. -->
				{#if topicMigneIndex.length === 0}
					<p class="italic text-muted">Aucune référence Migne pour ce sujet.</p>
				{:else}
					<ul class="space-y-4 text-[14px]">
						{#each topicMigneIndex as row (row.ref)}
							{@const firstQuote = data.matching.find((q) => q.id === row.quoteIds[0])}
							{@const author = firstQuote ? authorById(firstQuote.authorId) : null}
							{@const work = firstQuote?.workId ? workById(firstQuote.workId) : null}
							<li>
								<a
									href={`#q-${row.quoteIds[0]}`}
									class="block hover:text-active"
									onclick={() => closeTopicPanel()}
								>
									<div class="flex items-baseline justify-between gap-4">
										<code class="font-ui text-[13px]">{row.ref}</code>
										{#if row.quoteIds.length > 1}
											<span class="font-ui text-[12px] font-light text-muted">×{row.quoteIds.length}</span>
										{/if}
									</div>
									{#if author || work}
										<p class="mt-1 font-body text-[12px] leading-tight text-muted">
											{#if author}<span>{author.name}</span>{/if}
											{#if author && work}<span> &middot; </span>{/if}
											{#if work}<em class="italic">{work.title}</em>{/if}
										</p>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</aside>
{/if}

{#if openQuote}
	<QuotePanelAside quote={openQuote} onClose={closePanel} />
{/if}

</article>

<style>
	/* Hairline rules between source-blocks only · no dangling rule after
	   the last one. Matches the reference's quiet inter-author separation. */
	.source-block + .source-block {
		margin-top: 3.5rem;
		padding-top: 3.5rem;
		border-top: 1px solid var(--color-border);
	}
</style>
