<script lang="ts">
	import type { Quote, Author } from '$lib/schema';
	import { authorById, workById } from '$lib/data';
	import { formatCitation } from '$lib/utils/format-citation';
	import { renderFr } from '$lib/utils/render-fr';
	import { eraLabelFeminine } from '$lib/utils/era';

	let { quote, onClose }: { quote: Quote; onClose: () => void } = $props();

	type Tab = 'auteur' | 'original' | 'sources' | 'notes';
	let activeTab = $state<Tab>('auteur');
	const TABS: Array<{ id: Tab; label: string }> = [
		{ id: 'auteur', label: 'Auteur' },
		{ id: 'original', label: 'Original' },
		{ id: 'sources', label: 'Sources' },
		{ id: 'notes', label: 'Notes' }
	];

	// Reset to first tab whenever the open quote changes.
	$effect(() => {
		quote.id;
		activeTab = 'auteur';
	});

	const author = $derived(authorById(quote.authorId));
	const work = $derived(quote.workId ? workById(quote.workId) : null);

	// Roman-numeral century derived from the author's latest dated year.
	const ROMAN = [
		'','Ier','IIe','IIIe','IVe','Ve','VIe','VIIe','VIIIe','IXe','Xe',
		'XIe','XIIe','XIIIe','XIVe','XVe'
	];
	function latestYear(dates: string | undefined): number {
		if (!dates) return 9999;
		const ys = dates.match(/\d{1,4}/g);
		return ys ? Math.max(...ys.map(Number)) : 9999;
	}
	function centuryLabel(a: Author): string {
		const y = latestYear(a.dates);
		if (y === 9999) return '';
		const c = Math.ceil(y / 100);
		return `${ROMAN[c] ?? `${c}e`} siècle`;
	}
	const century = $derived(author ? centuryLabel(author) : '');

	// Greek vs Syriac detection so the Original tab labels the script
	// accurately (Coptic/Aramaic fall back to the generic label).
	function originalLanguageLabel(text: string): string {
		if (/[܀-ݏ]/.test(text)) return 'Syriaque';
		if (/[Ͱ-Ͽἀ-῿]/.test(text)) return 'Grec';
		return 'Grec / Syriaque';
	}

	// Migne references are noisy in the data · only show the field when
	// it actually looks like "PG <vol>, col. <num>" / "PL …".
	function looksLikeMigne(s: string): boolean {
		return /\b(PG|PL)\b[\s.]*(vol\.?\s*)?\d/i.test(s);
	}
	const migne = $derived(quote.migne && looksLikeMigne(quote.migne) ? quote.migne : null);
	const citation = $derived(author ? formatCitation(quote, author, work ?? undefined) : '');

	// Copy-to-clipboard scaffold · `copiedKey` drives the brief "Copié"
	// confirmation next to each button.
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
</script>

