<script lang="ts">
	import type { Author, BercotEntry, BercotStatus, Topic } from '$lib/schema';
	import { buildTopicTree, flattenTree } from '$lib/admin/topic-tree';

	type Props = {
		entry: BercotEntry;
		entries: BercotEntry[]; // siblings (for prev/next within current filter)
		topics: Topic[];
		authors: Author[];
		onClose: () => void;
		onSaved: (updated: BercotEntry) => void;
		onPublished: (updated: BercotEntry, newQuoteId: number) => void;
		onNavigate: (delta: -1 | 1) => void;
	};
	let { entry, entries, topics, authors, onClose, onSaved, onPublished, onNavigate }: Props =
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
	const authorOptions = $derived(authors.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')));

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
		<header class="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
			<div class="min-w-0">
				<p class="truncate text-[11px] uppercase tracking-wider text-muted">
					{entry.sourceEntry}{entry.subsection ? ` · ${entry.subsection}` : ''}
				</p>
				<p class="truncate text-xs text-muted">{entry.attribution}</p>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => onNavigate(-1)}
					disabled={saving}
					class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10 disabled:opacity-40"
					title="Précédent (⌘/Ctrl + ←)">← Préc</button
				>
				<button
					type="button"
					onclick={() => onNavigate(1)}
					disabled={saving}
					class="rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10 disabled:opacity-40"
					title="Suivant (⌘/Ctrl + →)">Suiv →</button
				>
				<button
					type="button"
					onclick={onClose}
					class="ml-2 rounded border border-border px-2 py-1 text-xs hover:bg-subtle/10"
					title="Fermer (Esc)"
					aria-label="Fermer">✕</button
				>
			</div>
		</header>

		<div class="grid flex-1 grid-cols-2 gap-6 overflow-y-auto p-4">
			<!-- LEFT: read-only context -->
			<section>
				<h3 class="font-ui text-xs uppercase tracking-wider text-muted">
					Texte original (Bercot, EN)
				</h3>
				<p class="mt-2 whitespace-pre-wrap leading-relaxed">{entry.en}</p>
			</section>

			<!-- RIGHT: editable -->
			<section class="space-y-3">
				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Traduction française</span
					>
					<textarea
						class="mt-1 h-48 w-full rounded border border-border bg-panel px-2 py-1 leading-relaxed"
						value={draft.fr ?? ''}
						oninput={(e) => update('fr', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted"
						>Auteur (auteurs.json)</span
					>
					<select
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
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

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted"
						>Source originale (URL)</span
					>
					<input
						type="url"
						placeholder="https://…"
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={draft.sourceUrl ?? ''}
						oninput={(e) =>
							update('sourceUrl', (e.currentTarget as HTMLInputElement).value || undefined)}
					/>
				</label>

				<div>
					<p class="font-ui text-xs uppercase tracking-wider text-muted">Sujets rattachés</p>
					<div class="mt-1 max-h-48 overflow-y-auto rounded border border-border bg-panel p-2">
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

				<div>
					<p class="font-ui text-xs uppercase tracking-wider text-muted">Statut</p>
					<div class="mt-1 flex flex-wrap gap-1 text-xs">
						{#each STATUS as s (s)}
							<button
								type="button"
								onclick={() => update('status', s)}
								class={[
									'rounded border border-border px-2 py-1',
									draft.status === s ? 'bg-subtle/20' : 'hover:bg-subtle/10'
								]}
							>
								{STATUS_LABEL[s]}
							</button>
						{/each}
					</div>
				</div>

				<label class="block">
					<span class="font-ui text-xs uppercase tracking-wider text-muted">Notes</span>
					<textarea
						class="mt-1 h-16 w-full rounded border border-border bg-panel px-2 py-1 text-sm"
						value={draft.notes ?? ''}
						oninput={(e) =>
							update('notes', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
					></textarea>
				</label>
			</section>
		</div>

		<footer class="flex items-center gap-3 border-t border-border bg-background px-4 py-3">
			<button
				type="button"
				onclick={save}
				disabled={!dirty || saving}
				class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-white disabled:opacity-50"
			>
				{saving ? 'Enregistrement…' : 'Enregistrer'}
			</button>
			<span class="text-xs text-muted">⌘/Ctrl + S</span>
			<span class="flex-1"></span>
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
			{#if saveError}
				<span class="text-xs text-red-600">{saveError}</span>
			{/if}
			{#if dirty}<span class="text-xs text-amber-600">● modifié</span>{/if}
		</footer>
	</div>
</div>
