<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ArrowLeft, Save } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from './AdminButton.svelte';
  import AdminFormInput from './AdminFormInput.svelte';
  import AdminPageHeader from './AdminPageHeader.svelte';
  import AdminSelect from './AdminSelect.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import AdminRichText from './AdminRichText.svelte';
  import AdminTextArea from './AdminTextArea.svelte';
  import ToastStack from './ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  export let mode: 'create' | 'edit' = 'create';
  export let postId = '';

  type PublishStatus = 'archived' | 'draft' | 'published';
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };

  const statusOptions: Option[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  let loading = mode === 'edit';
  let loadingOptions = true;
  let saving = false;
  let error = '';
  let slugManuallyEdited = false;
  let toasts: Toast[] = [];

  let categoryOptions: Option[] = [{ label: 'No category', value: '' }];
  let mediaItems: MediaItem[] = [];

  let form = {
    author_name: '',
    category_id: '',
    content: '',
    excerpt: '',
    featured_image_url: '',
    meta_description: '',
    meta_title: '',
    og_image_url: '',
    published_at: '',
    slug: '',
    status: 'draft' as PublishStatus,
    title: ''
  };

  // ─── helpers ──────────────────────────────────────────────────────────────

  const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  $: if (!slugManuallyEdited) form.slug = slugify(form.title);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  // ─── data loading ─────────────────────────────────────────────────────────

  const loadOptions = async () => {
    loadingOptions = true;
    try {
      const [cats, media] = await Promise.all([
        api.blogCategories.list({ status: 'all', limit: 100 }),
        api.media.list({ file_type: 'image', limit: 200 })
      ]);

      categoryOptions = [
        { label: 'No category', value: '' },
        ...cats.data.items.map((c) => ({ label: String(c.name ?? c.slug ?? 'Untitled'), value: String(c.id) }))
      ];

      mediaItems = (media.data.items as MediaItem[]).filter((m) => m.file_url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load options.', 'error');
    } finally {
      loadingOptions = false;
    }
  };

  const loadPost = async () => {
    if (mode !== 'edit' || !postId) return;
    loading = true;
    error = '';
    try {
      const res = await api.blog.get(postId);
      const post = res.data as Record<string, unknown>;

      form = {
        author_name: String(post.author_name ?? ''),
        category_id: String(post.category_id ?? ''),
        content: String(post.content ?? ''),
        excerpt: String(post.excerpt ?? ''),
        featured_image_url: String(post.featured_image_url ?? ''),
        meta_description: String(post.meta_description ?? ''),
        meta_title: String(post.meta_title ?? ''),
        og_image_url: String(post.og_image_url ?? ''),
        published_at: post.published_at ? String(post.published_at).slice(0, 16) : '',
        slug: String(post.slug ?? ''),
        status: (post.status ?? 'draft') as PublishStatus,
        title: String(post.title ?? '')
      };

      slugManuallyEdited = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load blog post.';
    } finally {
      loading = false;
    }
  };

  // ─── save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    if (!form.slug.trim()) { showToast('Slug is required.', 'error'); return; }

    saving = true;

    const payload: Record<string, unknown> = {
      author_name: form.author_name.trim() || null,
      category_id: form.category_id || null,
      content: form.content.trim() || null,
      excerpt: form.excerpt.trim() || null,
      featured_image_url: form.featured_image_url.trim() || null,
      meta_description: form.meta_description.trim() || null,
      meta_title: form.meta_title.trim() || null,
      og_image_url: form.og_image_url.trim() || null,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
      slug: form.slug.trim(),
      status: form.status,
      title: form.title.trim()
    };

    try {
      if (mode === 'edit' && postId) {
        await api.blog.update(postId, payload);
        showToast('Blog post updated successfully.');
      } else {
        await api.blog.create(payload);
        showToast('Blog post created successfully.');
        setTimeout(() => goto('/admin/blog'), 1000);
        return;
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save blog post.', 'error');
    } finally {
      saving = false;
    }
  };

  onMount(async () => {
    await Promise.all([loadOptions(), loadPost()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content Management"
    title={mode === 'edit' ? 'Edit Blog Post' : 'New Blog Post'}
    description={mode === 'edit' ? 'Update the post content, SEO, and publishing settings.' : 'Write a new travel article, destination guide, or planning resource.'}
  />

  {#if loading}
    <LoadingState message="Loading blog post..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <form class="grid gap-6" on:submit|preventDefault={save}>

      <!-- main content card -->
      <div class="grid gap-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Post content</p>
          <h2 class="mt-1 text-lg font-bold text-ink">Title, slug, excerpt & body</h2>
        </div>

        <div class="grid gap-4">
          <AdminFormInput label="Title" name="title" bind:value={form.title} placeholder="e.g. The Ultimate Guide to Serengeti Migration Season" required />

          <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
            <span>Slug</span>
            <CmsInput
              class="h-11 rounded-2xl border border-ink/10 bg-surface px-3 font-mono text-sm shadow-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
              name="slug"
              bind:value={form.slug}
              required
              oninput={() => (slugManuallyEdited = true)}
            />
            <span class="text-xs text-ink/45">Auto-generated from title. Edit to customize.</span>
          </CmsLabel>

          <AdminTextArea label="Excerpt" name="excerpt" bind:value={form.excerpt} rows={3} placeholder="Short summary shown on blog listing pages and in search results (150–200 chars recommended)." />

          <AdminRichText label="Content" name="content" bind:value={form.content} rows={20} headings="h2h3" placeholder="Write your full article here." />
        </div>
      </div>

      <!-- sidebar settings -->
      <div class="grid gap-6 xl:grid-cols-[1fr_360px]">
        <!-- images -->
        <div class="grid gap-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Featured image</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Post thumbnail</h2>
          </div>

          <MediaPicker label="Featured image" media={mediaItems} uploadFolder="blog" bind:value={form.featured_image_url} />
        </div>

        <!-- publish settings -->
        <div class="grid content-start gap-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publish settings</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Status & details</h2>
          </div>

          <div class="grid gap-4">
            <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
            <AdminSelect
              label="Category"
              name="category_id"
              bind:value={form.category_id}
              options={loadingOptions ? [{ label: 'Loading...', value: '' }] : categoryOptions}
            />
            <AdminFormInput label="Author name" name="author_name" bind:value={form.author_name} placeholder="e.g. Key2africa Team" />
            <AdminFormInput label="Published at" name="published_at" type="datetime-local" bind:value={form.published_at} />
          </div>
        </div>
      </div>

      <!-- SEO card -->
      <div class="grid gap-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Search engine optimisation</p>
          <h2 class="mt-1 text-lg font-bold text-ink">SEO & Open Graph</h2>
          <p class="mt-1 text-sm text-ink/55">These fields improve how the post appears in search results and social sharing previews.</p>
        </div>

        <div class="grid gap-4">
          <div class="grid gap-4 md:grid-cols-2">
            <AdminFormInput label="Meta title" name="meta_title" bind:value={form.meta_title} placeholder="Override title for search results (55–60 chars)" />
            <AdminTextArea label="Meta description" name="meta_description" bind:value={form.meta_description} rows={3} placeholder="Summary shown in search snippets (150–160 chars)" />
          </div>

          <MediaPicker label="OG image (1200×630 recommended)" media={mediaItems} uploadFolder="blog" bind:value={form.og_image_url} />
        </div>
      </div>

      <!-- footer actions -->
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-ink/10 bg-surface px-6 py-4 shadow-sm">
        <a class="inline-flex items-center gap-2 text-sm font-semibold text-ink/60 transition hover:text-ink" href="/admin/blog">
          <ArrowLeft size={16} />
          Back to blog posts
        </a>
        <AdminButton type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Post'}
        </AdminButton>
      </div>
    </form>
  {/if}
</div>
