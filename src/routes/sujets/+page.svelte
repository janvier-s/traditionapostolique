<script lang="ts">
  import { buildPublicTree } from '$lib/data';
  import MetaTags from '$lib/components/ui/MetaTags.svelte';

  const columns = buildPublicTree();
  const totalTopics = columns.reduce((n, c) => n + c.items.length, 0);
</script>

<MetaTags
  title="Sujets"
  fullTitle="Les sujets traités dans la Tradition Apostolique"
  description="Index thématique de la Tradition Apostolique : les principaux articles de la foi chrétienne traités par les Pères de l'Église — Dieu, le Christ, l'Église, les sacrements, la morale, la fin des temps."
/>

<article style="--author-col: 200px; --quote-gap: 3rem;">
  <header
    class="mb-12 grid grid-cols-1 gap-x-[var(--quote-gap)] md:grid-cols-[var(--author-col)_1fr]"
  >
    <div></div>
    <div>
      <h1
        class="font-heading italic text-accent leading-[1.1]"
        style="font-size: clamp(2.25rem, 3.6vw, 3rem);"
      >
        Les Sujets
      </h1>
      <p class="mt-3 label-meta">{totalTopics} sujets</p>
      <p class="mt-3 max-w-prose font-body text-base leading-[1.6] text-foreground">
        Cet index thématique rassemble les principaux articles de la foi chrétienne tels que les ont
        traités les Pères de l'Église : Dieu, le Christ, l'Église, les sacrements, la morale, la fin
        des temps.
      </p>
    </div>
  </header>

  <div class="grid grid-cols-1 gap-x-[var(--quote-gap)] gap-y-12 md:grid-cols-2 xl:grid-cols-4">
    {#each columns as col (col.pillar)}
      <section id={`pillar-${col.pillar}`}>
        <h2 class="font-heading italic text-accent leading-[1.1]" style="font-size: 1.5rem;">
          {col.label}
        </h2>
        <p class="label-meta mt-1">{col.subtitle}</p>
        <ul class="mt-4 space-y-1">
          {#each col.items as item (item.id)}
            <li
              class="flex items-baseline justify-between gap-2"
              class:pl-4={item.parentLabel}
            >
              <a
                href={item.href}
                class="min-w-0 font-body text-foreground hover:text-accent"
                class:font-semibold={item.isTheme}
              >
                {#if item.parentLabel}<span class="text-muted" aria-hidden="true">↳ </span>{/if}
                {item.label}
              </a>
              <span class="shrink-0 font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
                {item.count || '—'}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</article>
