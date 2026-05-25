<script lang="ts">
	import type { Pillar, Topic } from '$lib/schema';
	import { buildTopicTree, type TopicNode } from '$lib/admin/topic-tree';

	let { data } = $props();

	const PILLARS: { value: Pillar; label: string; sub: string }[] = [
		{ value: 'credo', label: 'Credo', sub: 'Profession de la foi (CCC I)' },
		{ value: 'sacrements', label: 'Sacrements', sub: 'Célébration du mystère chrétien (CCC II)' },
		{ value: 'vie', label: 'Vie en Christ', sub: 'La vie dans le Christ (CCC III)' },
		{ value: 'priere', label: 'Prière', sub: 'La prière chrétienne (CCC IV)' }
	];

	const tree = $derived(buildTopicTree(data.topics));

	const quotesPerTopic = $derived.by(() => {
		const m = new Map<number, number>();
		for (const q of data.quotes) for (const tid of q.topicIds) m.set(tid, (m.get(tid) ?? 0) + 1);
		return m;
	});

	function descendantQuoteCount(node: TopicNode): number {
		let n = quotesPerTopic.get(node.topic.id) ?? 0;
		for (const child of node.children) n += descendantQuoteCount(child);
		return n;
	}

	const byPillar = $derived.by(() => {
		const groups: { credo: TopicNode[]; sacrements: TopicNode[]; vie: TopicNode[]; priere: TopicNode[]; none: TopicNode[] } = {
			credo: [],
			sacrements: [],
			vie: [],
			priere: [],
			none: []
		};
		for (const node of tree) {
			const k = node.topic.pillar ?? 'none';
			groups[k].push(node);
		}
		return groups;
	});
</script>

<h1 class="font-heading text-2xl">Hiérarchie ({data.topics.length} sujets)</h1>
<p class="mt-2 text-sm text-muted">
	Vue par les quatre piliers du <em>Catéchisme de l'Église catholique</em>. Lecture seule —
	modifiez le pilier d'un sujet depuis <a class="underline-offset-4 hover:underline" href="/admin/sujets">Sujets</a>.
</p>

<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
	{#each PILLARS as p (p.value)}
		<section class="rounded border border-border bg-panel/30 p-3">
			<h2 class="font-heading text-base">{p.label}</h2>
			<p class="text-[11px] uppercase tracking-wider text-muted">{p.sub}</p>
			<p class="mt-1 text-xs text-muted">{byPillar[p.value]?.length ?? 0} sujet(s)</p>
			<ul class="mt-3 space-y-2">
				{#each byPillar[p.value] ?? [] as node (node.topic.id)}
					{@const n = descendantQuoteCount(node)}
					<li>
						<a
							href={`/admin/sujets#row-${node.topic.id}`}
							class="block rounded border border-border bg-background px-2 py-1 hover:bg-subtle/10"
						>
							<span class="flex items-baseline justify-between gap-2 text-sm">
								<span class="min-w-0 truncate">{node.topic.label}{#if node.children.length > 0}<span class="ml-2 rounded bg-subtle/20 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-muted">THÈME</span>{/if}</span>
								<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
							</span>
						</a>
						{#if node.children.length > 0}
							<ul class="ml-3 mt-1 space-y-1 border-l border-border pl-2">
								{#each node.children as child (child.topic.id)}
									{@const cn = quotesPerTopic.get(child.topic.id) ?? 0}
									<li>
										<a
											href={`/admin/sujets#row-${child.topic.id}`}
											class="block rounded px-1 py-0.5 hover:bg-subtle/10"
										>
											<span class="flex items-baseline justify-between gap-2 text-xs">
												<span class="min-w-0 truncate"><span aria-hidden="true">↳ </span>{child.topic.label}{#if child.topic.primary === true}<span class="ml-1 rounded bg-accent/15 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-accent">PRINCIPAL</span>{/if}</span>
												<span class="shrink-0 text-[10px] text-muted">{cn || '—'}</span>
											</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
				{#if byPillar[p.value].length === 0}
					<li class="text-xs italic text-muted">(aucun sujet)</li>
				{/if}
			</ul>
		</section>
	{/each}
	<section class="rounded border border-dashed border-border bg-panel/10 p-3">
		<h2 class="font-heading text-base">Non classé</h2>
		<p class="text-[11px] uppercase tracking-wider text-muted">Sujets sans pilier assigné</p>
		<p class="mt-1 text-xs text-muted">{byPillar.none.length} sujet(s)</p>
		<ul class="mt-3 space-y-2">
			{#each byPillar.none as node (node.topic.id)}
				{@const n = descendantQuoteCount(node)}
				<li>
					<a
						href={`/admin/sujets#row-${node.topic.id}`}
						class="block rounded border border-border bg-background px-2 py-1 hover:bg-subtle/10"
					>
						<span class="flex items-baseline justify-between gap-2 text-sm">
							<span class="min-w-0 truncate">{node.topic.label}</span>
							<span class="shrink-0 text-[11px] text-muted">{n || '—'}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</div>
