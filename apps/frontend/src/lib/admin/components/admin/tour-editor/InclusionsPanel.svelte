<script lang="ts">
  import { ExternalLink, RefreshCw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import type { TourListOption } from '$lib/admin/types';
  import type { TourEditorForm } from './model';
  import TourOptionPicker from './TourOptionPicker.svelte';
  export let form: TourEditorForm;
  export let options: TourListOption[] = [];
  export let loading = false;
  export let onRefresh: () => void = () => {};
</script>
<div class="grid gap-5 cms-form-panel">
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-forest/15 bg-forest/5 p-4">
    <div><p class="text-sm font-semibold text-heading">One library. Every safari.</p><p class="mt-1 text-xs leading-5 text-ink/55">Choose reusable options below. Edit their wording in the shared library to update every linked tour.</p></div>
    <div class="flex gap-2"><Button variant="outline" size="sm" disabled={loading} onclick={onRefresh}><RefreshCw class="size-3.5" />Refresh</Button><Button variant="outline" size="sm" href="/admin/tour-options" target="_blank" rel="noreferrer">Manage options<ExternalLink class="size-3.5" /></Button></div>
  </div>
  <div class="grid items-start gap-5 xl:grid-cols-2">
    <TourOptionPicker kind="inclusion" bind:selected={form.inclusion_ids} {options} {loading} />
    <TourOptionPicker kind="exclusion" bind:selected={form.exclusion_ids} {options} {loading} />
  </div>
</div>
