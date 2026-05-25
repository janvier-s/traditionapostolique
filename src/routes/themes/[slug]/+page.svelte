<script lang="ts">
  import MetaTags from '$lib/components/ui/MetaTags.svelte';

  let { data } = $props();
  const totalCount = $derived(
    data.aspects.reduce((n: number, a: { count: number }) => n + a.count, 0)
  );
</script>

<MetaTags
  title={data.theme.label}
  fullTitle={`${data.theme.label} — aperçu thématique`}
  description={data.theme.description ?? `Tous les aspects du thème « ${data.theme.label} » traités par les Pères de l'Église.`}
/>

<article class="mx-auto max-w-3xl px-6 py-12">
  <header class="mb-8">
    <p class="label-meta">Thème</p>
    <h1
      class="font-heading italic text-accent leading-[1.1]"
      style="font-size: clamp(2rem, 3.2vw, 2.75rem);"
    >
      {data.theme.label}
    </h1>
    <p class="mt-3 text-sm text-muted">
      {data.aspects.length} aspects · {totalCount} citations
    </p>
    {#if data.theme.description}
      <p class="mt-4 max-w-prose font-body text-base leading-[1.6] text-foreground">
        {data.theme.description}
      </p>
    {/if}
  </header>

  <ul class="space-y-3">
    {#each data.aspects as a (a.id)}
      <li class="border-b border-border pb-3">
        <a href={`/sujets/${a.slug}`} class="block hover:text-accent">
          <span class="flex items-baseline justify-between gap-2">
            <span class="font-body text-base">
              {a.label}
              {#if a.isPrimary}
                <span class="ml-2 text-[10px] uppercase tracking-wider text-muted">principal</span>
              {/if}
            </span>
            <span class="font-ui text-[11px] font-light uppercase tracking-[0.05em] text-muted">
              {a.count || '—'}
            </span>
          </span>
          {#if a.description}
            <span class="mt-1 block text-sm text-muted">{a.description}</span>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</article>
