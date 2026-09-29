<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import { Input as CmsInput } from '$lib/components/ui/input';

  /**
   * Translating one record — a tour, a category, a destination, a lodge.
   *
   * The previous version asked someone to translate without showing them what
   * they were translating: the English lived in the form above, so the job was
   * scroll up, remember a paragraph, scroll down, type it. The API had been
   * returning the source text the whole time and nothing displayed it.
   *
   * Now it reads the way the itinerary translator does — English on the left,
   * the translation on the right, field by field, with the fields that are
   * still missing marked where they actually are rather than listed by name in
   * a sentence.
   *
   * Same props and the same toast event as before, so every form that mounts
   * this keeps working untouched.
   */
  import { createEventDispatcher } from 'svelte';
  import { AlertTriangle, Check, ChevronDown, Copy, Globe, Loader2, Sparkles } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminRichText from './AdminRichText.svelte';
  import { toPlainText } from '$lib/admin/richText';
  import type { EntityTranslations, TranslationStatus } from '$lib/admin/types';

  export let entityType: string;
  export let entityId: string;
  /**
   * Where the Save/Publish bar pins while the fields scroll past. Raise it on a
   * page whose own save bar floats over the bottom of the window.
   */
  export let stickyOffset = '0px';
  /** Read-only for the page: true while the open language has edits not yet saved. */
  export let unsaved = false;

  const dispatch = createEventDispatcher<{ toast: { message: string; type?: 'success' | 'error' } }>();
  const toast = (message: string, type: 'success' | 'error' = 'success') => dispatch('toast', { message, type });

  let data: EntityTranslations | null = null;
  let active = '';
  let loading = true;
  let busy = '';
  let draft: Record<string, string | string[]> = {};
  // The open language as last loaded or saved, to tell unsaved edits apart.
  let savedSnapshot = '';
  let open = true;

  const STATUS_LABELS: Record<TranslationStatus, string> = {
    not_started: 'Not started',
    draft: 'Draft',
    translated: 'Translated',
    needs_review: 'Needs review',
    published: 'Live'
  };

  const load = async () => {
    loading = true;
    try {
      const res = await api.translations.forEntity(entityType, entityId);
      data = res.data;
      if (!active) active = data.languages.find((l) => !l.is_default && l.enabled)?.code ?? data.default_language;
      pickUp();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to load translations.', 'error');
    } finally {
      loading = false;
    }
  };

  const pickUp = () => {
    if (!data) return;
    draft = structuredClone(data.translations[active]?.fields ?? {});
    for (const field of data.fields) {
      if (draft[field.key] === undefined) draft[field.key] = field.kind === 'rich_list' ? [] : '';
    }
    savedSnapshot = JSON.stringify(draft);
  };

  const selectLanguage = (code: string) => {
    if (code === active) return;
    if (unsaved && !confirm(`Discard your unsaved ${languageName(active)} changes?`)) return;
    active = code;
    pickUp();
  };

  const listToText = (value: string | string[] | undefined): string =>
    (Array.isArray(value) ? value : []).map((item) => item.replace(/<[^>]*>/g, ' ').trim()).filter(Boolean).join('\n');
  const textToList = (value: string): string[] => value.split('\n').map((line) => line.trim()).filter(Boolean);

  /** The English, as readable text — rich fields are shown without their tags. */
  const sourceText = (key: string, kind: string): string => {
    const value = data?.source?.[key];
    if (Array.isArray(value)) return value.map((v) => toPlainText(String(v)) || String(v)).filter(Boolean).join('\n');
    const raw = String(value ?? '');
    if (!raw.trim()) return '';
    return kind === 'rich' ? toPlainText(raw) || raw : raw;
  };

  /**
   * Reactive, so it is rebuilt whenever `draft` changes. As a plain function
   * nothing that called it knew to look again while someone typed: the
   * required-field count and the Publish button stayed on whatever they said
   * when the panel opened, and a finished translation could not be published
   * until it had been saved once as a draft.
   */
  $: filled = (key: string): boolean => {
    const value = draft[key];
    return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0;
  };

  /**
   * The fields worth showing for THIS record.
   *
   * The registry is per entity type, but records of one type are not alike — a
   * homepage section has an eyebrow and a button, or it has neither, and every
   * field it does not use was rendering as a row saying there was nothing to
   * translate. Twelve of those above the two fields that matter is a form
   * nobody reads.
   *
   * A field stays when the source has something to translate, or when this
   * translation already carries text for it, so nothing anyone has typed can
   * be hidden by a later edit to the English. A required field with no English
   * is not shown: there is nothing to translate, so it cannot block publishing.
   */
  $: visibleFields = (data?.fields ?? []).filter(
    (field) => sourceText(field.key, field.kind).trim() || filled(field.key)
  );

  /**
   * Where a new section starts. A safari package lists every block's text —
   * forty or fifty rows — and without a heading at each block it is a column of
   * look-alike fields with no way to tell the FAQ from the route notes.
   */
  $: groupStarts = new Set(
    visibleFields
      .filter((field, index) => field.group && field.group !== visibleFields[index - 1]?.group)
      .map((field) => field.key)
  );

  /**
   * Progress against the required fields that gate publishing — only those the
   * English actually fills (the server applies the same rule). Twelve safari
   * styles have no English short description; requiring a translation of it
   * made them impossible to publish.
   */
  $: requiredFields = (data?.fields ?? []).filter((f) => f.required && sourceText(f.key, f.kind).trim());
  $: doneRequired = requiredFields.filter((f) => filled(f.key)).length;
  $: canPublish =
    doneRequired === requiredFields.length &&
    (requiredFields.length > 0 || visibleFields.some((f) => filled(f.key)));

  const save = async (status: TranslationStatus): Promise<boolean> => {
    if (!data || busy) return false;
    const wasLive = live;
    busy = status;
    try {
      const res = await api.translations.save(entityType, entityId, active, { fields: draft, translation_status: status });
      data.translations[active] = res.data;
      data = data;
      pickUp();
      toast(
        status === 'published'
          ? wasLive
            ? 'Saved — the live page shows the new text.'
            : 'Published — this is now live for that language.'
          : wasLive
            ? `Unpublished — the page shows English in ${languageName(active)} until it is published again.`
            : `Saved as ${STATUS_LABELS[status].toLowerCase()}.`
      );
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to save the translation.', 'error');
      return false;
    } finally {
      busy = '';
    }
  };

  /**
   * Save the open language the way its status implies, for a page's own save
   * button: a live translation stays live, anything else is kept as a draft.
   * A page used to save only its English here and close, dropping the edits.
   */
  export const saveCurrent = (): Promise<boolean> => save(live ? 'published' : 'draft');

  /** Taking a live translation offline is never a side effect of saving. */
  const unpublish = () => {
    if (confirm(`Take the ${languageName(active)} version offline? Visitors will see English until it is published again.`)) void save('draft');
  };

  const copyFromDefault = async () => {
    if (busy) return;
    busy = 'copy';
    try {
      const res = await api.translations.copyFromDefault(entityType, entityId, active);
      data!.translations[active] = res.data;
      data = data;
      pickUp();
      toast('Filled with the English text — translate over it.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Copy failed.', 'error');
    } finally {
      busy = '';
    }
  };

  const aiTranslate = async () => {
    if (busy) return;
    // A machine draft is always saved for review, which takes a live language offline.
    if (live && !confirm(`Drafting with AI saves ${languageName(active)} for review, which takes it offline until you publish it again. Continue?`)) return;
    busy = 'ai';
    try {
      const res = await api.translations.aiTranslate(entityType, entityId, active);
      if (res.data) {
        data!.translations[active] = res.data;
        data = data;
        pickUp();
        toast('Drafted — read it before publishing.');
      } else {
        toast(res.message);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'AI translation failed.', 'error');
    } finally {
      busy = '';
    }
  };

  $: if (entityType && entityId) void load();
  $: activeRecord = data?.translations[active];
  $: live = activeRecord?.translation_status === 'published';
  // Reads `draft` and `savedSnapshot` directly so it recomputes on every keystroke.
  $: unsaved = Boolean(data) && !isDefault && JSON.stringify(draft) !== savedSnapshot;
  $: isDefault = data?.default_language === active;
  $: languageName = (code: string) => data?.languages.find((l) => l.code === code)?.name ?? code;

  const fieldClass =
    'h-10 w-full min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const areaClass =
    'w-full rounded-md border border-ink/15 bg-surface px-3 py-2.5 text-sm leading-6 text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const srcBox = 'whitespace-pre-line rounded-md border border-ink/10 bg-sand/25 px-3 py-2.5 text-sm leading-6 text-ink/70';
