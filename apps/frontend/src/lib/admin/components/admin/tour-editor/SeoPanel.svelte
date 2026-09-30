<script lang="ts">
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AiAssistButton from '$lib/admin/components/admin/AiAssistButton.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import { LIMITS, type MediaItem, type TourEditorForm } from './model';

  export let form: TourEditorForm;
  export let mediaItems: MediaItem[] = [];
  export let aiContext: () => Record<string, unknown> = () => ({});
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Search & sharing</p>
      <AiAssistButton
        task="seo_meta"
        label="Generate SEO"
        getContext={aiContext}
        on:apply={(e) => {
          form.meta_title = e.detail.seo_title || form.meta_title;
          form.meta_description = e.detail.meta_description || form.meta_description;
        }}
      />
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="grid content-start gap-4">
        <!-- Amber past what search results show, red past what the API takes. -->
        <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} counter={LIMITS.seoTitle.target} maxlength={LIMITS.seoTitle.max} placeholder="e.g. 7-Day Serengeti & Ngorongoro Safari" />
        <AdminTextArea label="Meta description" name="meta_description" bind:value={form.meta_description} rows={3} counter={LIMITS.metaDescription.target} maxlength={LIMITS.metaDescription.max} placeholder="One or two sentences that make someone click." />
      </div>
      <MediaPicker label="Sharing image" media={mediaItems} uploadFolder="tours/seo" aspect="aspect-[16/9]" bind:value={form.og_image_url} />
    </div>
    <p class="text-xs text-ink/45">
      All optional. Search results show about {LIMITS.seoTitle.target} characters of the title and {LIMITS.metaDescription.target} of the description, then cut the rest —
      the counter turns amber there. The most either field takes is {LIMITS.seoTitle.max} and {LIMITS.metaDescription.max}.
    </p>
  </section>
</div>
