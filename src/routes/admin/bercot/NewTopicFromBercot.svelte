<script lang="ts">
	import type { BercotEntry, Topic } from '$lib/schema';

	type Props = {
		sourceEntry: string;
		entries: BercotEntry[]; // all Bercot rows from this entry, to attach after save
		topics: Topic[];
		onClose: () => void;
		onCreated: (newTopic: Topic, updatedEntries: BercotEntry[]) => void;
	};
	let { sourceEntry, entries, topics, onClose, onCreated }: Props = $props();

	let label = $state('');
	let slug = $state('');
	let description = $state('');
	let parentId = $state<number | null>(null);
	let saving = $state(false);
	let saveError = $state('');

	const topLevel = $derived(topics.filter((t) => t.parentId == null));

	function autoSlug() {
		slug = label
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-');
	}

	async function create() {
		saveError = '';
		if (!label.trim() || !slug.trim()) {
			saveError = 'Libellé et slug sont requis.';
			return;
		}
		saving = true;
		try {
			const nextId = Math.max(0, ...topics.map((t) => t.id)) + 1;
			const newTopic: Topic = {
				id: nextId,
				slug: slug.trim(),
				label: label.trim(),
				...(description.trim() ? { description: description.trim() } : {}),
				...(parentId != null ? { parentId } : {})
			};

			const nextTopics = [...topics, newTopic];
			const topicsRes = await fetch('/admin/api/topics', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(nextTopics)
			});
			if (!topicsRes.ok) {
				saveError = await topicsRes.text();
				return;
			}

			// Attach all entries from this source to the new topic
			const allBercot = (await fetch('/admin/api/bercot').then((r) => r.json())) as BercotEntry[];
			const updated = allBercot.map((b) =>
				entries.some((e) => e.id === b.id)
					? { ...b, mappedTopicIds: Array.from(new Set([...b.mappedTopicIds, nextId])) }
					: b
			);
			const bercotRes = await fetch('/admin/api/bercot', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated)
			});
			if (!bercotRes.ok) {
				saveError = await bercotRes.text();
				return;
			}
			onCreated(newTopic, updated.filter((b) => entries.some((e) => e.id === b.id)));
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	onclick={onClose}
	role="presentation"
>
	<div
		class="w-full max-w-xl rounded-lg border border-border bg-background p-5 shadow-xl"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="dialog"
		aria-modal="true"
		aria-label="Créer un sujet à partir d'une entrée Bercot"
		tabindex="-1"
	>
		<h2 class="font-heading text-lg">Créer un sujet à partir de « {sourceEntry} »</h2>
		<p class="mt-1 text-xs text-muted">
			Le nouveau sujet sera créé puis les {entries.length} citation(s) de cette entrée Bercot y seront rattachées.
		</p>

		<div class="mt-4 space-y-3 text-sm">
			<label class="block">
				Libellé (français)
				<input
					class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
					bind:value={label}
					onblur={() => !slug && autoSlug()}
				/>
			</label>
			<label class="block">
				Slug (URL)
				<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1" bind:value={slug} />
			</label>
			<label class="block">
				Description (optionnelle)
				<textarea
					class="mt-1 h-20 w-full rounded border border-border bg-panel px-2 py-1"
					bind:value={description}
				></textarea>
			</label>
			<fieldset class="rounded border border-border p-3">
				<legend class="px-1 text-xs uppercase tracking-wider text-muted">Place dans la hiérarchie</legend>
				<label class="block text-sm">
					Parent
					<select
						class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={parentId ?? ''}
						onchange={(e) => {
							const v = (e.currentTarget as HTMLSelectElement).value;
							parentId = v === '' ? null : Number(v);
						}}
					>
						<option value="">(racine — sujet de premier niveau)</option>
						{#each topLevel as t (t.id)}
							<option value={t.id}>{t.label}</option>
						{/each}
					</select>
				</label>
			</fieldset>
		</div>

		{#if saveError}<p class="mt-3 text-sm text-red-600">{saveError}</p>{/if}

		<div class="mt-5 flex justify-end gap-2">
			<button type="button" onclick={onClose} class="rounded border border-border px-3 py-1 text-sm"
				>Annuler</button
			>
			<button
				type="button"
				onclick={create}
				disabled={saving}
				class="rounded border border-border bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
			>
				{saving ? 'Création…' : 'Créer le sujet'}
			</button>
		</div>
	</div>
</div>
