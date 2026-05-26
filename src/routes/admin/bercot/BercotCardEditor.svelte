<script lang="ts">
	import type { Author, BercotEntry, BercotStatus, Topic, Work } from '$lib/schema';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';

	type Props = {
		entry: BercotEntry;
		entries: BercotEntry[]; // siblings (for prev/next within current filter)
		topics: Topic[];
		authors: Author[];
		works: Work[];
		onClose: () => void;
		onSaved: (updated: BercotEntry) => void;
		onPublished: (updated: BercotEntry, newQuoteId: number) => void;
		onNavigate: (delta: -1 | 1) => void;
	};
	let { entry, entries, topics, authors, works, onClose, onSaved, onPublished, onNavigate }: Props =
		$props();

	let dialogEl = $state<HTMLDivElement | null>(null);

	// Local mutable copy. The lint warning below is technically correct
	// (this only captures the *initial* value of `entry`), but the $effect
	// underneath handles subsequent prop changes (next/prev navigation),
	// so the warning's concern doesn't apply here.
	// svelte-ignore state_referenced_locally
	let draft = $state<BercotEntry>({ ...entry });
	let dirty = $state(false);
	let saving = $state(false);
	let saveError = $state('');

	// Reset when parent swaps `entry` (next/prev navigation)
	$effect(() => {
		draft = { ...entry };
		dirty = false;
		saveError = '';
	});

	// Re-focus dialog when entry changes (open + every prev/next navigation)
	$effect(() => {
		void entry;
		dialogEl?.focus();
	});

	const topicFlat = $derived(flattenTree(buildTopicTree(topics)));
	const authorOptions = $derived(
		authors.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'))
	);
	const workOptions = $derived(works.slice().sort((a, b) => a.title.localeCompare(b.title, 'fr')));

	function update<K extends keyof BercotEntry>(key: K, value: BercotEntry[K]) {
		draft = { ...draft, [key]: value };
		dirty = true;
	}

	function toggleTopic(id: number) {
		const has = draft.mappedTopicIds.includes(id);
		update(
			'mappedTopicIds',
			has ? draft.mappedTopicIds.filter((x) => x !== id) : [...draft.mappedTopicIds, id]
		);
	}

	// Core persistence (no `saving` lifecycle management — callers wrap it).
	// Re-fetches the canonical array so we don't clobber writes from elsewhere,
	// splices in our draft, and PUTs the whole thing (API does a full replace).
	async function persistDraft(): Promise<BercotEntry | null> {
		const allBercot = (await fetch('/admin/api/bercot').then((r) => r.json())) as BercotEntry[];
		const merged = allBercot.map((b) => (b.id === draft.id ? draft : b));
		const res = await fetch('/admin/api/bercot', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(merged)
		});
		if (!res.ok) {
			saveError = await res.text();
			return null;
		}
		dirty = false;
		onSaved(draft);
		return draft;
	}

	async function save(): Promise<BercotEntry | null> {
		saving = true;
		saveError = '';
		try {
			return await persistDraft();
		} finally {
			saving = false;
		}
	}

	async function publish() {
		saving = true;
		saveError = '';
		try {
			const saved = dirty ? await persistDraft() : draft;
			if (!saved) return;
			const res = await fetch(`/admin/api/bercot/${draft.id}/publish`, { method: 'POST' });
			if (!res.ok) {
				saveError = await res.text();
				return;
			}
			const body = await res.json();
			onPublished({ ...draft, status: 'published', siteQuoteId: body.quote.id }, body.quote.id);
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			void save();
		} else if (e.key === 'Escape') {
			onClose();
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
			e.preventDefault();
			if (!saving) onNavigate(1);
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
			e.preventDefault();
			if (!saving) onNavigate(-1);
		}
	}

	const canPublish = $derived(
		Boolean(draft.fr?.trim()) &&
			draft.authorId != null &&
			draft.mappedTopicIds.length > 0 &&
			draft.status === 'kept'
	);

	const STATUS: BercotStatus[] = ['pending', 'kept', 'rejected', 'published'];
	const STATUS_LABEL: Record<BercotStatus, string> = {
		pending: 'À examiner',
		kept: 'Retenu',
		rejected: 'Rejeté',
		published: 'Publié'
	};
	// Active chip background/text per semantic status — echoes STATUS_TONE in +page.svelte
	const STATUS_ACTIVE: Record<BercotStatus, string> = {
		pending: 'bg-amber-500/20 text-amber-800 border-amber-500/50',
		kept: 'bg-emerald-500/20 text-emerald-800 border-emerald-500/50',
		rejected: 'bg-zinc-500/20 text-zinc-700 border-zinc-400/50',
		published: 'bg-sky-500/20 text-sky-800 border-sky-500/50'
	};
