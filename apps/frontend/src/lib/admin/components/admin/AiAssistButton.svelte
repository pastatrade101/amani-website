<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Check, Loader2, Sparkles, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';

  // Inline AI authoring helper (Phase 7). Renders a small ✨ button that calls
  // the admin assist endpoint and shows a preview; on Insert it dispatches the
  // result so the parent applies it to the field(s).
  export let task: string;
  export let label = 'AI';
  export let getContext: () => Record<string, unknown> = () => ({});
  export let getText: () => string = () => '';

  type Result = { task: string; text?: string; items?: string[]; seo_title?: string; meta_description?: string };
  const dispatch = createEventDispatcher<{ apply: Result }>();

  let open = false;
  let loading = false;
  let error = '';
  let result: Result | null = null;

  const run = async () => {
    open = true;
    loading = true;
    error = '';
    result = null;
    try {
      const res = await api.aiTravelAdvisor.assist({ task, text: getText(), context: getContext() });
      result = res.data as Result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'AI request failed.';
    } finally {
      loading = false;
    }
  };

  const close = () => {
    open = false;
    result = null;
    error = '';
  };
  const apply = () => {
    if (result) dispatch('apply', result);
    close();
  };
</script>

<div class="relative inline-block">
  <CmsButton variant="ghost"
    type="button"
    class="inline-flex items-center gap-1 rounded-full border border-forest/30 bg-forest/5 px-2.5 py-1 text-[11px] font-bold text-forest transition hover:bg-forest hover:text-white disabled:opacity-50"
    onclick={run}
    disabled={loading}
    title="Draft with AI"
  >
    <Sparkles size={12} strokeWidth={2.4} />
    {label}
  </CmsButton>

  {#if open}
    <div class="absolute right-0 z-50 mt-1.5 w-80 rounded-xl border border-ink/15 bg-surface p-3 text-left shadow-sm" transition:fade={{ duration: 100 }}>
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">AI draft · review before inserting</span>
        <CmsButton variant="ghost" type="button" class="text-ink/50 hover:text-ink" onclick={close} aria-label="Close"><X size={14} /></CmsButton>
      </div>

      {#if loading}
        <p class="mt-3 flex items-center gap-2 text-sm text-ink/60"><Loader2 size={15} class="animate-spin" /> Generating…</p>
      {:else if error}
        <p class="mt-3 text-sm text-red-600">{error}</p>
      {:else if result}
        <div class="mt-2 max-h-60 overflow-y-auto text-sm leading-6 text-ink/80">
          {#if result.items?.length}
            <ul class="list-disc pl-4">{#each result.items as it}<li>{it}</li>{/each}</ul>
          {:else if result.seo_title || result.meta_description}
            <p><span class="font-semibold text-ink">Title:</span> {result.seo_title}</p>
            <p class="mt-1"><span class="font-semibold text-ink">Meta:</span> {result.meta_description}</p>
          {:else}
            <p class="whitespace-pre-wrap">{result.text}</p>
          {/if}
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <CmsButton variant="ghost" type="button" class="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-black/5" onclick={close}>Cancel</CmsButton>
          <CmsButton variant="ghost" type="button" class="inline-flex items-center gap-1 rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white transition hover:bg-deep-green" onclick={apply}>
            <Check size={13} strokeWidth={2.6} /> Insert
          </CmsButton>
        </div>
      {/if}
    </div>
  {/if}
</div>
