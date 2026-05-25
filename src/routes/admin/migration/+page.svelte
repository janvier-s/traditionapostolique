<script lang="ts">
  import type { Topic, Quote, BercotEntry } from '$lib/schema';

  let { data } = $props();
  // svelte-ignore state_referenced_locally
  let topics = $state<Topic[]>(data.topics);
  // svelte-ignore state_referenced_locally
  let quotes = $state<Quote[]>(data.quotes);
  // svelte-ignore state_referenced_locally
  let bercot = $state<BercotEntry[]>(data.bercot);
  let activeBucket = $state<1 | 2 | 3 | 4 | 5>(1);
  let busy = $state(false);
  let lastError = $state<string | null>(null);

  async function applyStep(payload: unknown): Promise<boolean> {
    busy = true;
    lastError = null;
    try {
      const res = await fetch('/admin/api/migration/apply-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        lastError = await res.text();
        return false;
      }
      const next = await res.json();
      topics = next.topics;
      quotes = next.quotes;
      bercot = next.bercot;
      return true;
    } finally {
      busy = false;
    }
  }
</script>

<h1 class="font-heading text-2xl">Migration de la taxonomie</h1>
<p class="mt-2 text-sm text-muted">
  Opération éditoriale ponctuelle : transformer le modèle actuel (47 racines + 99 enfants) en arbre
  Thème → Aspect, en plaçant chaque sujet à sa juste place. Chaque étape est commitable individuellement.
</p>

<nav class="mt-6 flex gap-2 border-b border-border pb-2 text-sm">
  {#each [1, 2, 3, 4, 5] as n (n)}
    <button
      type="button"
      class={[
        'rounded px-3 py-1 font-ui',
        activeBucket === n ? 'bg-accent text-white' : 'hover:bg-subtle/10'
      ]}
      onclick={() => (activeBucket = n as 1 | 2 | 3 | 4 | 5)}
    >
      {n}. {['Profondeur', 'Inversions', 'Orphelins', 'Thèmes', 'Piliers'][n - 1]}
    </button>
  {/each}
</nav>

{#if lastError}
  <p class="mt-3 rounded border border-red-500 bg-red-50/10 p-2 text-sm text-red-600">
    {lastError}
  </p>
{/if}

<section class="mt-6">
  {#if activeBucket === 1}
    <p class="italic text-muted">Bucket 1 (Profondeur) — implémenté dans Task 13.</p>
  {:else if activeBucket === 2}
    <p class="italic text-muted">Bucket 2 (Inversions) — implémenté dans Task 14.</p>
  {:else if activeBucket === 3}
    <p class="italic text-muted">Bucket 3 (Orphelins) — implémenté dans Task 15.</p>
  {:else if activeBucket === 4}
    <p class="italic text-muted">Bucket 4 (Thèmes) — implémenté dans Task 16.</p>
  {:else}
    <p class="italic text-muted">Bucket 5 (Piliers) — implémenté dans Task 17.</p>
  {/if}
</section>