</script>

<div
	class="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30"
	onclick={onClose}
	role="presentation"
>
	<div
		bind:this={dialogEl}
		class="flex h-full w-full max-w-5xl flex-col bg-background shadow-xl outline-none"
		onclick={(e) => e.stopPropagation()}
		onkeydown={onKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Éditeur de citation Bercot"
		tabindex="-1"
	>
		<!-- ── Header ── -->
		<header class="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
			<div class="flex min-w-0 flex-col gap-0.5">
				<p class="truncate font-ui text-[11px] uppercase tracking-wider text-muted">
					{draft.sourceEntry}{draft.subsection ? ` · ${draft.subsection}` : ''}
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<p class="truncate text-xs text-muted">{draft.attribution}</p>
					{#if entry.dedupMatch != null}
						<a
							class="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-ui text-[10px] text-sky-700 hover:bg-sky-500/20"
							href={`/admin/citations#${entry.dedupMatch}`}
							target="_blank"
							rel="noopener"
							title="Cette citation correspond déjà à une quote existante"
						>
							~ quote #{entry.dedupMatch}
						</a>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onclick={() => onNavigate(-1)}
					disabled={saving}
					class="rounded border border-border px-2 py-1 font-ui text-xs hover:bg-subtle/10 disabled:opacity-40"
					title="Précédent (⌘/Ctrl + ←)"
				>
					← Préc
				</button>
				<button
					type="button"
					onclick={() => onNavigate(1)}
					disabled={saving}
					class="rounded border border-border px-2 py-1 font-ui text-xs hover:bg-subtle/10 disabled:opacity-40"
					title="Suivant (⌘/Ctrl + →)"
				>
					Suiv →
				</button>
				<button
					type="button"
					onclick={onClose}
					class="ml-2 rounded border border-border px-2 py-1 font-ui text-xs hover:bg-subtle/10"
					title="Fermer (Esc)"
					aria-label="Fermer">✕</button
				>
			</div>
		</header>

		<!-- ── Body — responsive 2-col → 1-col below lg ── -->
		<div class="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-2">
			<!-- LEFT: read-only English source -->
			<section class="border-b border-border p-5 lg:border-b-0 lg:border-r">
				<p class="font-ui text-[10px] uppercase tracking-wider text-muted">
					Texte original · Bercot EN
				</p>
				<!-- Primary text surface — visually prominent -->
				<p class="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
					{entry.en}
				</p>
			</section>

			<!-- RIGHT: editable form -->
			<section class="space-y-4 overflow-y-auto p-5">
				<!-- ── Group 1: Traductions ── -->
				<div>
					<label
						for="bercot-fr"
						class="block font-ui text-[10px] uppercase tracking-wider text-muted"
					>
						Traduction française
					</label>
					<textarea
						id="bercot-fr"
						class="mt-2 h-48 w-full rounded border border-border bg-panel px-3 py-2 text-[15px] leading-relaxed text-foreground"
						value={draft.fr ?? ''}
						oninput={(e) =>
							update('fr', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</div>

				<label class="block">
					<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Latin</span>
					<textarea
						class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
						value={draft.latin ?? ''}
						oninput={(e) =>
							update('latin', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Grec</span>
					<textarea
						class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
						value={draft.greek ?? ''}
						oninput={(e) =>
							update('greek', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<!-- ── Group 2: Métadonnées de citation ── -->
				<div class="border-t border-border pt-4 space-y-3">
					<!-- Author -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
							>Auteur (auteurs.json)</span
						>
						<select
							class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.authorId ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								update('authorId', v === '' ? undefined : Number(v));
							}}
						>
							<option value="">(non assigné)</option>
							{#each authorOptions as a (a.id)}
								<option value={a.id}>{a.name}</option>
							{/each}
						</select>
					</label>

					<!-- Work -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Œuvre</span>
						<select
							class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.workId ?? ''}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								update('workId', v === '' ? undefined : Number(v));
							}}
						>
							<option value="">(non assignée)</option>
							{#each workOptions as w (w.id)}
								<option value={w.id}>{w.title}</option>
							{/each}
						</select>
					</label>

					<!-- Study title -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
							>Référence d'étude</span
						>
						<input
							type="text"
							class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.studyTitle ?? ''}
							oninput={(e) =>
								update('studyTitle', (e.currentTarget as HTMLInputElement).value || undefined)}
						/>
					</label>

					<!-- Migne -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
							>Référence Migne</span
						>
						<input
							type="text"
							placeholder="ex. PL 14, 423"
							class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.migne ?? ''}
							oninput={(e) =>
								update('migne', (e.currentTarget as HTMLInputElement).value || undefined)}
						/>
					</label>

					<!-- Context -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Contexte</span>
						<textarea
							class="mt-1 h-20 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.context ?? ''}
							oninput={(e) =>
								update('context', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
						></textarea>
					</label>

					<!-- Links -->
					<div>
						<p class="font-ui text-[10px] uppercase tracking-wider text-muted">Liens</p>
						<label class="mt-2 block">
							<span class="font-ui text-[10px] text-muted">Source primaire (URL)</span>
							<input
								type="url"
								placeholder="https://…"
								class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
								value={draft.linksPrimary ?? ''}
								oninput={(e) =>
									update('linksPrimary', (e.currentTarget as HTMLInputElement).value || undefined)}
							/>
						</label>
						<label class="mt-2 block">
							<span class="font-ui text-[10px] text-muted">Archive (URL)</span>
							<input
								type="url"
								placeholder="https://…"
								class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
								value={draft.linksArchive ?? ''}
								oninput={(e) =>
									update('linksArchive', (e.currentTarget as HTMLInputElement).value || undefined)}
							/>
						</label>
					</div>
				</div>

				<!-- ── Group 3: Source Bercot originale ── -->
				<div class="border-t border-border pt-4">
					<p class="mb-2 font-ui text-[10px] uppercase tracking-wider text-muted">
						Source Bercot originale
					</p>
					<fieldset class="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
						<legend class="sr-only">Métadonnées Bercot originales</legend>

						<label class="block">
							<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
								>Entrée du dictionnaire</span
							>
							<input
								type="text"
								class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
								value={draft.sourceEntry}
								oninput={(e) => update('sourceEntry', (e.currentTarget as HTMLInputElement).value)}
							/>
						</label>

						<label class="block">
							<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
								>Sous-section</span
							>
							<input
								type="text"
								class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
								value={draft.subsection ?? ''}
								oninput={(e) =>
									update('subsection', (e.currentTarget as HTMLInputElement).value || undefined)}
							/>
						</label>

						<label class="block">
							<span class="font-ui text-[10px] uppercase tracking-wider text-muted"
								>Attribution brute Bercot</span
							>
							<input
								type="text"
								class="mt-1 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
								value={draft.attribution}
								oninput={(e) => update('attribution', (e.currentTarget as HTMLInputElement).value)}
							/>
						</label>
					</fieldset>
				</div>

				<!-- ── Group 4: Classification ── -->
				<div class="border-t border-border pt-4 space-y-3">
					<!-- Topics -->
					<div>
						<p class="font-ui text-[10px] uppercase tracking-wider text-muted">Sujets rattachés</p>
						<div class="mt-1 max-h-40 overflow-y-auto rounded border border-border bg-panel p-2">
							{#each topicFlat as { topic: t, depth } (t.id)}
								<label
									class="flex items-center gap-2 py-0.5 text-sm"
									style={`padding-left: ${depth * 1}rem`}
								>
									<input
										type="checkbox"
										checked={draft.mappedTopicIds.includes(t.id)}
										onchange={() => toggleTopic(t.id)}
									/>
									<span class:text-muted={depth > 0}
										><span aria-hidden="true">{depth > 0 ? '↳ ' : ''}</span>{t.label}</span
									>
								</label>
							{/each}
						</div>
					</div>

					<!-- Status chips -->
					<div>
						<p class="font-ui text-[10px] uppercase tracking-wider text-muted">Statut</p>
						<div class="mt-1.5 flex flex-wrap gap-1.5 text-xs">
							{#each STATUS as s (s)}
								<button
									type="button"
									onclick={() => update('status', s)}
									class={[
										'rounded border px-2.5 py-1 font-ui text-[11px] transition-colors',
										draft.status === s
											? STATUS_ACTIVE[s]
											: 'border-border text-muted hover:bg-subtle/10'
									]}
								>
									{STATUS_LABEL[s]}
								</button>
							{/each}
						</div>
					</div>

					<!-- Notes -->
					<label class="block">
						<span class="font-ui text-[10px] uppercase tracking-wider text-muted">Notes</span>
						<textarea
							class="mt-1 h-16 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
							value={draft.notes ?? ''}
							oninput={(e) =>
								update('notes', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
						></textarea>
					</label>
				</div>
			</section>
		</div>

		<!-- ── Footer ── -->
		<footer
			class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-background px-4 py-3"
		>
			<!-- Save -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={save}
					disabled={!dirty || saving}
					class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
				>
					{saving ? 'Enregistrement…' : 'Enregistrer'}
				</button>
				<kbd
					class="rounded border border-border bg-panel px-1.5 py-0.5 font-ui text-[10px] text-muted"
					>⌘ S</kbd
				>
				{#if saving}
					<span
						class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
						aria-label="Enregistrement en cours"
					></span>
				{/if}
			</div>

			<!-- Status/dirty indicators -->
			<div class="flex items-center gap-2">
				{#if dirty}
					<span class="font-ui text-xs text-amber-600">● modifié</span>
				{/if}
				{#if saveError}
					<span class="text-xs text-red-600">{saveError}</span>
				{/if}
			</div>

			<span class="flex-1"></span>

			<!-- Nav hints -->
			<div class="flex items-center gap-1.5 text-muted">
				<kbd
					class="rounded border border-border bg-panel px-1.5 py-0.5 font-ui text-[10px] text-muted"
					>⌘ ←</kbd
				>
				<span class="font-ui text-[10px]">/</span>
				<kbd
					class="rounded border border-border bg-panel px-1.5 py-0.5 font-ui text-[10px] text-muted"
					>⌘ →</kbd
				>
				<span class="font-ui text-[10px] text-muted">nav · Esc ferme</span>
			</div>

			<!-- Publish -->
			<button
				type="button"
				onclick={publish}
				disabled={!canPublish || saving || draft.status === 'published'}
				class="rounded border border-border bg-emerald-700 px-4 py-1 font-ui text-sm text-white disabled:opacity-40"
				title={canPublish
					? 'Crée un Quote en draft'
					: 'Requis : traduction, auteur, sujet(s), statut « retenu »'}
			>
				Publier sur le site
			</button>
		</footer>
	</div>
</div>
