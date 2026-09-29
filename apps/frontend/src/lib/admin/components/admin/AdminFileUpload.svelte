<script lang="ts">
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { createEventDispatcher } from 'svelte';
  import { Upload } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';

  export let accept = 'image/jpeg,image/png,image/webp,image/avif';
  export let folder = 'cms';
  export let helper = '';
  export let kind: 'image' | 'lottie' = 'image';
  export let label = 'Upload file';
  export let value = '';

  let fileInput: HTMLInputElement | null = null;
  let files: FileList | null = null;
  let selectedFileName = '';
  let uploading = false;
  let message = '';

  const dispatch = createEventDispatcher<{
    error: string;
    uploaded: { url: string; path: string };
  }>();

  const chooseFile = () => {
    fileInput?.click();
  };

  const handleFileChange = (event: Event) => {
    files = (event.currentTarget as HTMLInputElement).files;
    selectedFileName = files?.[0]?.name ?? '';
    message = '';
  };

  const upload = async () => {
    const file = files?.[0];
    if (!file) {
      message = 'Choose a file first.';
      return;
    }

    uploading = true;
    message = '';

    try {
      const response = kind === 'lottie' ? await api.upload.lottie(file, folder) : await api.upload.image(file, folder);
      dispatch('uploaded', response.data);
      message = kind === 'lottie' ? 'Lottie file uploaded.' : 'File uploaded.';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Unable to upload file.';
      dispatch('error', message);
    } finally {
      uploading = false;
    }
  };
</script>

<div class="min-w-0 rounded-xl border border-dashed border-forest/20 bg-surface/70 p-4 shadow-sm">
  <div class="grid min-w-0 gap-3">
    <div class="min-w-0">
      <p class="text-sm font-semibold text-ink">{label}</p>
      {#if helper}
        <p class="mt-1 text-xs leading-relaxed text-ink/55">{helper}</p>
      {/if}
    </div>

    <CmsInput class="sr-only" type="file" {accept} bind:ref={fileInput} onchange={handleFileChange} />

    <CmsButton variant="ghost" class="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-3 text-left shadow-sm transition hover:border-goldfinch-gold/45 hover:bg-sand/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/15" type="button" onclick={chooseFile}>
      <span class="shrink-0 rounded-xl bg-forest px-3 py-1.5 text-xs font-semibold text-white">Choose file</span>
      <span class="min-w-0 flex-1 truncate text-sm text-ink/65">{selectedFileName || 'No file selected'}</span>
    </CmsButton>

    <CmsButton variant="ghost" class="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-2xl border border-forest bg-forest px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-deep-green disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/15" type="button" disabled={uploading} onclick={upload}>
      <Upload size={14} />
      {uploading ? 'Uploading...' : kind === 'lottie' ? 'Upload Lottie' : 'Upload File'}
    </CmsButton>

    {#if value}
      <p class="min-w-0 truncate rounded-2xl border border-ink/10 bg-surface px-3 py-2 text-xs text-ink/55" title={value}>{value}</p>
    {/if}

    {#if message}
      <p class="text-xs text-ink/60">{message}</p>
    {/if}
  </div>
</div>
