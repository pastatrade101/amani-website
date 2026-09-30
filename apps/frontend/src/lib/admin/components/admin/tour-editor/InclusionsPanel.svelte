<script lang="ts">
  import ListEditor from './ListEditor.svelte';
  import { EXCLUSION_SUGGESTIONS, INCLUSION_SUGGESTIONS, LIMITS, MAX_LIST_ITEMS, type TourEditorForm } from './model';

  export let form: TourEditorForm;
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-3">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">What's included</p>
      <p class="mt-1 text-xs text-ink/55">One item per line, in the order travellers should read them. Suggestions are only added when you click them.</p>
    </div>
    <ListEditor
      bind:items={form.inclusions}
      label="Inclusion"
      tone="include"
      placeholder="e.g. Park entry and conservation fees"
      max={MAX_LIST_ITEMS}
      maxLength={LIMITS.listItem}
      limitNote="the tour page lists them side by side, so keep to what matters."
      suggestions={INCLUSION_SUGGESTIONS}
      addLabel="Add inclusion"
    />
  </section>

  <section class="cms-form-section grid gap-3">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">What's not included</p>
      <p class="mt-1 text-xs text-ink/55">Anything travellers pay for separately, so the price is never a surprise.</p>
    </div>
    <ListEditor
      bind:items={form.exclusions}
      label="Exclusion"
      tone="exclude"
      placeholder="e.g. International flights"
      max={MAX_LIST_ITEMS}
      maxLength={LIMITS.listItem}
      limitNote="the tour page lists them side by side, so keep to what matters."
      suggestions={EXCLUSION_SUGGESTIONS}
      addLabel="Add exclusion"
    />
  </section>
</div>
