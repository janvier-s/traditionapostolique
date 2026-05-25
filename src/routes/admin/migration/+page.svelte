<script lang="ts">
  import type { Topic, Quote, BercotEntry } from '$lib/schema';
  import ThemeConversionForm from './ThemeConversionForm.svelte';

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
    {@const violations = topics.filter((t) => {
      if (t.parentId == null) return false;
      const parent = topics.find((x) => x.id === t.parentId);
      return parent != null && parent.parentId != null;
    })}
    {#if violations.length === 0}
      <p class="rounded border border-emerald-600/40 bg-emerald-50/10 p-3 text-sm text-emerald-700">
        ✓ Aucune violation de profondeur ≥ 2.
      </p>
    {:else}
      <p class="text-sm text-muted">{violations.length} violation(s) détectée(s).</p>
      <ul class="mt-4 space-y-3">
        {#each violations as v (v.id)}
          {@const parent = topics.find((x) => x.id === v.parentId)}
          {@const grandparent = parent ? topics.find((x) => x.id === parent.parentId) : undefined}
          <li class="rounded border border-border bg-panel/30 p-3">
            <p class="text-sm">
              <strong>{v.label}</strong> (id {v.id}) → parent {parent?.label} (id {parent?.id}) →
              grand-parent {grandparent?.label} (id {grandparent?.id})
            </p>
            <p class="mt-1 text-xs text-muted">
              Proposition : re-parenter <strong>{v.label}</strong> sous {grandparent?.label} (frère
              de {parent?.label}).
            </p>
            <button
              type="button"
              disabled={busy}
              class="mt-2 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
              onclick={() =>
                applyStep({
                  kind: 'reparent',
                  topicId: v.id,
                  newParentId: grandparent?.id ?? null
                })}
            >
              Appliquer
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if activeBucket === 2}
    {@const KNOWN_INVERSIONS = [
      {
        parentId: 10,
        childId: 71,
        reason: '« Les Saintes Écritures » est plus général que « Le canon des Écritures »'
      },
      {
        parentId: 19,
        childId: 97,
        reason: '« Le péché » est plus général que « Le péché mortel »'
      }
    ]}
    {@const stillInverted = KNOWN_INVERSIONS.filter((inv) => {
      const child = topics.find((t) => t.id === inv.childId);
      return child != null && child.parentId === inv.parentId;
    })}
    {#if stillInverted.length === 0}
      <p class="rounded border border-emerald-600/40 bg-emerald-50/10 p-3 text-sm text-emerald-700">
        ✓ Aucune inversion détectée parmi celles connues.
      </p>
    {:else}
      <ul class="mt-4 space-y-3">
        {#each stillInverted as inv (inv.childId)}
          {@const parent = topics.find((t) => t.id === inv.parentId)}
          {@const child = topics.find((t) => t.id === inv.childId)}
          <li class="rounded border border-border bg-panel/30 p-3">
            <p class="text-sm">
              <strong>{child?.label}</strong> est enfant de <strong>{parent?.label}</strong>.
            </p>
            <p class="mt-1 text-xs text-muted">{inv.reason}</p>
            <p class="mt-1 text-xs text-muted">
              Proposition : permuter — {child?.label} devient parent ; {parent?.label} devient son
              aspect.
            </p>
            <button
              type="button"
              disabled={busy}
              class="mt-2 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
              onclick={() =>
                applyStep({
                  kind: 'swap-parent-child',
                  parentId: inv.parentId,
                  childId: inv.childId
                })}
            >
              Permuter
            </button>
          </li>
        {/each}
      </ul>
      <p class="mt-3 text-xs italic text-amber-700">
        Note : la permutation déclenche la validation stricte (un thème ne peut pas porter de
        citations directes). Si l'opération échoue, il faudra d'abord convertir le parent en thème
        via le Bucket 4.
      </p>
    {/if}
  {:else if activeBucket === 3}
    {@const ORPHAN_PROPOSALS = [
      { orphanId: 88, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 89, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 90, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 91, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 92, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 93, targetThemeLabel: 'Hérésies', targetThemeSlug: 'heresies' },
      { orphanId: 136, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
      { orphanId: 137, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
      { orphanId: 135, targetThemeLabel: 'Discipline chrétienne', targetThemeSlug: 'discipline-chretienne' },
      { orphanId: 133, targetThemeLabel: 'Justice et devoir', targetThemeSlug: 'justice-et-devoir' },
      { orphanId: 134, targetThemeLabel: 'Justice et devoir', targetThemeSlug: 'justice-et-devoir' },
      { orphanId: 132, targetThemeLabel: 'Loi morale', targetThemeSlug: 'loi-morale' },
      { orphanId: 130, targetThemeLabel: 'Superstition', targetThemeSlug: 'superstition' },
      { orphanId: 131, targetThemeLabel: 'Marie et les saints', targetThemeSlug: 'marie-et-les-saints' },
      { orphanId: 142, targetThemeLabel: 'Les sacrements', targetThemeSlug: 'les-sacrements' },
      { orphanId: 146, targetThemeLabel: 'Anthropologie chrétienne', targetThemeSlug: 'anthropologie-chretienne' }
    ]}
    <p class="text-sm text-muted">
      Suggestions de placement pour les racines orphelines (ajoutées récemment, encore sans thème).
      Vue en lecture seule en v1.
    </p>
    <p class="mt-2 text-xs text-amber-700">
      ⚠️ Ce bucket nécessite que les thèmes cibles existent. Exécuter d'abord les conversions du
      Bucket 4 qui créent ces thèmes via leurs aspects principaux. Ensuite, re-parenter chaque
      orphelin manuellement via <a class="underline" href="/admin/sujets">/admin/sujets</a>.
    </p>
    <ul class="mt-4 space-y-2">
      {#each ORPHAN_PROPOSALS as p (p.orphanId)}
        {@const orphan = topics.find((t) => t.id === p.orphanId)}
        {#if orphan && orphan.parentId == null}
          <li class="rounded border border-border bg-panel/30 p-2 text-sm">
            <span class="font-semibold">{orphan.label}</span>
            <span class="text-muted"> → thème « {p.targetThemeLabel} »</span>
          </li>
        {/if}
      {/each}
    </ul>
  {:else if activeBucket === 4}
    {@const rootsToConvert = topics
      .filter((t) => {
        if (t.parentId != null) return false;
        const hasChildren = topics.some((x) => x.parentId === t.id);
        const directQuoteCount = quotes.filter((q) => q.topicIds.includes(t.id)).length;
        return hasChildren && directQuoteCount > 0;
      })
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id)}
    <p class="text-sm text-muted">
      {rootsToConvert.length} racines avec enfants ET citations directes — à convertir en thèmes.
      Chaque conversion crée un « aspect principal » qui prendra les citations directes du parent.
    </p>
    <ul class="mt-4 space-y-4">
      {#each rootsToConvert as root (root.id)}
        {@const directQuoteCount = quotes.filter((q) => q.topicIds.includes(root.id)).length}
        {@const childCount = topics.filter((t) => t.parentId === root.id).length}
        <li class="rounded border border-border bg-panel/30 p-3">
          <p class="font-semibold">
            {root.label} <span class="text-xs font-normal text-muted">(id {root.id})</span>
          </p>
          <p class="mt-1 text-xs text-muted">
            {directQuoteCount} citation(s) directe(s) · {childCount} enfant(s) actuel(s)
          </p>
          <ThemeConversionForm
            {root}
            onApply={async (form) =>
              applyStep({
                kind: 'convert-root-to-theme',
                rootId: root.id,
                primaryAspect: {
                  slug: form.primarySlug,
                  label: form.primaryLabel
                },
                themeSlugOverride: form.themeSlug !== root.slug ? form.themeSlug : undefined,
                themeLabel: form.themeLabel !== root.label ? form.themeLabel : undefined
              })}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="italic text-muted">Bucket 5 (Piliers) — implémenté dans Task 17.</p>
  {/if}
</section>
