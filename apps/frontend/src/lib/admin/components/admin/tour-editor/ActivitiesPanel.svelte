<script lang="ts">
  import ActivityRateEditor from './ActivityRateEditor.svelte';
  export let tourId = '';
  import AdminSelect from '../AdminSelect.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import type { TourPriceOption } from '$lib/admin/types';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { ArrowDown, ArrowUp, Binoculars, ExternalLink, X } from '@lucide/svelte';
  import { MAX_ACTIVITIES, moveItem, type ActivityOption, type DestinationOption, type TourEditorForm } from './model';

  /**
   * Catalogue activities (Activities module) this tour includes. Those that
   * happen at the tour's own destinations are offered first, since they are
   * almost always the ones that belong.
   */
  export let form: TourEditorForm;
  export let activities: ActivityOption[] = [];
  export let destinations: DestinationOption[] = [];
  export let loadingOptions = false;
  /** Names from the saved tour, for a linked activity missing from the catalogue list. */
  export let knownNames: Record<string, string> = {};

  export let pricingOptions: TourPriceOption[] = [];
  let search = '';
  const setting = (id: string) => form.activity_settings[id] ?? { is_optional: false, additional_cost: false, pricing_option_id: null };
  const updateSetting = (id: string, patch: Partial<ReturnType<typeof setting>>) => {
    const next = { ...setting(id), ...patch };
    if (!next.is_optional) { next.additional_cost = false; next.pricing_option_id = null; }
    if (!next.additional_cost) next.pricing_option_id = null;
    form.activity_settings = { ...form.activity_settings, [id]: next };
  };
  $: priceChoices = [{ value: 'request', label: 'Price on request' }, ...pricingOptions.filter(p => (p.is_addon || p.price_type === 'upgrade') && ['per_person','per_group','per_child','upgrade'].includes(p.price_type)).map(p => ({value: p.id, label: `${p.title} · ${p.currency || 'USD'} ${p.price} (${p.price_type.replaceAll('_', ' ')})`}))];

  $: byId = new Map(activities.map((activity) => [activity.id, activity]));
  $: nameOf = (id: string) => byId.get(id)?.name ?? knownNames[id] ?? 'Unknown activity';
  $: placeNames = (ids: string[]) =>
    ids
      .map((id) => destinations.find((place) => place.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
  $: atTourPlaces = (activity: ActivityOption) => activity.destination_ids.some((id) => form.destination_ids.includes(id));
  $: matches = activities.filter(
    (activity) =>
      (activity.status !== 'archived' || form.activity_ids.includes(activity.id)) &&
      activity.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  $: nearby = matches.filter(atTourPlaces);
  $: others = matches.filter((activity) => !atTourPlaces(activity));
  $: full = form.activity_ids.length >= MAX_ACTIVITIES;

  const categoryLabel = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : '');
  const hiddenLabel = (status: string) => (status === 'archived' ? 'Archived – hidden on the site' : 'Draft – hidden on the site');

  const toggle = (id: string) => {
    if (form.activity_ids.includes(id)) form.activity_ids = form.activity_ids.filter((item) => item !== id);
    else if (!full) form.activity_ids = [...form.activity_ids, id];
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Tour activities</p>
        <p class="mt-1 text-xs text-ink/55">Shown on the tour page in this order. Tick more below; drafts stay hidden on the site until they are published.</p>
      </div>
      <span class="text-xs font-semibold text-ink/55">{form.activity_ids.length} of {MAX_ACTIVITIES}</span>
    </div>
    {#if form.activity_ids.length}
      <ol class="grid gap-1.5">
        {#each form.activity_ids as id, index (id)}
          {@const activity = byId.get(id)}
          {@const config = form.activity_settings[id] ?? { is_optional: false, additional_cost: false, pricing_option_id: null }}
          <li class="rounded-xl border border-forest/25 bg-forest/5 p-3">
            <div class="flex min-w-0 items-center gap-2">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-heading ring-1 ring-ink/10">{index + 1}</span>
            <div class="min-w-0 flex-1">
              <p class="break-words text-sm font-medium leading-5 text-ink">{nameOf(id)}</p>
              {#if activity && activity.status !== 'published'}<p class="text-[11px] font-semibold text-amber-700">{hiddenLabel(activity.status)}</p>{/if}
            </div>
            <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-md text-ink/60 hover:bg-surface disabled:opacity-30" aria-label={`Move ${nameOf(id)} up`} disabled={index === 0} on:click={() => (form.activity_ids = moveItem(form.activity_ids, index, -1))}><ArrowUp size={14} /></button>
            <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-md text-ink/60 hover:bg-surface disabled:opacity-30" aria-label={`Move ${nameOf(id)} down`} disabled={index === form.activity_ids.length - 1} on:click={() => (form.activity_ids = moveItem(form.activity_ids, index, 1))}><ArrowDown size={14} /></button>
            <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50" aria-label={`Remove ${nameOf(id)}`} on:click={() => toggle(id)}><X size={14} /></button>
            </div>
            <div class="mt-3 grid items-end gap-3 border-t border-ink/10 pt-3 sm:grid-cols-2">
              <AdminSelect label="Activity type" name={`activity-type-${id}`} value={config.is_optional ? 'optional' : 'included'} options={[{value: 'included', label: 'Included in this tour'}, {value: 'optional', label: 'Optional activity'}]} on:change={(event) => updateSetting(id, { is_optional: event.detail === 'optional' })} />
              {#if config.is_optional}
                <div class="flex h-10 items-center justify-between gap-3 text-sm"><span>Additional cost</span><Switch checked={config.additional_cost} onCheckedChange={(checked) => updateSetting(id, { additional_cost: checked })} aria-label={`Additional cost for ${nameOf(id)}`} /></div>
                {#if config.additional_cost}<div class="sm:col-span-2"><AdminSelect label="Tour pricing option" name={`activity-price-${id}`} options={priceChoices} value={config.pricing_option_id || 'request'} on:change={(event) => updateSetting(id, { pricing_option_id: event.detail === 'request' ? null : event.detail })} /><p class="mt-2 text-xs text-ink/55">An optional add-on, separate from the safari starting price.</p><ActivityRateEditor {tourId} activityName={nameOf(id)} rate={pricingOptions.find(rate => rate.id === config.pricing_option_id) ?? null} on:saved={(event) => { pricingOptions = [...pricingOptions.filter(rate => rate.id !== event.detail.id), event.detail]; updateSetting(id,{pricing_option_id:event.detail.id}); }} /></div>{/if}
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">No activities linked yet.</p>
    {/if}
  </section>

  <section class="cms-form-section grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Activity catalogue</p>
      <a class="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/60 hover:text-heading" href="/admin/activities" target="_blank" rel="noopener">Manage activities <ExternalLink size={12} /></a>
    </div>
    {#if loadingOptions && !activities.length}
      <div class="h-24 animate-pulse rounded-md bg-sand/60"></div>
    {:else if !activities.length}
      <div class="cms-builder-intro">
        <span class="cms-builder-icon"><Binoculars size={30} strokeWidth={1.3} /></span>
        <h3>No activities in the catalogue yet</h3>
        <p>Add game drives, balloon safaris, walks and cultural visits under Activities, then link them to this tour here.</p>
      </div>
    {:else}
      <CmsInput
        class="h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm"
        placeholder="Filter activities…"
        bind:value={search}
        onkeydown={(event) => event.key === 'Enter' && event.preventDefault()}
      />
      {#each [{ title: form.destination_ids.length ? "At this safari's destinations" : '', list: nearby }, { title: nearby.length ? 'Other activities' : '', list: others }] as group}
        {#if group.list.length}
          {#if group.title}<p class="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">{group.title}</p>{/if}
          <div class="grid gap-1.5 sm:grid-cols-2">
            {#each group.list as activity (activity.id)}
              {@const picked = form.activity_ids.includes(activity.id)}
              <label class={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition ${picked ? 'border-forest/40 bg-forest/5' : 'border-ink/10 bg-surface'}`}>
                <input type="checkbox" class="h-4 w-4 shrink-0 accent-forest" checked={picked} disabled={!picked && full} on:change={() => toggle(activity.id)} />
                <span class="grid min-w-0 flex-1">
                  <span class="truncate text-sm font-medium text-ink">{activity.name}</span>
                  <span class="truncate text-[11px] text-ink/45">{[categoryLabel(activity.category), placeNames(activity.destination_ids)].filter(Boolean).join(' · ')}</span>
                  {#if activity.status !== 'published'}<span class="text-[11px] font-semibold text-amber-700">{hiddenLabel(activity.status)}</span>{/if}
                </span>
              </label>
            {/each}
          </div>
        {/if}
      {/each}
      {#if !matches.length}<p class="text-sm text-ink/55">No activities match “{search}”.</p>{/if}
    {/if}
  </section>
</div>
