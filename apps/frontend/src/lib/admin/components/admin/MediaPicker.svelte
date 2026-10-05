<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Label as CmsLabel } from '$lib/components/ui/label';

  import { createEventDispatcher, onDestroy } from 'svelte';
  import { ChevronLeft, ChevronRight, Image as ImageIcon, Link as LinkIcon, Search, Trash2, Upload, X } from '@lucide/svelte';
  import { imgUrl } from '$lib/admin/img';
  import { api } from '$lib/admin/api/client';
  import type { Pagination } from '$lib/admin/types';

  // alt_text / caption come back from /media (listRecords selects *), and let a
  // consumer reuse whatever the librarian already wrote instead of asking for it
  // a second time.
  type MediaItem = {
    id: string;
    file_name: string;
    file_url: string;
    thumbnail_url?: string | null;
    title?: string | null;
    alt_text?: string | null;
    caption?: string | null;
  };

  export let value = '';
  export let label = 'Image';
  export let media: MediaItem[] = [];
  export let aspect = 'aspect-[16/9]';
  export let uploadFolder = 'uploads';
  export let fit = 'object-cover'; // use 'object-contain' for logos/favicons
  /** Keep the library open and emit one select event per picked image. */
  export let multiple = false;

  // `change` stays a bare URL so the 18 existing call sites are untouched.
  // `select` is additive: it carries the whole library record for consumers that
  // want its metadata (the gallery seeds its title/caption from it).
  const dispatch = createEventDispatcher<{ change: string; select: MediaItem }>();

  let open = false; // library modal
  let urlMode = false; // paste-url input
  let search = '';
  let uploaded: MediaItem[] = []; // images uploaded in this session
  let libraryItems: MediaItem[] = [];
  let libraryPagination: Pagination | null = null;
  let libraryLoaded = false;
  let libraryLoading = false;
  let libraryError = '';
  let libraryPage = 1;
  let uploading = false;
  let selectedUrls = new Set<string>();
  let uploadError = '';
  let fileInput: HTMLInputElement | null = null;
  const fileInputId = `media-upload-${Math.random().toString(36).slice(2)}`;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const pageLimit = 40;

  const searchText = (m: MediaItem) => `${m.title ?? ''} ${m.file_name} ${m.alt_text ?? ''} ${m.caption ?? ''}`;

  const uniqueMedia = (items: MediaItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.id || item.file_url;
      if (!item.file_url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  $: sourceMedia = libraryLoaded ? libraryItems : media;
  $: currentPageMedia = uniqueMedia([...uploaded, ...sourceMedia]);
  $: filtered = search.trim()
    ? currentPageMedia.filter((m) => searchText(m).toLowerCase().includes(search.trim().toLowerCase()))
    : currentPageMedia;
  $: totalImages = libraryPagination?.total ?? currentPageMedia.length;
  $: totalPages = Math.max(libraryPagination?.totalPages ?? 1, 1);
  $: currentPage = libraryPagination?.page ?? libraryPage;
  $: fromItem = totalImages ? (currentPage - 1) * pageLimit + 1 : 0;
  $: toItem = totalImages ? Math.min(currentPage * pageLimit, totalImages) : 0;

  // Human label under each tile: prefer what the librarian wrote (alt text,
  // then caption) over the raw file name, which is often IMG_1234.jpg.
  const labelOf = (m: MediaItem) =>
    m.title?.trim() || m.alt_text?.trim() || m.caption?.trim() || m.file_name.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').trim();

  const mediaFromRecord = (record: Record<string, unknown>): MediaItem | null => {
    const fileUrl = typeof record.file_url === 'string' ? record.file_url : '';
    if (!fileUrl) return null;
    const title = typeof record.title === 'string' ? record.title : null;
    const fileName =
      typeof record.file_name === 'string' && record.file_name.trim()
        ? record.file_name
        : title?.trim() || 'Image';
    return {
      id: String(record.id ?? fileUrl),
      file_name: fileName,
      file_url: fileUrl,
      thumbnail_url: typeof record.thumbnail_url === 'string' ? record.thumbnail_url : null,
      title,
      alt_text: typeof record.alt_text === 'string' ? record.alt_text : null,
      caption: typeof record.caption === 'string' ? record.caption : null
    };
  };

  const loadLibraryPage = async (page = libraryPage) => {
    libraryLoading = true;
    libraryError = '';
    try {
      const response = await api.media.list({
        file_type: 'image',
        limit: pageLimit,
        page,
        search: search.trim() || undefined
      });
      libraryItems = (response.data.items as Record<string, unknown>[])
        .map(mediaFromRecord)
        .filter((item): item is MediaItem => Boolean(item));
      libraryPagination = response.data.pagination;
      libraryPage = response.data.pagination.page;
      libraryLoaded = true;
    } catch (err) {
      libraryError = err instanceof Error ? err.message : 'Unable to load media library.';
      if (!libraryLoaded) libraryItems = [];
    } finally {
      libraryLoading = false;
    }
  };

  const openLibrary = () => {
    open = true;
    selectedUrls = new Set();
    if (!libraryLoaded) void loadLibraryPage(1);
  };

  const queueSearch = () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void loadLibraryPage(1);
    }, 300);
  };

  const submitSearch = () => {
    if (searchTimer) clearTimeout(searchTimer);
    void loadLibraryPage(1);
  };

  const clearSearch = () => {
    search = '';
    submitSearch();
  };

  const goToPage = (page: number) => {
    if (libraryLoading || page < 1 || page > totalPages) return;
    void loadLibraryPage(page);
  };

  const select = (url: string, item?: MediaItem) => {
    value = url;
    dispatch('change', url);
    if (item) dispatch('select', item);
    if (multiple) {
      selectedUrls = new Set([...selectedUrls, url]);
    } else {
      open = false;
    }
  };
  const clear = () => { value = ''; urlMode = false; dispatch('change', ''); };

  const onFileChange = async (event: Event) => {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    if (!files.length) return;
    uploading = true;
    uploadError = '';
    const errors: string[] = [];
    try {
      for (const file of files) {
        try {
          const res = await api.upload.image(file, uploadFolder);
          const data = res.data as { url: string; media?: { id?: string; thumbnail_url?: string | null } };
          const item: MediaItem = {
            id: data.media?.id ?? data.url,
            file_name: file.name,
            file_url: data.url,
            thumbnail_url: data.media?.thumbnail_url ?? null
          };
          uploaded = [item, ...uploaded];
          select(data.url, item);
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`);
        }
      }
      uploadError = errors.join(' · ');
    } finally {
      uploading = false;
      if (fileInput) fileInput.value = '';
    }
  };

  // Render the modal on <body> so a transformed admin ancestor can't break
  // position:fixed (which would push the dialog out of the viewport).
  const portal = (node: HTMLElement) => {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  };

  onDestroy(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });
</script>

<div class="grid gap-2">
  <p class="text-sm font-medium text-ink">{label}</p>

  {#if value}
    <div class={`relative max-h-40 overflow-hidden rounded-xl border border-ink/10 bg-sand/30 ${aspect}`}>
      <img class={`absolute inset-0 h-full w-full ${fit}`} src={imgUrl(value, 800)} alt={label} loading="lazy" decoding="async" />
      <CmsButton variant="ghost" type="button" class="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-xl bg-ink/65 text-white backdrop-blur transition hover:bg-ink/85" onclick={clear} aria-label="Remove image">
        <Trash2 size={15} />
      </CmsButton>
    </div>
  {:else}
    <div class={`grid max-h-40 place-items-center rounded-xl border border-dashed border-ink/20 bg-sand/20 text-ink/35 ${aspect}`}>
      <ImageIcon size={26} />
    </div>
  {/if}

  <div class="flex flex-wrap gap-2">
    <CmsButton variant="ghost" type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white transition hover:bg-deep-green" onclick={openLibrary}>
      <ImageIcon size={14} /> {value ? 'Change' : 'Choose from library'}
    </CmsButton>
    <CmsButton variant="ghost" type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-sand" onclick={() => (urlMode = !urlMode)}>
      <LinkIcon size={14} /> Paste URL
    </CmsButton>
  </div>

  {#if urlMode}
    <CmsInput
      class="w-full rounded-md border border-ink/15 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
      placeholder="https://…"
      bind:value
      oninput={() => dispatch('change', value)}
      onkeydown={(event) => {
        // Enter confirms the pasted URL. Without this it submitted the whole
        // editor form, saving a category before its last steps were filled in.
        if (event.key === 'Enter') {
          event.preventDefault();
          urlMode = false;
        }
      }}
    />
  {/if}
</div>

<!-- library picker modal -->
{#if open}
  <!-- Must sit above the full-screen accommodation editor (z-180). The portal
       moves this node to body, but z-index still decides whether the dialog is
       visible above the editor overlay. -->
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (() => (open = false))(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),80rem);max-width:none">
      <CmsDialog.Title class="sr-only">admin editor</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="relative flex h-[88vh] max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="flex flex-col gap-4 border-b border-ink/10 bg-sand/25 p-4 lg:flex-row lg:items-center">
        <div class="min-w-0 lg:w-60">
          <p class="text-base font-extrabold tracking-tight text-heading">Media Library</p>
          <p class="mt-0.5 text-xs text-ink/50">
            {#if libraryLoading && !libraryLoaded}
              Loading images...
            {:else if totalImages}
              {fromItem}-{toItem} of {totalImages} image{totalImages === 1 ? '' : 's'}
            {:else}
              No images available
            {/if}
          </p>
        </div>
        <div class="flex h-11 flex-1 items-center gap-2 rounded-xl border border-ink/12 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
          <Search size={16} class="text-ink/40" />
          <CmsInput
            class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
            placeholder="Search by title, file name, alt text or caption..."
            bind:value={search}
            oninput={queueSearch}
            onkeydown={(event) => event.key === 'Enter' && submitSearch()}
          />
          {#if search.trim()}
            <CmsButton variant="ghost" type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink/40 transition hover:bg-sand hover:text-ink" aria-label="Clear search" onclick={clearSearch}>
              <X size={14} />
            </CmsButton>
          {/if}
        </div>
        <div class="flex shrink-0 gap-2">
          <CmsLabel
            for={fileInputId}
            class={["inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-forest px-4 text-sm font-bold text-white shadow-sm transition hover:bg-deep-green disabled:opacity-60", {"pointer-events-none": uploading, "opacity-60": uploading}]}
            
            
          >
            <Upload size={15} /> {uploading ? 'Uploading...' : multiple ? 'Upload images' : 'Upload'}
          </CmsLabel>
          <CmsInput id={fileInputId} class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple={multiple} bind:ref={fileInput} onchange={onFileChange} />
          <CmsButton variant="ghost" type="button" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" onclick={() => (open = false)} aria-label="Close"><X size={18} /></CmsButton>
        </div>
      </div>
      {#if uploadError}
        <p class="border-b border-ink/10 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">{uploadError}</p>
      {/if}
      {#if libraryError}
        <div class="flex flex-col gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{libraryError}</span>
          <CmsButton variant="ghost" type="button" class="w-fit rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100" onclick={() => loadLibraryPage(currentPage)}>Retry</CmsButton>
        </div>
      {/if}
      <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" data-lenis-prevent>
        {#if libraryLoading && !libraryLoaded}
          <div class="grid min-h-full place-items-center rounded-xl border border-ink/10 bg-sand/15 p-8 text-center">
            <div>
              <span class="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-forest/20 border-t-forest"></span>
              <p class="mt-3 text-sm font-bold text-ink">Loading media library</p>
              <p class="mt-1 text-xs text-ink/50">Fetching image records from the CMS.</p>
            </div>
          </div>
        {:else if !filtered.length}
          <div class="grid min-h-full place-items-center rounded-xl border border-dashed border-ink/15 bg-sand/20 p-8 text-center">
            <div>
              <span class="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface text-ink/35 ring-1 ring-ink/10"><ImageIcon size={24} /></span>
              <p class="mt-3 text-sm font-bold text-ink">No images found</p>
              <p class="mt-1 text-xs text-ink/50">Try another search or upload a new image.</p>
            </div>
          </div>
        {:else}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {#each filtered as m (m.id)}
              <CmsButton variant="ghost"
                type="button"
                class={`group flex h-auto flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-xl border bg-surface p-0 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${(multiple ? selectedUrls.has(m.file_url) : value === m.file_url) ? 'border-goldfinch-gold ring-2 ring-goldfinch-gold/45' : 'border-ink/10 hover:border-forest/35'}`}
                onclick={() => select(m.file_url, m)}
              >
                <span class="relative block aspect-[4/3] w-full overflow-hidden bg-sand/35">
                  <img
                    class="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-300 group-hover:scale-105"
                    src={imgUrl(m.thumbnail_url || m.file_url, 420)}
                    alt={labelOf(m)}
                    loading="lazy"
                    decoding="async"
                    on:load={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '1')}
                  />
                  {#if multiple ? selectedUrls.has(m.file_url) : value === m.file_url}
                    <span class="absolute right-2 top-2 rounded-xl bg-goldfinch-gold px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-heading shadow-sm">Selected</span>
                  {/if}
                </span>
                <span class="block min-h-11 px-3 py-2">
                  <span class="line-clamp-2 break-words text-xs font-semibold leading-snug text-ink/70" title={labelOf(m)}>{labelOf(m)}</span>
                </span>
              </CmsButton>
            {/each}
          </div>
        {/if}
      </div>
      <div class="flex flex-col gap-3 border-t border-ink/10 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs font-medium text-ink/50">
          {#if search.trim()}
            Search: <span class="font-bold text-ink/70">{search.trim()}</span>
          {:else}
            Showing all image uploads
          {/if}
        </p>
        <div class="flex items-center justify-between gap-2 sm:justify-end">
          <CmsButton variant="ghost"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/12 bg-surface px-3 text-xs font-bold text-ink/70 shadow-sm transition hover:bg-sand disabled:pointer-events-none disabled:opacity-45"
            disabled={libraryLoading || currentPage <= 1}
            onclick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={14} /> Previous
          </CmsButton>
          <span class="min-w-24 text-center text-xs font-bold text-ink/60">Page {currentPage} of {totalPages}</span>
          <CmsButton variant="ghost"
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/12 bg-surface px-3 text-xs font-bold text-ink/70 shadow-sm transition hover:bg-sand disabled:pointer-events-none disabled:opacity-45"
            disabled={libraryLoading || currentPage >= totalPages}
            onclick={() => goToPage(currentPage + 1)}
          >
            Next <ChevronRight size={14} />
          </CmsButton>
          {#if multiple}
            <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center rounded-xl bg-forest px-4 text-xs font-bold text-white shadow-sm transition hover:bg-deep-green" onclick={() => (open = false)}>Done</CmsButton>
          {/if}
        </div>
      </div>
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}