{#if author}
<header class="mb-6">
	<div class="flex items-baseline justify-between gap-4">
		<h2
			class="font-heading italic text-accent leading-[1.1]"
			style="font-size: 1.5rem;"
		>
			{author.name}
		</h2>
		<button
			type="button"
			onclick={onClose}
			aria-label="Fermer"
			class="font-heading text-[28px] leading-none text-muted hover:text-active"
		>×</button>
	</div>
	<button
		type="button"
		onclick={() =>
			copy(
				`${window.location.origin}${window.location.pathname}#q-${quote.id}`,
				'permalink'
			)}
		class="mt-1 inline-flex items-baseline gap-1 font-ui text-[10px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
	>
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
				<dd class="mt-1">{author.name}</dd>
			</div>
			{#if author.originalName}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Nom d'origine</dt>
					<dd class="mt-1 italic">{author.originalName}</dd>
				</div>
			{/if}
			{#if author.dates}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Dates</dt>
					<dd class="mt-1">{author.dates}</dd>
				</div>
			{/if}
			{#if century}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Siècle</dt>
					<dd class="mt-1">{century}</dd>
				</div>
			{/if}
			<div>
				<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Ère</dt>
				<dd class="mt-1">{eraLabelFeminine(author.era)}</dd>
			</div>
			{#if author.region}
				{@const regions = author.region
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
			{#if author.function}
				{@const roles = author.function
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
			{#if author.language?.length}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
						{author.language.length > 1 ? 'Langues' : 'Langue'}
					</dt>
					<dd class="mt-1">{author.language.join(' · ')}</dd>
				</div>
			{/if}
			{#if author.status}
				{@const distinctions = author.status
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
			{#if author.feastDay}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Fête le</dt>
					<dd class="mt-1">{author.feastDay}</dd>
				</div>
			{/if}
			{#if author.groups?.length}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
						{author.groups.length > 1 ? 'Groupes' : 'Groupe'}
					</dt>
					<dd class="mt-1">{author.groups.join(' · ')}</dd>
				</div>
			{/if}
			{#if author.sources?.wikipedia || author.sources?.wikisource}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Liens externes</dt>
					<dd class="mt-1 flex flex-col gap-1">
						{#if author.sources.wikipedia}
							<a
								href={author.sources.wikipedia}
								target="_blank"
								rel="noopener"
								class="font-ui text-[12px] font-light uppercase tracking-[0.05em] text-active hover:underline"
							>
								Wikipédia <span aria-hidden="true">↗</span>
							</a>
						{/if}
						{#if author.sources.wikisource}
							<a
								href={author.sources.wikisource}
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
			{#if quote.latin}
				<section>
					<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Latin</h3>
					<p class="mt-2 italic">{quote.latin}</p>
				</section>
			{/if}
			{#if quote.greek}
				<section>
					<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">
						{originalLanguageLabel(quote.greek)}
					</h3>
					<p class="mt-2 italic">{quote.greek}</p>
				</section>
			{/if}
			{#if !quote.latin && !quote.greek}
				<p class="italic text-muted">Texte original non disponible.</p>
			{/if}
		</div>
	{:else if activeTab === 'sources'}
		<div class="space-y-5">
			{#if migne}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Migne</dt>
					<dd class="mt-2 flex flex-wrap items-center gap-2">
						<code class="border border-border px-2 py-0.5 font-ui text-[13px]">{migne}</code>
						<button
							type="button"
							onclick={() => copy(migne, 'migne')}
							class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
						>{copiedKey === 'migne' ? 'Copié' : 'Copier'}</button>
					</dd>
				</div>
			{/if}
			{#if citation}
				<div>
					<dt class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Citation académique</dt>
					<dd class="mt-2">
						<span class="italic">{citation}</span>
						<button
							type="button"
							onclick={() => copy(citation, 'citation')}
							class="ml-2 font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted hover:text-active"
						>{copiedKey === 'citation' ? 'Copié' : 'Copier'}</button>
					</dd>
				</div>
			{/if}
			{#if quote.links?.primary}
				<a href={quote.links.primary} target="_blank" rel="noopener"
					class="block font-ui text-[12px] font-light uppercase tracking-[0.1em] text-active hover:underline">
					Source primaire <span aria-hidden="true">↗</span>
				</a>
			{/if}
			{#if quote.links?.archive}
				<a href={quote.links.archive} target="_blank" rel="noopener"
					class="block font-ui text-[12px] font-light uppercase tracking-[0.1em] text-active hover:underline">
					Archive.org <span aria-hidden="true">↗</span>
				</a>
			{/if}
			{#if !migne && !citation && !quote.links?.primary && !quote.links?.archive}
				<p class="italic text-muted">Aucune source externe.</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-5">
			{#if quote.context}
				<section>
					<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Contexte</h3>
					<p class="mt-2" style="white-space: pre-line;">{@html renderFr(quote.context)}</p>
				</section>
			{/if}
			{#if quote.notes}
				<section>
					<h3 class="font-ui text-[11px] font-light uppercase tracking-[0.1em] text-muted">Notes</h3>
					<p class="mt-2" style="white-space: pre-line;">{@html renderFr(quote.notes)}</p>
				</section>
			{/if}
			{#if !quote.context && !quote.notes}
				<p class="italic text-muted">Aucune note.</p>
			{/if}
		</div>
	{/if}
</div>
{/if}
