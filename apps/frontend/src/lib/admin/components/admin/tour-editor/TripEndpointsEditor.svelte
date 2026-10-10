<script lang="ts">
  import { MapPin, ArrowRight, ExternalLink } from '@lucide/svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import type { TripPoint } from '$lib/admin/types';
  import type { TourEditorForm } from './model';
  export let form: TourEditorForm;
  export let points: TripPoint[] = [];
  export let loading = false;
  export let attemptedSave = false;
  export let prefix = 'trip';
  const label = (p: TripPoint) => `${p.name}${p.airport_code ? ` (${p.airport_code})` : ''}${p.status === 'draft' ? ' · Draft' : ''}${p.status === 'archived' ? ' · Archived' : ''}`;
  $: startOptions = [{ value: '', label: loading ? 'Loading trip points…' : 'Select a start point' }, ...points.filter(p => ((p.role === 'start' || p.role === 'both') && p.status !== 'archived') || p.id === form.start_trip_point_id).map(p => ({value:p.id, label:label(p)}))];
  $: endOptions = [{ value: '', label: loading ? 'Loading trip points…' : 'Select an end point' }, ...points.filter(p => ((p.role === 'end' || p.role === 'both') && p.status !== 'archived') || p.id === form.end_trip_point_id).map(p => ({value:p.id, label:label(p)}))];
  $: start = points.find(p => p.id === form.start_trip_point_id);
  $: end = points.find(p => p.id === form.end_trip_point_id);
</script>
<section class="rounded-lg border border-forest/15 bg-forest/[0.03] p-4 sm:p-5">
  <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2 text-sm font-semibold text-heading"><MapPin size={16} /> Journey endpoints</div>
    <a href="/admin/trip-points" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">Manage trip points <ExternalLink size={12} /></a>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="grid gap-1.5">
      <AdminSelect label="Start point" name={`${prefix}_start_trip_point_id`} bind:value={form.start_trip_point_id} options={startOptions} />
      <p class="text-xs text-ink/50">Where guests arrive or meet your team. Inherited by the first itinerary day.</p>
      {#if attemptedSave && form.status === 'published' && (!start || start.status !== 'published')}<p class="text-xs font-semibold text-clay">Select a published start point before publishing.</p>{/if}
    </div>
    <div class="grid gap-1.5">
      <AdminSelect label="End point" name={`${prefix}_end_trip_point_id`} bind:value={form.end_trip_point_id} options={endOptions} />
      <p class="text-xs text-ink/50">Where the journey finishes. Inherited by the final itinerary day.</p>
      {#if attemptedSave && form.status === 'published' && (!end || end.status !== 'published')}<p class="text-xs font-semibold text-clay">Select a published end point before publishing.</p>{/if}
    </div>
  </div>
  {#if start || end}
    <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3 text-xs font-semibold text-heading"><span>{start ? label(start) : 'Start not selected'}</span><ArrowRight size={14} /><span>{end ? label(end) : 'End not selected'}</span></div>
  {:else if !loading && !points.length}<p class="mt-4 text-xs text-ink/60">Add airports, cities or meeting places in Trip Points, then select them here.</p>{/if}
</section>
