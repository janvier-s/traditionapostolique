<script lang="ts">
  import type { Topic } from '$lib/schema';

  let { root, onApply }: {
    root: Topic;
    onApply: (form: {
      themeLabel: string;
      themeSlug: string;
      primaryLabel: string;
      primarySlug: string;
    }) => Promise<boolean | void>;
  } = $props();

  // svelte-ignore state_referenced_locally
  let themeLabel = $state(root.label);
  // svelte-ignore state_referenced_locally
  let themeSlug = $state(root.slug);
  // svelte-ignore state_referenced_locally
  let primaryLabel = $state(root.label);
  // svelte-ignore state_referenced_locally
  let primarySlug = $state(root.slug + '-general');
  let busy = $state(false);
  let applied = $state(false);

  async function apply() {
    busy = true;
    try {
      const ok = await onApply({ themeLabel, themeSlug, primaryLabel, primarySlug });
      if (ok !== false) applied = true;
    } finally {
      busy = false;
    }
  }
</script>

{#if applied}
  <p class="mt-2 text-sm text-emerald-700">✓ Conversion appliquée</p>
{:else}
  <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
    <label class="block">
      Label du thème
      <input
        class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
        bind:value={themeLabel}
      />
    </label>
    <label class="block">
      Slug du thème
      <input
        class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
        bind:value={themeSlug}
      />
    </label>
    <label class="block">
      Label de l'aspect principal
      <input
        class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
        bind:value={primaryLabel}
      />
    </label>
    <label class="block">
      Slug de l'aspect principal
      <input
        class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
        bind:value={primarySlug}
      />
    </label>
  </div>
  <button
    type="button"
    disabled={busy}
    class="mt-3 rounded border border-border bg-accent px-3 py-1 font-ui text-sm text-white disabled:opacity-50"
    onclick={apply}
  >
    {busy ? 'Application…' : 'Convertir en thème'}
  </button>
{/if}
