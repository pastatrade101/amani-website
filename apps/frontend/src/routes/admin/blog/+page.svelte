<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Edit, Newspaper, Plus, Search, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type BlogPost = {
    author_name?: string | null;
    blog_categories?: { id: string; name: string; slug: string } | null;
    category_id?: string | null;
    created_at?: string;
    excerpt?: string | null;
    id: string;
    published_at?: string | null;
    slug: string;
    status: 'archived' | 'draft' | 'published';
    title: string;
    updated_at?: string;
  };

  type BlogCategory = { id: string; name: string; slug: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type Option = { label: string; value: string };

  const statusOptions: Option[] = [
    { label: 'All statuses', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  let rows: BlogPost[] = [];
  let categories: BlogCategory[] = [];
  let categoryOptions: Option[] = [{ label: 'All categories', value: 'all' }];
  let loading = true;
  let deleting = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let categoryFilter = 'all';
  let confirmOpen = false;
  let postToDelete: BlogPost | null = null;
  let toasts: Toast[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.blog.list({ search, status: statusFilter, category_id: categoryFilter === 'all' ? undefined : categoryFilter, limit: 50 });
      rows = res.data.items as BlogPost[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load blog posts.';
    } finally {
      loading = false;
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.blogCategories.list({ status: 'all', limit: 100 });
      categories = res.data.items as BlogCategory[];
      categoryOptions = [
        { label: 'All categories', value: 'all' },
        ...categories.map((c) => ({ label: c.name, value: c.id }))
      ];
    } catch {
      // non-critical
    }
  };

  const openDelete = (post: BlogPost) => { postToDelete = post; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    deleting = true;
    try {
      await api.blog.remove(postToDelete.id);
      showToast('Blog post deleted.');
      confirmOpen = false;
      postToDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete post.', 'error');
    } finally {
      deleting = false;
    }
  };

  const fmt = (v?: string | null) => v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '—';

  const catName = (post: BlogPost) => {
    const cat = post.blog_categories;
    if (!cat) return '—';
    if (typeof cat === 'object' && 'name' in cat) return cat.name;
    return '—';
  };

  onMount(async () => {
    await Promise.all([load(), loadCategories()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content Management"
    title="Blog Posts"
    description="Manage travel articles, destination guides, and planning content for SEO and trust-building."
    actionLabel="New Post"
    actionIcon={Plus}
    on:action={() => goto('/admin/blog/new')}
  />

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search posts..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={statusOptions} />
    <AdminSelect label="Category" name="category_filter" bind:value={categoryFilter} options={categoryOptions} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading blog posts..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No blog posts yet"
      message="Start creating travel guides, destination articles, and planning content to improve SEO and build trust."
      actionLabel="Write First Post"
      icon={Newspaper}
      on:action={() => goto('/admin/blog/new')}
    />
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[900px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Title</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Category</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Author</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Published</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as post (post.id)}
              <CmsTable.Row class="transition hover:bg-sand/25">
                <CmsTable.Cell class="px-4 py-4">
                  <div class="font-semibold text-ink">{post.title}</div>
                  {#if post.excerpt}<p class="mt-0.5 line-clamp-1 max-w-xs text-xs text-ink/50">{post.excerpt}</p>{/if}
                  <p class="mt-0.5 font-mono text-[11px] text-ink/35">{post.slug}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{catName(post)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{post.author_name || '—'}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={post.status} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{fmt(post.published_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{fmt(post.updated_at ?? post.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <a class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" href="/admin/blog/{post.id}/edit">
                      <Edit size={14} />Edit
                    </a>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(post)}>
                      <Trash2 size={14} />Delete
                    </CmsButton>
                  </div>
                </CmsTable.Cell>
              </CmsTable.Row>
            {/each}
          </CmsTable.Body>
        </CmsTable.Root>
      </div>
    </div>
  {/if}
</div>

<ConfirmModal
  open={confirmOpen}
  title="Delete blog post"
  message={`Delete "${postToDelete?.title ?? 'this post'}"? This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; postToDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting post...
  </div>
{/if}
