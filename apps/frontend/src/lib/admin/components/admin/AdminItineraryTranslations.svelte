<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import { Input as CmsInput } from '$lib/components/ui/input';

  /**
   * Translating a day-by-day itinerary.
   *
   * The existing translation tabs handle one record at a time, which is right
   * for a tour or a lodge. An itinerary is twelve records that only make sense
   * read in order — opening twelve separate editors to translate one trip is
   * how a half-translated itinerary happens, because nobody can see which day
   * they stopped at.
   *
   * So this shows the whole trip at once, English beside the translation, one
   * row per day. The source is always visible and never editable: the job here
   * is to say the same thing in another language, not to rewrite the trip.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { AlertTriangle, Check, ChevronDown, Copy, Languages, Loader2, Sparkles, Wand2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminRichText from './AdminRichText.svelte';
  import { toPlainText } from '$lib/admin/richText';

  /** Days in order, as the itinerary editor already has them. */
  export let days: Array<Record<string, any>> = [];

  const dispatch = createEventDispatcher<{ toast: { message: string; type?: 'success' | 'error' } }>();
  const toast = (message: string, type: 'success' | 'error' = 'success') => dispatch('toast', { message, type });

  type Language = { code: string; name: string; native_name?: string; enabled?: boolean; is_default?: boolean };

  /** Matches the itinerary_days entry in the backend's translatable registry. */
  type Field = { key: string; label: string; kind: 'text' | 'textarea' | 'rich'; required?: boolean };

  const FIELDS: Field[] = [
    { key: 'title', label: 'Day title', kind: 'text', required: true },
    { key: 'description', label: 'What happens that day', kind: 'rich', required: true },
    { key: 'accommodation', label: 'Where they stay', kind: 'text' },
    { key: 'meals', label: 'Meals included', kind: 'text' },
    { key: 'activities', label: 'Activities', kind: 'textarea' }
  ];

  let languages: Language[] = [];
  let active = '';
  let loading = true;
  let loadingDays = false;
  let savingDay = '';
  let busyDay = '';

  /** dayId -> { field -> value } for the language being edited. */
  let drafts: Record<string, Record<string, string>> = {};
  /** dayId -> saved status, so a row can show whether it is live. */
  let statuses: Record<string, string> = {};
  let openDays: Record<string, boolean> = {};

  $: sortedDays = [...days].sort((a, b) => Number(a.day_number) - Number(b.day_number));
  $: activeLanguage = languages.find((l) => l.code === active) ?? null;

  onMount(async () => {
    try {
      const res = await api.translations.languages();
      const all = (res.data ?? []) as Language[];
      languages = all.filter((l) => l.enabled && !l.is_default);
      active = languages[0]?.code ?? '';
      if (active) await loadLanguage(active);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load languages.', 'error');
    } finally {
      loading = false;
    }
  });

  /**
   * Pull every day's translation for one language in parallel.
   *
   * The API is per-record, so this is n requests — acceptable for an itinerary
   * (rarely more than about fifteen days) and far better than making an editor
   * open each day themselves.
   */
  const loadLanguage = async (code: string) => {
    if (!code) return;
    loadingDays = true;
    const nextDrafts: Record<string, Record<string, string>> = {};
    const nextStatuses: Record<string, string> = {};
    try {
      await Promise.all(
        sortedDays.map(async (day) => {
          const id = String(day.id);
          try {
            const res = await api.translations.forEntity('itinerary_days', id);
            // The API returns translations KEYED BY LANGUAGE CODE, not as an
            // array. Treating it as a list silently found nothing and every
            // day looked untranslated no matter what had been saved.
            const byCode = ((res.data as any)?.translations ?? {}) as Record<string, any>;
            const row = byCode[code];
            nextDrafts[id] = Object.fromEntries(FIELDS.map((f) => [f.key, String(row?.fields?.[f.key] ?? '')]));
            nextStatuses[id] = String(row?.translation_status ?? 'not_started');
          } catch {
            nextDrafts[id] = Object.fromEntries(FIELDS.map((f) => [f.key, '']));
            nextStatuses[id] = 'not_started';
          }
        })
      );
      drafts = nextDrafts;
      statuses = nextStatuses;
    } finally {
      loadingDays = false;
    }
  };

  const switchLanguage = async (code: string) => {
    active = code;
    await loadLanguage(code);
  };

  const sourceValue = (day: Record<string, any>, key: string) => String(day?.[key] ?? '');

  /** A day counts as done when every required field has something in it. */
  const dayComplete = (id: string) =>
    FIELDS.filter((f) => f.required).every((f) => (drafts[id]?.[f.key] ?? '').trim().length > 0);

  $: doneCount = sortedDays.filter((d) => dayComplete(String(d.id))).length;
  $: allDone = sortedDays.length > 0 && doneCount === sortedDays.length;

  const saveDay = async (day: Record<string, any>, publish: boolean) => {
    const id = String(day.id);
    if (savingDay) return;
    savingDay = id;
    try {
      await api.translations.save('itinerary_days', id, active, {
        fields: drafts[id] ?? {},
        translation_status: publish ? 'published' : 'draft'
      });
      statuses[id] = publish ? 'published' : 'draft';
      statuses = statuses;
      toast(`Day ${day.day_number} ${publish ? 'published' : 'saved'}.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save that day.', 'error');
    } finally {
      savingDay = '';
    }
  };

  /** Copy the English across, so the editor overwrites rather than retypes. */
  const copyDay = async (day: Record<string, any>) => {
    const id = String(day.id);
    busyDay = id;
    try {
      const res = await api.translations.copyFromDefault('itinerary_days', id, active);
      const fields = ((res.data as any)?.fields ?? {}) as Record<string, string>;
      drafts[id] = Object.fromEntries(FIELDS.map((f) => [f.key, String(fields[f.key] ?? sourceValue(day, f.key))]));
      drafts = drafts;
      toast(`Day ${day.day_number} filled with the English text — translate over it.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not copy that day.', 'error');
    } finally {
      busyDay = '';
    }
  };

  const aiDay = async (day: Record<string, any>) => {
    const id = String(day.id);
    busyDay = id;
    try {
      const res = await api.translations.aiTranslate('itinerary_days', id, active);
      const fields = ((res.data as any)?.fields ?? {}) as Record<string, string>;
      if (!Object.keys(fields).length) {
        toast('Nothing came back from the translator. Check it is configured.', 'error');
        return;
      }
      drafts[id] = Object.fromEntries(FIELDS.map((f) => [f.key, String(fields[f.key] ?? '')]));
      drafts = drafts;
      toast(`Day ${day.day_number} drafted — read it before publishing.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Translation failed.', 'error');
    } finally {
      busyDay = '';
    }
  };

  /** Whole trip in one go, sequentially so the provider is not hammered. */
  let bulkRunning = false;
  const aiAll = async () => {
    if (bulkRunning) return;
    bulkRunning = true;
    let ok = 0;
    try {
      for (const day of sortedDays) {
        if (dayComplete(String(day.id))) continue;
        await aiDay(day);
        ok += 1;
      }
      toast(ok ? `Drafted ${ok} ${ok === 1 ? 'day' : 'days'}. Read them before publishing.` : 'Every day already has a translation.');
    } finally {
      bulkRunning = false;
      busyDay = '';
    }
  };

  const publishAll = async () => {
    if (bulkRunning) return;
    bulkRunning = true;
    let ok = 0;
    try {
      for (const day of sortedDays) {
        if (!dayComplete(String(day.id))) continue;
        await saveDay(day, true);
        ok += 1;
      }
      toast(`Published ${ok} ${ok === 1 ? 'day' : 'days'}.`);
    } finally {
      bulkRunning = false;
    }
  };

  const toggle = (id: string) => (openDays = { ...openDays, [id]: !openDays[id] });

  const field = 'h-10 w-full min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const area = 'w-full rounded-md border border-ink/15 bg-surface px-3 py-2.5 text-sm leading-6 text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const srcBox = 'rounded-md border border-ink/10 bg-sand/25 px-3 py-2.5 text-sm leading-6 text-ink/70';
</script>

<section class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <Languages size={17} class="text-forest" />
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Translate this itinerary</p>
      </div>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
        The whole trip on one screen, English beside the translation. Only what a traveller reads is here — the day number, photo and
        linked lodge are the same in every language.
      </p>
    </div>
  </div>

  {#if loading}
    <p class="flex items-center gap-2 py-3 text-sm text-ink/50"><Loader2 size={15} class="animate-spin" /> Loading languages…</p>
  {:else if !languages.length}
    <p class="rounded-md border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
      No other languages are switched on yet. Enable one under Translations first.
    </p>
  {:else if !sortedDays.length}
    <p class="rounded-md border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
      This tour has no itinerary days yet. Add the days first, then translate them.
    </p>
  {:else}
    <!-- Language picker, with progress against the language being edited. -->
    <div class="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-3">
      {#each languages as lang}
        <CmsButton variant="ghost"
          class="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-bold transition
            {active === lang.code ? 'bg-forest text-white' : 'border border-ink/15 bg-surface text-heading hover:bg-sand/50'}"
          type="button"
          onclick={() => switchLanguage(lang.code)}
        >
          {lang.native_name || lang.name}
          <span class="opacity-60">{lang.code.toUpperCase()}</span>
        </CmsButton>
      {/each}

      <span class="ml-auto flex items-center gap-2">
        <span class="text-xs font-semibold {allDone ? 'text-emerald-600' : 'text-ink/55'}">
          {doneCount} of {sortedDays.length} days done
        </span>
        <span class="h-1.5 w-24 overflow-hidden rounded-full bg-ink/10">
          <span
            class="block h-full rounded-full transition-all {allDone ? 'bg-emerald-500' : 'bg-goldfinch-gold'}"
            style={`width: ${sortedDays.length ? (doneCount / sortedDays.length) * 100 : 0}%`}
          ></span>
        </span>
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <CmsButton variant="ghost"
        class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/25 bg-surface px-3 text-xs font-bold text-forest transition hover:bg-sand/50 disabled:opacity-50"
        type="button"
        disabled={bulkRunning || loadingDays}
        onclick={aiAll}
      >
        {#if bulkRunning}<Loader2 size={13} class="animate-spin" />{:else}<Wand2 size={13} />{/if}
        Draft every remaining day
      </CmsButton>
      <CmsButton variant="ghost"
        class="inline-flex h-9 items-center gap-1.5 rounded-md bg-forest px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        type="button"
        disabled={bulkRunning || loadingDays || doneCount === 0}
        onclick={publishAll}
      >
        <Check size={13} /> Publish the {doneCount} finished {doneCount === 1 ? 'day' : 'days'}
      </CmsButton>
      <!-- Said once, here, rather than repeated on every row. -->
      <span class="text-[11px] leading-5 text-ink/45">
        Machine drafts are a starting point. Nothing reaches the website until it is published.
      </span>
    </div>

    {#if loadingDays}
      <p class="flex items-center gap-2 py-3 text-sm text-ink/50"><Loader2 size={15} class="animate-spin" /> Loading {activeLanguage?.name ?? ''}…</p>
    {:else}
      <div class="grid gap-2">
        {#each sortedDays as day (day.id)}
          {@const id = String(day.id)}
          {@const done = dayComplete(id)}
          {@const live = statuses[id] === 'published'}
          <div class="overflow-hidden rounded-md border {done ? 'border-ink/12' : 'border-goldfinch-gold/40'} bg-surface">
            <CmsButton variant="ghost" class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sand/25" type="button" onclick={() => toggle(id)}>
              <ChevronDown size={16} class={`shrink-0 text-ink/40 transition ${openDays[id] ? 'rotate-180' : ''}`} />
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sand/70 text-[11px] font-bold text-heading">
                {day.day_number}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-heading">{day.title || `Day ${day.day_number}`}</span>
                <span class="block truncate text-[11px] text-ink/45">
                  {drafts[id]?.title?.trim() || 'Not translated yet'}
                </span>
              </span>
              {#if live}
                <span class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live</span>
              {:else if done}
                <span class="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Ready</span>
              {:else}
                <span class="shrink-0 rounded-full bg-goldfinch-gold/20 px-2 py-0.5 text-[10px] font-bold text-heading">To do</span>
              {/if}
            </CmsButton>

            {#if openDays[id]}
              <div class="grid gap-4 border-t border-ink/10 p-4">
                <div class="flex flex-wrap gap-2">
                  <CmsButton variant="ghost"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/15 px-2.5 text-[11px] font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-50"
                    type="button"
                    disabled={busyDay === id}
                    onclick={() => copyDay(day)}><Copy size={12} /> Copy the English</CmsButton
                  >
                  <CmsButton variant="ghost"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md border border-forest/25 px-2.5 text-[11px] font-semibold text-forest transition hover:bg-sand/50 disabled:opacity-50"
                    type="button"
                    disabled={busyDay === id}
                    onclick={() => aiDay(day)}
                  >
                    {#if busyDay === id}<Loader2 size={12} class="animate-spin" />{:else}<Sparkles size={12} />{/if}
                    Draft with AI
                  </CmsButton>
                </div>

                {#each FIELDS as f}
                  {@const source = sourceValue(day, f.key)}
                  <div class="grid gap-2 lg:grid-cols-2 lg:gap-4">
                    <!-- Source, never editable. This screen translates; it does
                         not rewrite the trip. -->
                    <div class="grid gap-1.5">
                      <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40">
                        English · {f.label}{#if f.required}<span class="text-clay"> *</span>{/if}
                      </span>
                      {#if source.trim()}
                        <div class={srcBox}>{toPlainText(source) || source}</div>
                      {:else}
                        <div class="rounded-md border border-dashed border-ink/12 px-3 py-2.5 text-sm italic text-ink/35">
                          Empty in English — nothing to translate.
                        </div>
                      {/if}
                    </div>

                    <div class="grid gap-1.5">
                      <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-forest/70">
                        {activeLanguage?.native_name || activeLanguage?.name} · {f.label}
                      </span>
                      {#if !source.trim()}
                        <div class="rounded-md border border-dashed border-ink/12 px-3 py-2.5 text-sm italic text-ink/35">—</div>
                      {:else if f.kind === 'rich'}
                        <AdminRichText label="" name={`t_${id}_${f.key}`} rows={5} headings="none" bind:value={drafts[id][f.key]} />
                      {:else if f.kind === 'textarea'}
                        <CmsTextarea class={area} rows={3} bind:value={drafts[id][f.key]}></CmsTextarea>
                      {:else}
                        <CmsInput class={field} bind:value={drafts[id][f.key]} />
                      {/if}
                    </div>
                  </div>
                {/each}

                <div class="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 pt-3">
                  {#if !done}
                    <span class="mr-auto flex items-center gap-1.5 text-[11px] text-ink/50">
                      <AlertTriangle size={12} class="text-goldfinch-gold" />
                      The title and the day's description are needed before this can go live.
                    </span>
                  {/if}
                  <CmsButton variant="ghost"
                    class="inline-flex h-9 items-center rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-50"
                    type="button"
                    disabled={savingDay === id}
                    onclick={() => saveDay(day, false)}>Save draft</CmsButton
                  >
                  <CmsButton variant="ghost"
                    class="inline-flex h-9 items-center gap-1.5 rounded-md bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    type="button"
                    disabled={savingDay === id || !done}
                    onclick={() => saveDay(day, true)}
                  >
                    {#if savingDay === id}<Loader2 size={13} class="animate-spin" />{:else}<Check size={13} />{/if}
                    Publish this day
                  </CmsButton>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</section>
