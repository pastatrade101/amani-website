<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount, onDestroy } from 'svelte';
  import { Palette, RotateCcw, Save, Star } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import {
    applyBrandColors,
    branding,
    defaultBranding,
    defaultColors,
    type BrandColors,
    type Branding
  } from '$lib/admin/branding';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const colorFields: { hint: string; key: keyof BrandColors; label: string }[] = [
    { key: 'deep_green', label: 'Deep Green', hint: 'Primary dark — sidebar, hero overlays' },
    { key: 'forest', label: 'Forest', hint: 'Primary — buttons, links, accents' },
    { key: 'goldfinch_gold', label: 'Key2africa Gold', hint: 'Accent — highlights, CTAs, badges' },
    { key: 'sand', label: 'Sand', hint: 'Surfaces — cards, section backgrounds' },
    { key: 'savanna', label: 'Savanna', hint: 'Soft accent' },
    { key: 'ink', label: 'Ink', hint: 'Body text' },
    { key: 'clay', label: 'Clay', hint: 'Secondary accent' }
  ];

  let loading = true;
  let saving = false;
  let error = '';
  let toasts: Toast[] = [];

  let form: Branding = structuredClone(defaultBranding);
  let savedColors: BrandColors = { ...defaultColors };

  let mediaItems: MediaItem[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim());

  // Live-preview: recolor the whole CMS reactively whenever any color changes.
  // A reactive statement (not on:input) guarantees it always sees the newest
  // value — on:input can fire before bind:value writes the value back.
  $: applyColorsReactively(form.colors);
  const applyColorsReactively = (colors: typeof form.colors) => {
    if (loading) return;
    applyBrandColors(colors);
  };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const [brandingRes, mediaRes] = await Promise.all([
        api.branding.get(),
        api.media.list({ file_type: 'image', limit: 200 })
      ]);

      const data = (brandingRes.data ?? {}) as Partial<Branding>;
      form = {
        ...structuredClone(defaultBranding),
        ...data,
        colors: { ...defaultColors, ...(data.colors ?? {}) }
      };
      savedColors = { ...form.colors };

      mediaItems = (mediaRes.data.items as unknown as MediaItem[]).filter((m) => m.file_url);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load branding.';
    } finally {
      loading = false;
    }
  };

  const resetColors = () => {
    form = { ...form, colors: { ...defaultColors } };
    showToast('Colors reset to Key2africa defaults. Save to keep them.');
  };

  const save = async () => {
    for (const field of colorFields) {
      if (!isHex(form.colors[field.key])) {
        showToast(`${field.label} must be a 6-digit hex color (e.g. #2D3027).`, 'error');
        return;
      }
    }
    if (!form.site_name.trim()) {
      showToast('Site name is required.', 'error');
      return;
    }

    saving = true;
    try {
      const response = await api.branding.update(form as unknown as Record<string, unknown>);
      const saved = (response.data ?? form) as Partial<Branding>;
      const merged = { ...form, ...saved, colors: { ...form.colors, ...(saved.colors ?? {}) } };
      branding.set(merged);
      applyBrandColors(merged.colors);
      savedColors = { ...merged.colors };
      showToast('Branding saved and applied across the site.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save branding.', 'error');
    } finally {
      saving = false;
    }
  };

  onMount(load);

  // If the admin previews colors but leaves without saving, restore the saved palette.
  onDestroy(() => applyBrandColors(savedColors));
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Administration"
    title="Branding"
    description="Control your site identity, logo, contact details, and color palette. Colors apply across the entire public site and CMS."
    actionLabel={saving ? 'Saving...' : 'Save Branding'}
    actionIcon={Save}
    on:action={save}
  />

  {#if loading}
    <LoadingState message="Loading branding..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <div class="grid gap-6 xl:grid-cols-[1fr_400px] xl:items-start">
      <!-- forms -->
      <div class="grid gap-6">
        <!-- identity -->
        <section class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Brand identity</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Name & messaging</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <AdminFormInput label="Site name" name="site_name" bind:value={form.site_name} required />
            <AdminFormInput label="Company name" name="company_name" bind:value={form.company_name} />
          </div>
          <AdminFormInput label="Tagline" name="tagline" bind:value={form.tagline} />
          <AdminTextArea label="Positioning statement" name="positioning" bind:value={form.positioning} rows={2} />
          <AdminFormInput label="AI advisor name" name="ai_advisor_name" bind:value={form.ai_advisor_name} />
        </section>

        <!-- colors -->
        <section class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Color palette</p>
              <h2 class="mt-1 text-lg font-bold text-ink">Brand colors</h2>
              <p class="mt-1 text-sm text-ink/55">Edits preview live across the CMS. Save to publish them site-wide.</p>
            </div>
            <CmsButton variant="ghost" class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:bg-sand/70" type="button" onclick={resetColors}>
              <RotateCcw size={13} />Reset
            </CmsButton>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            {#each colorFields as field (field.key)}
              <div class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand/20 p-3">
                <CmsInput class="h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-ink/10 bg-surface p-0.5" type="color" aria-label={field.label} bind:value={form.colors[field.key]} />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-ink">{field.label}</p>
                  <p class="truncate text-[11px] text-ink/50">{field.hint}</p>
                </div>
                <CmsInput class="h-9 w-[92px] shrink-0 rounded-lg border border-ink/10 bg-surface px-2 text-center font-mono text-xs uppercase shadow-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" bind:value={form.colors[field.key]} spellcheck="false" />
              </div>
            {/each}
          </div>
        </section>

        <!-- logo & favicon -->
        <section class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Logo & favicon</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Brand assets</h2>
          </div>
          <div class="grid gap-5 sm:grid-cols-2">
            <MediaPicker label="Logo" media={mediaItems} uploadFolder="branding" fit="object-contain" aspect="aspect-[16/9]" bind:value={form.logo_url} />
            <MediaPicker label="Favicon" media={mediaItems} uploadFolder="branding" fit="object-contain" aspect="aspect-square" bind:value={form.favicon_url} />
          </div>
        </section>

        <!-- CTAs & contact -->
        <section class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Calls to action & contact</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Buttons & support details</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <AdminFormInput label="Primary CTA" name="primary_cta" bind:value={form.primary_cta} />
            <AdminFormInput label="Secondary CTA" name="secondary_cta" bind:value={form.secondary_cta} />
            <AdminFormInput label="WhatsApp CTA" name="whatsapp_cta" bind:value={form.whatsapp_cta} />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <AdminFormInput label="Support email" name="support_email" type="email" bind:value={form.support_email} placeholder="hello@goldfinch.com" />
            <AdminFormInput label="Support phone" name="support_phone" bind:value={form.support_phone} placeholder="+255 700 000 000" />
          </div>
        </section>

        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminButton variant="secondary" type="button" on:click={load}>Discard changes</AdminButton>
          <AdminButton type="button" disabled={saving} on:click={save}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Branding'}
          </AdminButton>
        </div>
      </div>

      <!-- live preview -->
      <aside class="xl:sticky xl:top-4">
        <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
          <div class="flex items-center gap-2 border-b border-ink/10 bg-sand/40 px-4 py-2.5">
            <Palette size={14} class="text-forest" />
            <span class="text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">Live preview</span>
          </div>

          <!-- mock hero -->
          <div class="relative grid min-h-[170px] place-items-center bg-deep-green p-6 text-center text-white">
            {#if form.logo_url}
              <img class="absolute left-4 top-4 h-7 object-contain" src={cdnUrl(form.logo_url)} alt="" />
            {/if}
            <div>
              <h3 class="text-xl font-extrabold">{form.site_name || 'Site name'}</h3>
              <p class="mx-auto mt-2 max-w-xs text-xs text-white/80">{form.tagline || 'Your tagline appears here.'}</p>
              <span class="mt-4 inline-flex h-9 items-center rounded-xl bg-goldfinch-gold px-4 text-xs font-bold text-heading">{form.primary_cta || 'Plan My Trip'}</span>
            </div>
          </div>

          <!-- mock card section -->
          <div class="grid gap-3 bg-sand/40 p-4">
            <div class="rounded-2xl border border-ink/10 bg-surface p-3">
              <div class="flex items-center gap-1 text-goldfinch-gold">
                {#each Array(5) as _}
                  <Star size={12} fill="currentColor" />
                {/each}
              </div>
              <p class="mt-2 text-sm font-semibold text-ink">Tour card heading</p>
              <p class="text-xs text-ink/55">Surfaces use the Sand color. Text uses Ink.</p>
              <div class="mt-3 flex gap-2">
                <span class="inline-flex h-7 items-center rounded-lg bg-forest px-3 text-[11px] font-semibold text-white">Forest button</span>
                <span class="inline-flex h-7 items-center rounded-lg bg-clay/15 px-3 text-[11px] font-semibold text-clay">Clay tag</span>
              </div>
            </div>
            <div class="flex items-center justify-between rounded-2xl bg-savanna/50 px-3 py-2">
              <span class="text-xs font-semibold text-ink/70">Savanna soft accent band</span>
              <span class="grid h-6 w-6 place-items-center rounded-full bg-goldfinch-gold text-[10px] font-bold text-heading">GA</span>
            </div>
          </div>

          <div class="border-t border-ink/10 px-4 py-3 text-center text-[11px] text-ink/45">
            This preview recolors live as you edit. Save to publish site-wide.
          </div>
        </div>
      </aside>
    </div>
  {/if}
</div>
