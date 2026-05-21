<script lang="ts">
	import type { Quote } from '$lib/schema';
	import { authorById, workById } from '$lib/data';
	import { formatCitation } from '$lib/utils/format-citation';

	let { quote, onClose }: { quote: Quote | null; onClose: () => void } = $props();

	type Tab = 'auteur' | 'original' | 'sources' | 'notes';
	let active = $state<Tab>('auteur');

	const author = $derived(quote ? authorById(quote.authorId) : undefined);
	const work = $derived(quote?.workId ? workById(quote.workId) : undefined);
	const citation = $derived(quote && author ? formatCitation(quote, author, work) : '');

	let migneCopied = $state(false);
	let citationCopied = $state(false);
	async function copy(text: string, which: 'migne' | 'citation') {
		try {
			await navigator.clipboard.writeText(text);
			if (which === 'migne') {
				migneCopied = true;
				setTimeout(() => (migneCopied = false), 1500);
			} else {
				citationCopied = true;
				setTimeout(() => (citationCopied = false), 1500);
			}
		} catch {
			// noop
		}
	}

	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape' && quote) onClose();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	const TABS: Array<{ id: Tab; label: string }> = [
		{ id: 'auteur', label: 'Auteur' },
		{ id: 'original', label: 'Original' },
		{ id: 'sources', label: 'Sources' },
		{ id: 'notes', label: 'Notes' }
	];
</script>

{#if quote && author}
	<div
		role="dialog"
		aria-label="Plus d'infos sur la citation"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Fermer le panneau"
			onclick={onClose}
		></button>

		<aside
			class="relative z-10 flex w-full max-w-lg flex-col overflow-y-auto bg-panel font-body shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-border p-4">
				<h2 class="font-heading text-lg">{author.name}</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Fermer"
					class="rounded border border-border px-2 py-1 font-ui text-sm">×</button
				>
			</header>

			<div
				role="tablist"
				aria-label="Sections d'information"
				class="grid grid-cols-4 border-b border-border font-ui text-xs"
			>
				{#each TABS as t (t.id)}
					<button
						type="button"
						role="tab"
						aria-selected={active === t.id}
						onclick={() => (active = t.id)}
						class="border-r border-border px-3 py-2 last:border-r-0"
						class:bg-background={active === t.id}
					>
						{t.label}
					</button>
				{/each}
			</div>

			<div class="p-4">
				{#if active === 'auteur'}
					<dl class="space-y-3 text-sm">
						<div>
							<dt class="font-ui text-xs uppercase text-muted">Nom</dt>
							<dd>
								{author.name}
								{#if author.originalName}<span class="italic text-muted"
										>({author.originalName})</span
									>{/if}
							</dd>
						</div>
						{#if author.dates}<div>
								<dt class="font-ui text-xs uppercase text-muted">Dates</dt>
								<dd>{author.dates}</dd>
							</div>{/if}
						{#if author.region}<div>
								<dt class="font-ui text-xs uppercase text-muted">Région</dt>
								<dd>{author.region}</dd>
							</div>{/if}
						{#if author.function}<div>
								<dt class="font-ui text-xs uppercase text-muted">Fonction</dt>
								<dd>{author.function}</dd>
							</div>{/if}
						{#if author.language?.length}<div>
								<dt class="font-ui text-xs uppercase text-muted">Langue(s)</dt>
								<dd>{author.language.join(' · ')}</dd>
							</div>{/if}
						{#if author.bioShort}<p class="mt-3 max-w-reader font-body">{author.bioShort}</p>{/if}
						<a
							href={`/peres/${author.slug}`}
							class="mt-3 inline-block font-ui text-sm text-accent-text">Voir la page complète →</a
						>
					</dl>
				{:else if active === 'original'}
					<div class="space-y-4">
						{#if quote.latin}
							<section>
								<h3 class="font-ui text-xs uppercase text-muted">Latin</h3>
								<p class="mt-1 font-body italic">{quote.latin}</p>
							</section>
						{/if}
						{#if quote.greek}
							<section>
								<h3 class="font-ui text-xs uppercase text-muted">Grec / Syriaque</h3>
								<p class="mt-1 font-body italic">{quote.greek}</p>
							</section>
						{/if}
						{#if !quote.latin && !quote.greek}
							<p class="italic text-muted">Texte original non disponible.</p>
						{/if}
					</div>
				{:else if active === 'sources'}
					<div class="space-y-4 text-sm">
						{#if quote.migne}
							<div>
								<dt class="font-ui text-xs uppercase text-muted">Migne</dt>
								<dd class="mt-1 flex flex-wrap items-center gap-2">
									<code class="rounded bg-subtle/15 px-1.5 py-0.5">{quote.migne}</code>
									<button
										onclick={() => copy(quote.migne!, 'migne')}
										class="rounded border border-border px-2 py-0.5 text-xs"
									>
										{migneCopied ? 'Copié' : 'Copier'}
									</button>
								</dd>
							</div>
						{/if}
						<div>
							<dt class="font-ui text-xs uppercase text-muted">Citation académique</dt>
							<dd class="mt-1 flex flex-wrap items-center gap-2">
								<span class="font-body">{citation}</span>
								<button
									onclick={() => copy(citation, 'citation')}
									class="rounded border border-border px-2 py-0.5 text-xs"
								>
									{citationCopied ? 'Copié' : 'Copier'}
								</button>
							</dd>
						</div>
						{#if quote.links.archive}
							<a
								href={quote.links.archive}
								target="_blank"
								rel="noopener"
								class="block text-accent-text"
							>
								Voir sur Archive.org →
							</a>
						{/if}
						{#if quote.links.primary}
							<a
								href={quote.links.primary}
								target="_blank"
								rel="noopener"
								class="block text-accent-text"
							>
								Source primaire →
							</a>
						{/if}
						{#if !quote.migne && !quote.links.archive && !quote.links.primary}
							<p class="italic text-muted">Aucune source externe.</p>
						{/if}
					</div>
				{:else}
					{#if quote.context}
						<section class="mb-4">
							<h3 class="font-ui text-xs uppercase text-muted">Contexte</h3>
							<p class="mt-1 font-body">{quote.context}</p>
						</section>
					{/if}
					{#if quote.notes}
						<section>
							<h3 class="font-ui text-xs uppercase text-muted">Notes</h3>
							<p class="mt-1 font-body">{quote.notes}</p>
						</section>
					{/if}
					{#if !quote.context && !quote.notes}
						<p class="italic text-muted">Aucune note.</p>
					{/if}
				{/if}
			</div>
		</aside>
	</div>
{/if}