</script>

<section class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-4">
  <CmsButton variant="ghost" class="flex items-center gap-2 text-left" type="button" onclick={() => (open = !open)}>
    <ChevronDown size={16} class={`shrink-0 text-ink/40 transition ${open ? 'rotate-180' : ''}`} />
    <Globe size={15} class="text-forest/70" />
    <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Translations</span>
    {#if loading}<Loader2 size={14} class="animate-spin text-ink/40" />{/if}
    {#if data && !isDefault && activeRecord}
      <span class="ml-auto text-xs font-semibold {canPublish ? 'text-emerald-600' : 'text-ink/50'}">
        {languageName(active)} · {doneRequired} of {requiredFields.length} required fields
      </span>
    {/if}
  </CmsButton>

  {#if open}
    {#if data}
      <!-- One chip per language, each saying what state it is in rather than a
           bare tick or percentage that has to be decoded. -->
      <div class="flex flex-wrap gap-1.5 border-b border-ink/10 pb-3" role="tablist" aria-label="Translation languages">
        {#each data.languages.filter((l) => l.enabled) as language (language.code)}
          {@const record = data.translations[language.code]}
          {@const isSource = language.code === data.default_language}
          {@const live = record?.translation_status === 'published'}
          <CmsButton variant="ghost"
            class={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition ${active === language.code ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/70 hover:border-forest/40 hover:text-heading'}`}
            type="button"
            role="tab"
            aria-selected={active === language.code}
            onclick={() => selectLanguage(language.code)}
          >
            {language.name}
            <span
              class={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                active === language.code
                  ? 'bg-white/15 text-white'
                  : isSource || live
                    ? 'bg-emerald-50 text-emerald-700'
                    : record && record.completeness > 0
                      ? 'bg-goldfinch-gold/25 text-heading'
                      : 'bg-ink/[0.06] text-ink/45'
              }`}
            >
              {isSource ? 'Source' : live ? 'Live' : !record || record.translation_status === 'not_started' ? 'To do' : `${record.completeness}%`}
            </span>
            {#if record?.outdated}<AlertTriangle size={12} class="text-clay" />{/if}
          </CmsButton>
        {/each}
      </div>

      {#if isDefault}
        <p class="rounded-xl border border-dashed border-ink/15 px-3 py-3 text-sm text-ink/60">
          {languageName(active)} is the original. It is written in the form above and appears here for the other languages to be translated
          from.
        </p>
      {:else if activeRecord}
        {#if activeRecord.outdated}
          <p class="flex items-start gap-2 rounded-xl border border-clay/25 bg-clay/[0.06] px-3 py-2.5 text-sm text-clay">
            <AlertTriangle size={15} class="mt-0.5 shrink-0" />
            The English has changed since this was translated. Read it against the current text before publishing again.
          </p>
        {/if}

        <div class="flex flex-wrap gap-2">
          <CmsButton variant="ghost"
            class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/15 bg-surface px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-50"
            type="button"
            disabled={Boolean(busy)}
            onclick={copyFromDefault}><Copy size={13} /> {busy === 'copy' ? 'Copying…' : 'Copy the English'}</CmsButton
          >
          <CmsButton variant="ghost"
            class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/25 bg-surface px-3 text-xs font-bold text-forest transition hover:bg-sand/50 disabled:opacity-50"
            type="button"
            disabled={Boolean(busy)}
            onclick={aiTranslate}
          >
            {#if busy === 'ai'}<Loader2 size={13} class="animate-spin" />{:else}<Sparkles size={13} />{/if}
            {busy === 'ai' ? 'Drafting…' : 'Draft with AI'}
          </CmsButton>
          <span class="self-center text-[11px] leading-5 text-ink/45" aria-live="polite">
            {busy === 'ai'
              ? 'Long pages are translated in parts — this can take up to a minute.'
              : 'Machine drafts are a starting point. Nothing is live until you publish.'}
          </span>
        </div>

        <div class="grid gap-4">
          {#each visibleFields as field (field.key)}
            {@const src = sourceText(field.key, field.kind)}
            {@const missing = Boolean(field.required) && Boolean(src.trim()) && !filled(field.key)}
            {#if groupStarts.has(field.key)}
              <h3 class="mt-2 border-b border-ink/10 pb-1.5 text-[13px] font-bold text-heading first:mt-0">{field.group}</h3>
            {/if}
            <div class="grid gap-2 lg:grid-cols-2 lg:gap-4">
              <!-- The English, shown and never editable. Its source of truth is
                   the form above; editing it here would fork the record. -->
              <div class="grid gap-1.5">
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40">
                  {languageName(data.default_language)} · {field.label}
                </span>
                {#if src.trim()}
                  <div class={srcBox}>{src}</div>
                {:else}
                  <div class="rounded-md border border-dashed border-ink/12 px-3 py-2.5 text-sm italic text-ink/35">
                    Empty in {languageName(data.default_language)} — nothing to translate.
                  </div>
                {/if}
              </div>

              <div class="grid gap-1.5">
                <span class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-forest/70">
                  {languageName(active)} · {field.label}
                  {#if missing}
                    <!-- Marked where the field is, rather than named in a list
                         at the top that has to be matched up by eye. -->
                    <span class="rounded-full bg-goldfinch-gold/25 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-heading">
                      Needed to publish
                    </span>
                  {/if}
                </span>

                {#if !src.trim()}
                  <div class="rounded-md border border-dashed border-ink/12 px-3 py-2.5 text-sm italic text-ink/35">—</div>
                {:else if field.kind === 'rich'}
                  <AdminRichText label="" name={`tr_${field.key}`} rows={5} headings="none" bind:value={draft[field.key] as string} />
                {:else if field.kind === 'textarea'}
                  <CmsTextarea class={areaClass} rows={3} bind:value={draft[field.key] as string}></CmsTextarea>
                {:else if field.kind === 'rich_list'}
                  <CmsTextarea
                    class={areaClass}
                    rows={4}
                    value={listToText(draft[field.key])}
                    oninput={(event) => (draft[field.key] = textToList(event.currentTarget.value))}
                  ></CmsTextarea>
                  <span class="text-[11px] text-ink/45">One per line, matching the English above.</span>
                {:else}
                  <CmsInput class={fieldClass} bind:value={draft[field.key] as string} />
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Pinned to the bottom of the window while the fields scroll past: on a
             long page these buttons sat below sixty fields, and editors pressed
             the page's own Save instead, which never saved the translation. -->
        <div
          class="translation-actions sticky z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-2 rounded-b-[8px] border-t border-ink/10 bg-surface px-4 py-3"
          style:bottom={stickyOffset}
        >
          {#if unsaved}
            <span class="mr-auto flex items-center gap-1.5 text-[12px] font-semibold text-clay" role="status">
              <AlertTriangle size={13} />
              Unsaved {languageName(active)} changes{live ? ' — the live page still shows the old text' : ''}
            </span>
          {:else if !canPublish}
            <span class="mr-auto flex items-center gap-1.5 text-[11px] text-ink/50">
              <AlertTriangle size={12} class="text-goldfinch-gold" />
              {requiredFields.length - doneRequired}
              {requiredFields.length - doneRequired === 1 ? 'field is' : 'fields are'} still needed before this can go live.
            </span>
          {:else if live}
            <span class="mr-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <Check size={12} /> {languageName(active)} is live
            </span>
          {/if}
          {#if live}
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-canvas disabled:opacity-50"
              type="button"
              disabled={Boolean(busy)}
              onclick={unpublish}>{busy === 'draft' ? 'Unpublishing…' : 'Unpublish'}</CmsButton
            >
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center gap-1.5 rounded-md bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              type="button"
              disabled={Boolean(busy) || !canPublish || !unsaved}
              onclick={() => save('published')}
            >
              {#if busy === 'published'}<Loader2 size={13} class="animate-spin" />{:else}<Check size={13} />{/if}
              Save &amp; keep live
            </CmsButton>
          {:else}
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-canvas disabled:opacity-50"
              type="button"
              disabled={Boolean(busy)}
              onclick={() => save('draft')}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</CmsButton
            >
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-canvas disabled:opacity-50"
              type="button"
              disabled={Boolean(busy)}
              onclick={() => save('needs_review')}>{busy === 'needs_review' ? 'Saving…' : 'Ask for review'}</CmsButton
            >
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center gap-1.5 rounded-md bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              type="button"
              disabled={Boolean(busy) || !canPublish}
              onclick={() => save('published')}
            >
              {#if busy === 'published'}<Loader2 size={13} class="animate-spin" />{:else}<Check size={13} />{/if}
              Publish
            </CmsButton>
          {/if}
        </div>
      {/if}
    {:else if !loading}
      <p class="text-sm text-ink/55">Translations are unavailable right now.</p>
    {/if}
  {/if}
</section>
