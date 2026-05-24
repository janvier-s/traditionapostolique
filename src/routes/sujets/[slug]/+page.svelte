<script lang="ts">
	import { onMount } from 'svelte';
	import MetaTags from '$lib/components/ui/MetaTags.svelte';
	import { authorById, workById, topicById } from '$lib/data';
	import { formatCitation } from '$lib/utils/format-citation';
	import { renderFr } from '$lib/utils/render-fr';
	import type { Quote, Era, Author } from '$lib/schema';
	import { eraOrder, eraLabel, eraLabelSingular, eraLabelFeminine } from '$lib/utils/era';
	import { mode } from '$lib/stores/mode.svelte';

	let { data } = $props();

	function latestYear(dates: string | undefined): number {
		if (!dates) return 9999;
		const matches = dates.match(/\d{1,4}/g);
		if (!matches) return 9999;
		return Math.max(...matches.map((m) => Number(m)));
	}

	// French-style century label from a year (e.g. 384 → "IVe siècle").
	// Roman-numeral ordinal followed by lowercase "e siècle" is the
	// conventional form in academic French.
	const ROMAN = [
		'I','II','III','IV','V','VI','VII','VIII','IX','X',
		'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'
	];
	// The schema stores Greek and Syriac in a single `greek` field. Detect
	// which one it actually is from the script range so the panel can
	// label it accurately. Coptic (U+2C80–2CFF) and Aramaic (U+10840+) are
	// rare enough that we lump them under "Grec / Syriaque" if we can't
	// tell, but the two common cases land on a single clear label.
	function originalLanguageLabel(text: string): string {
		if (/[܀-ݏ]/.test(text)) return 'Syriaque';
		if (/[Ͱ-Ͽἀ-῿]/.test(text)) return 'Grec';
		return 'Grec / Syriaque';
	}

	function centuryLabel(author: Author): string {
		const y = latestYear(author.dates);
		if (y === 9999) return '';
		const c = Math.ceil(y / 100);
		return `${ROMAN[c - 1] ?? c}e siècle`;
	}

	// Insert a line break before short connector words ("de", "d'", "of",
	// etc.) so author names wrap on a natural particle in the narrow
	// marginal column.
	function breakName(name: string): string {
		return name
			.split(' ')
			.map((w, i) => (i > 0 && w.replace(/['’]/g, '').length <= 2 ? `<br/>${w}` : w))
			.join(' ');
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

	// Study-mode era filter. Empty Set = "no filter, show everything";
	// otherwise show only authors whose era is in the set. Reset on
	// navigation since era picks rarely make sense across topics.
	let eraFilter = $state<Set<Era>>(new Set());

	function toggleEra(e: Era) {
		const next = new Set(eraFilter);
		if (next.has(e)) next.delete(e);
		else next.add(e);
		eraFilter = next;
	}

	function clearEraFilter() {
		eraFilter = new Set();
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

	// Available eras for the filter bar · only show chips for eras that
	// actually appear on this topic's authors. Keeps the bar relevant and
	// avoids dead options (e.g. "Médiévaux" on a purely apostolic topic).
	const erasOnPage = $derived.by<Era[]>(() => {
		const seen = new Set<Era>();
		for (const q of data.matching) {
			const a = authorById(q.authorId);
			if (a) seen.add(a.era);
		}
		return eraOrder.filter((e) => seen.has(e));
	});

	const groups = $derived.by<Group[]>(() => {
		const byAuthor = new Map<number, Group>();
		const activeEraFilter = mode.value === 'study' && eraFilter.size > 0 ? eraFilter : null;
		for (const q of data.matching) {
			const a = authorById(q.authorId);
			if (!a) continue;
			if (activeEraFilter && !activeEraFilter.has(a.era)) continue;
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
			arr.sort((x, y) => dir * (latestYear(x.author.dates) - latestYear(y.author.dates)));
		}
		return arr;
	});

	const totalShown = $derived(groups.reduce((n, g) => n + g.quotes.length, 0));

	// Study-mode "Plus d'info" panel state. `openQuote` drives both the
	// panel's visibility and its content. When set, the page layout
	// splits into a two-column grid · the quotes column on the left,
	// the panel on the right · pushing rather than overlaying (cf.
	// catechismecatholique.com).
	type Tab = 'auteur' | 'original' | 'sources' | 'notes';
	let openQuote = $state<Quote | null>(null);
	let activeTab = $state<Tab>('auteur');

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
		activeTab = 'auteur';
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
			.sort((x, y) => latestYear(x.author.dates) - latestYear(y.author.dates));
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
	function parseMigne(s: string): { series: 'PG' | 'PL'; volume: number; col: number } | null {
		const m = s.match(/\b(PG|PL)\b[\s.]*(?:vol\.?\s*)?(\d+)[\s,]*(?:col\.?\s*)?(\d+)?/i);
		if (!m) return null;
		return {
			series: m[1].toUpperCase() as 'PG' | 'PL',
			volume: Number(m[2]),
			col: m[3] ? Number(m[3]) : 0
		};
	}
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
		activeTab = 'auteur';
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

	// Derived bits for the open quote · keeps the template tidy.
	const openAuthor = $derived(openQuote ? authorById(openQuote.authorId) : null);
	const openWork = $derived(openQuote?.workId ? workById(openQuote.workId) : null);
	const openCentury = $derived(openAuthor ? centuryLabel(openAuthor) : '');

	// Migne should only display when the value is a real PG (Patrologia
	// Graeca) or PL (Patrologia Latina) reference. The data has stray
	// non-Migne values left over from the spreadsheet (footnotes, URLs,
	// running text) · this regex matches `PG <volume>, col. <num>` and
	// `PL <volume>, col. <num>` with tolerance for spacing and the
	// `vol.` token.
	function looksLikeMigne(s: string): boolean {
		return /\b(PG|PL)\b[\s.]*(vol\.?\s*)?\d/i.test(s);
	}
	const openMigne = $derived(
		openQuote?.migne && looksLikeMigne(openQuote.migne) ? openQuote.migne : null
	);
	const openCitation = $derived(
		openQuote && openAuthor
			? formatCitation(openQuote, openAuthor, openWork ?? undefined)
			: ''
	);

	const TABS: Array<{ id: Tab; label: string }> = [
		{ id: 'auteur', label: 'Auteur' },
		{ id: 'original', label: 'Original' },
		{ id: 'sources', label: 'Sources' },
		{ id: 'notes', label: 'Notes' }
	];

	let copiedKey = $state<string | null>(null);
	async function copy(text: string, key: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			setTimeout(() => (copiedKey = null), 1500);
		} catch {
			/* noop */
		}
	}

	function citationOf(q: Quote): string {
		// Inline italic-parenthesised citation appended after the quote
		// text, e.g. "(Protoevangelium de Jacques, Livre 4, Chapitre 7)".
		// Built from work title + reference. Author dates appear in the
		// marginal source header, not in the citation. The underlying
		// data was already translated and Excel-artifact references
		// stripped by `scripts/clean-references.ts` · this function
		// just composes what's there.
		const parts: string[] = [];
		const work = q.workId ? workById(q.workId) : undefined;
		if (work) parts.push(work.title);
		if (q.reference) parts.push(q.reference);
		return parts.join(', ');
	}
</script>

<MetaTags
	title={data.topic.label}
	separator="d'après la"
	description={data.topic.description ?? `Citations patristiques sur ${data.topic.label}.`}
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
				<p class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
					{totalShown} citation{totalShown > 1 ? 's' : ''}
				</p>
				{#if mode.value === 'study'}
					<button
						type="button"
						onclick={() => (topicPanelOpen ? closeTopicPanel() : openTopicPanel())}
						aria-expanded={topicPanelOpen}
						class="inline-flex items-baseline gap-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted underline-offset-4 hover:text-active hover:underline"
					>
						{topicPanelOpen ? 'Fermer' : 'À propos du sujet'}
						<span aria-hidden="true">{topicPanelOpen ? '×' : '→'}</span>
					</button>
				{/if}
			</div>
		</div>
	</header>

	{#if mode.value === 'study'}
		<!-- Study-mode filter bar · sits in the right grid column so it
		     aligns with the quotes (not the source headers). Keeps the
		     Read-mode aesthetic: small uppercase Proxima labels, hairline
		     borders, sage-olive active state. -->
		<div class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]">
			<div></div>
			<div
				class="flex flex-wrap items-baseline gap-x-2 gap-y-2 border-b border-border pb-4"
			>
				<span
					class="mr-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted"
				>Ère</span>
				{#each erasOnPage as e (e)}
					{@const active = eraFilter.has(e)}
					<button
						type="button"
						onclick={() => toggleEra(e)}
						aria-pressed={active}
						class="rounded-full border border-foreground/15 px-3 py-[3px] font-ui text-[12px] font-light uppercase tracking-[0.05em] transition-colors hover:border-active"
						class:bg-active={active}
						class:border-active={active}
						class:text-background={active}
						class:text-foreground={!active}
					>
						{eraLabel(e)}
					</button>
				{/each}
				{#if eraFilter.size > 0}
					<button
						type="button"
						onclick={clearEraFilter}
						class="ml-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted underline-offset-4 hover:text-active hover:underline"
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
					<span class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Tri</span>
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
			{@const groupCentury = centuryLabel(g.author)}
			<section class="source-block grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-4 md:grid-cols-[var(--author-col)_1fr]">
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
											<span class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
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
										class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted underline-offset-4 hover:text-active hover:underline"
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

		<div class="font-body text-[15px] leading-[1.6]">
			{#if topicActiveTab === 'presentation'}
				{#if data.topic.description}
					<section class="mb-8">
						<p class="leading-[1.7]">{data.topic.description}</p>
					</section>
				{/if}

				<section>
					<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Répartition</h3>
					<dl class="mt-3 space-y-1 text-[14px]">
						{#each topicEraBreakdown as row (row.era)}
							<div class="flex items-baseline justify-between gap-4">
								<dt>{eraLabel(row.era)}</dt>
								<dd class="font-ui text-[12px] font-light text-muted">{row.n}</dd>
							</div>
						{/each}
						<div class="flex items-baseline justify-between gap-4 border-t border-border pt-1">
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Total</dt>
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

{#if openQuote && openAuthor}
	<!-- Inline study panel · sits in the right grid column when an
	     openQuote is set. Pushes the main content rather than overlaying
	     (per user direction: "function like the catechismecatholique one").
	     Sticky positioning so the panel stays in view as the reader
	     scrolls through quotes. On mobile (no `lg:` prefix) it stacks
	     below the quotes. -->
	<aside
		aria-label="Plus d'infos sur la citation"
		class="mt-12 border-t border-border pt-8 lg:mt-0 lg:border-t-0 lg:border-l lg:border-border lg:pl-8 lg:pt-0 lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto rail-scroll"
	>
		<header class="mb-6">
			<div class="flex items-baseline justify-between gap-4">
				<h2
					class="font-heading italic text-accent leading-[1.1]"
					style="font-size: 1.5rem;"
				>
					{openAuthor.name}
				</h2>
				<button
					type="button"
					onclick={closePanel}
					aria-label="Fermer"
					class="font-heading text-[28px] leading-none text-muted hover:text-active"
				>×</button>
			</div>
			<!-- Subtle permalink under the title · single-click copy with
			     a brief "Copié" confirmation. Lives in the header so it
			     reads as panel metadata, not as a Sources sub-field. -->
			<button
				type="button"
				onclick={() =>
					copy(
						`${window.location.origin}${window.location.pathname}#q-${openQuote!.id}`,
						'permalink'
					)}
				class="mt-1 inline-flex items-baseline gap-1 font-ui text-[10px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
			>
				<!-- Stacked-squares copy glyph · `currentColor` lets it pick
				     up the button's text colour (muted → sage-olive on hover). -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M7 9.667A2.667 2.667 0 0 1 9.667 7h8.666A2.667 2.667 0 0 1 21 9.667v8.666A2.667 2.667 0 0 1 18.333 21H9.667A2.667 2.667 0 0 1 7 18.333z" />
					<path d="M4.012 16.737A2 2 0 0 1 3 15V5c0-1.1.9-2 2-2h10c.75 0 1.158.385 1.5 1" />
				</svg>
				{copiedKey === 'permalink' ? 'Lien copié' : 'Copier le lien vers cette citation'}
			</button>
		</header>

		<div
			role="tablist"
			aria-label="Sections d'information"
			class="mb-6 flex gap-1 border-b border-border"
		>
			{#each TABS as t (t.id)}
				{@const isActive = activeTab === t.id}
				<button
					type="button"
					role="tab"
					aria-selected={isActive}
					onclick={() => (activeTab = t.id)}
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

		<div class="font-body text-[15px] leading-[1.6]">
			{#if activeTab === 'auteur'}
				<dl class="space-y-4">
					<div>
						<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Nom</dt>
						<dd class="mt-1">{openAuthor.name}</dd>
					</div>
					{#if openAuthor.originalName}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Nom d'origine</dt>
							<dd class="mt-1 italic">{openAuthor.originalName}</dd>
						</div>
					{/if}
					{#if openAuthor.dates}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Dates</dt>
							<dd class="mt-1">{openAuthor.dates}</dd>
						</div>
					{/if}
					{#if openCentury}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Siècle</dt>
							<dd class="mt-1">{openCentury}</dd>
						</div>
					{/if}
					<div>
						<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Ère</dt>
						<dd class="mt-1">{eraLabelFeminine(openAuthor.era)}</dd>
					</div>
					{#if openAuthor.region}
						{@const regions = openAuthor.region
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean)}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{regions.length > 1 ? 'Régions' : 'Région'}
							</dt>
							<dd class="mt-1">{regions.join(' · ')}</dd>
						</div>
					{/if}
					{#if openAuthor.function}
						{@const roles = openAuthor.function
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean)}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{roles.length > 1 ? 'Rôles' : 'Rôle'}
							</dt>
							<dd class="mt-1">{roles.join(' · ')}</dd>
						</div>
					{/if}
					{#if openAuthor.language?.length}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{openAuthor.language.length > 1 ? 'Langues' : 'Langue'}
							</dt>
							<dd class="mt-1">{openAuthor.language.join(' · ')}</dd>
						</div>
					{/if}
					{#if openAuthor.status}
						{@const distinctions = openAuthor.status
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean)}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{distinctions.length > 1 ? 'Distinctions' : 'Distinction'}
							</dt>
							<dd class="mt-1">{distinctions.join(' · ')}</dd>
						</div>
					{/if}
					{#if openAuthor.feastDay}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Fête le</dt>
							<dd class="mt-1">{openAuthor.feastDay}</dd>
						</div>
					{/if}
					{#if openAuthor.groups?.length}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{openAuthor.groups.length > 1 ? 'Groupes' : 'Groupe'}
							</dt>
							<dd class="mt-1">{openAuthor.groups.join(' · ')}</dd>
						</div>
					{/if}
					{#if openAuthor.sources?.wikipedia || openAuthor.sources?.wikisource}
						<!-- External references · Wikipedia for the encyclopaedic
						     entry, Wikisource for the author's works in original
						     language when available. Both open in a new tab. -->
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Liens externes</dt>
							<dd class="mt-1 flex flex-col gap-1">
								{#if openAuthor.sources.wikipedia}
									<a
										href={openAuthor.sources.wikipedia}
										target="_blank"
										rel="noopener"
										class="font-ui text-[12px] font-light uppercase tracking-[0.05em] text-active hover:underline"
									>
										Wikipédia <span aria-hidden="true">↗</span>
									</a>
								{/if}
								{#if openAuthor.sources.wikisource}
									<a
										href={openAuthor.sources.wikisource}
										target="_blank"
										rel="noopener"
										class="font-ui text-[12px] font-light uppercase tracking-[0.05em] text-active hover:underline"
									>
										Wikisource <span aria-hidden="true">↗</span>
									</a>
								{/if}
							</dd>
						</div>
					{/if}
				</dl>
			{:else if activeTab === 'original'}
				<div class="space-y-5">
					{#if openQuote.latin}
						<section>
							<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Latin</h3>
							<p class="mt-2 italic">{openQuote.latin}</p>
						</section>
					{/if}
					{#if openQuote.greek}
						<section>
							<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
								{originalLanguageLabel(openQuote.greek)}
							</h3>
							<p class="mt-2 italic">{openQuote.greek}</p>
						</section>
					{/if}
					{#if !openQuote.latin && !openQuote.greek}
						<p class="italic text-muted">Texte original non disponible.</p>
					{/if}
				</div>
			{:else if activeTab === 'sources'}
				<div class="space-y-5">
					{#if openMigne}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Migne</dt>
							<dd class="mt-2 flex flex-wrap items-center gap-2">
								<code class="border border-border px-2 py-0.5 font-ui text-[13px]">{openMigne}</code>
								<button
									type="button"
									onclick={() => copy(openMigne!, 'migne')}
									class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
								>{copiedKey === 'migne' ? 'Copié' : 'Copier'}</button>
							</dd>
						</div>
					{/if}
					{#if openCitation}
						<div>
							<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Citation académique</dt>
							<dd class="mt-2">
								<span class="italic">{openCitation}</span>
								<button
									type="button"
									onclick={() => copy(openCitation, 'citation')}
									class="ml-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
								>{copiedKey === 'citation' ? 'Copié' : 'Copier'}</button>
							</dd>
						</div>
					{/if}
					{#if openQuote.links?.primary}
						<a href={openQuote.links.primary} target="_blank" rel="noopener"
							class="block font-ui text-[12px] font-light uppercase tracking-[0.1em] text-active hover:underline">
							Source primaire <span aria-hidden="true">↗</span>
						</a>
					{/if}
					{#if openQuote.links?.archive}
						<a href={openQuote.links.archive} target="_blank" rel="noopener"
							class="block font-ui text-[12px] font-light uppercase tracking-[0.1em] text-active hover:underline">
							Archive.org <span aria-hidden="true">↗</span>
						</a>
					{/if}
					{#if !openMigne && !openCitation && !openQuote.links?.primary && !openQuote.links?.archive}
						<p class="italic text-muted">Aucune source externe.</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-5">
					{#if openQuote.context}
						<section>
							<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Contexte</h3>
							<p class="mt-2">{openQuote.context}</p>
						</section>
					{/if}
					{#if openQuote.notes}
						<section>
							<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Notes</h3>
							<p class="mt-2">{openQuote.notes}</p>
						</section>
					{/if}
					{#if !openQuote.context && !openQuote.notes}
						<p class="italic text-muted">Aucune note.</p>
					{/if}
				</div>
			{/if}
		</div>
	</aside>
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
