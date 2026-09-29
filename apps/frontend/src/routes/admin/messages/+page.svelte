<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import * as CmsSelect from '$lib/components/ui/native-select';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import {
    Archive,
    Check,
    Inbox,
    Mail,
    MailOpen,
    Phone,
    Reply,
    Save,
    Search,
    Trash2,
    User,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type Status = 'archived' | 'new' | 'read' | 'replied';

  type Message = {
    admin_notes?: string | null;
    assigned_to?: string | null;
    created_at?: string;
    email: string;
    full_name: string;
    id: string;
    message: string;
    phone?: string | null;
    status: Status;
    subject?: string | null;
    updated_at?: string;
  };

  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusMeta: Record<Status, { chip: string; dot: string; label: string }> = {
    new: { label: 'New', chip: 'bg-goldfinch-gold/20 text-heading ring-goldfinch-gold/30', dot: 'bg-goldfinch-gold' },
    read: { label: 'Read', chip: 'bg-sky-50 text-sky-700 ring-sky-200/70', dot: 'bg-sky-500' },
    replied: { label: 'Replied', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', dot: 'bg-emerald-500' },
    archived: { label: 'Archived', chip: 'bg-black/5 text-ink/50 ring-ink/10', dot: 'bg-black/40' }
  };

  const statusOrder: Status[] = ['new', 'read', 'replied', 'archived'];

  let rows: Message[] = [];
  let users: Record<string, string> = {};
  let assignOptions: Option[] = [{ label: 'Unassigned', value: '' }];

  let loading = true;
  let deleting = false;
  let savingNotes = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';

  let detailOpen = false;
  let confirmOpen = false;
  let selected: Message | null = null;
  let toDelete: Message | null = null;
  let notesDraft = '';
  let toasts: Toast[] = [];

  $: counts = statusOrder.reduce(
    (acc, s) => ({ ...acc, [s]: rows.filter((r) => r.status === s).length }),
    {} as Record<Status, number>
  );

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const fmt = (v?: string | null) =>
    v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—';

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.contact.messages({ search, status: statusFilter, limit: 200 });
      rows = res.data.items as unknown as Message[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load messages.';
    } finally {
      loading = false;
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.users.list({ limit: 200 });
      const items = res.data.items as Record<string, unknown>[];
      users = {};
      for (const u of items) {
        users[String(u.id)] = String(u.full_name ?? u.email ?? 'Admin');
      }
      assignOptions = [
        { label: 'Unassigned', value: '' },
        ...items.map((u) => ({ label: String(u.full_name ?? u.email ?? 'Admin'), value: String(u.id) }))
      ];
    } catch {
      // assignment is optional — ignore if users endpoint is unavailable
    }
  };

  const setRow = (updated: Message) => {
    rows = rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
    if (selected?.id === updated.id) selected = { ...selected, ...updated };
  };

  const openDetail = async (msg: Message) => {
    selected = msg;
    notesDraft = msg.admin_notes ?? '';
    detailOpen = true;
    // Reading an unread message marks it as read.
    if (msg.status === 'new') await changeStatus('read', true);
  };

  const closeDetail = () => { detailOpen = false; selected = null; };

  const changeStatus = async (status: Status, silent = false) => {
    if (!selected) return;
    try {
      const res = await api.contact.updateMessageStatus(selected.id, { status });
      setRow(res.data as unknown as Message);
      if (!silent) showToast(`Marked as ${statusMeta[status].label.toLowerCase()}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  };

  const assign = async (event: Event) => {
    if (!selected) return;
    const value = (event.target as HTMLSelectElement).value;
    try {
      const res = await api.contact.assignMessage(selected.id, { assigned_to: value || null });
      setRow(res.data as unknown as Message);
      showToast(value ? `Assigned to ${users[value] ?? 'admin'}.` : 'Unassigned.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to assign message.', 'error');
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    savingNotes = true;
    try {
      const res = await api.contact.updateNotes(selected.id, { admin_notes: notesDraft.trim() || null });
      setRow(res.data as unknown as Message);
      showToast('Internal notes saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save notes.', 'error');
    } finally {
      savingNotes = false;
    }
  };

  const replyByEmail = async () => {
    if (!selected) return;
    const subject = selected.subject ? `Re: ${selected.subject}` : 'Re: your enquiry';
    window.location.href = `mailto:${selected.email}?subject=${encodeURIComponent(subject)}`;
    if (selected.status !== 'replied') await changeStatus('replied');
  };

  const openDelete = (msg: Message) => { toDelete = msg; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.contact.removeMessage(toDelete.id);
      showToast('Message deleted.');
      confirmOpen = false;
      if (selected?.id === toDelete.id) closeDetail();
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete message.', 'error');
    } finally {
      deleting = false;
    }
  };

  const filterByStatus = (status: string) => {
    statusFilter = status;
    load();
  };

  onMount(async () => {
    await Promise.all([load(), loadUsers()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Booking Management"
    title="Contact Messages"
    description="Manage enquiries from the public contact form — read, reply, assign, annotate, and archive."
  />

  <!-- status filter chips -->
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    <CmsButton variant="ghost"
      class={`flex items-center justify-between rounded-2xl border bg-surface px-4 py-3 text-left shadow-sm transition hover:border-forest/40 ${statusFilter === 'all' ? 'border-forest/50 ring-1 ring-forest/20' : 'border-ink/10'}`}
      type="button"
      onclick={() => filterByStatus('all')}
    >
      <span class="text-sm font-semibold text-ink">All</span>
      <span class="grid h-7 min-w-7 place-items-center rounded-full bg-forest/10 px-2 text-xs font-bold text-forest">{rows.length}</span>
    </CmsButton>
    {#each statusOrder as s}
      <CmsButton variant="ghost"
        class={`flex items-center justify-between rounded-2xl border bg-surface px-4 py-3 text-left shadow-sm transition hover:border-forest/40 ${statusFilter === s ? 'border-forest/50 ring-1 ring-forest/20' : 'border-ink/10'}`}
        type="button"
        onclick={() => filterByStatus(s)}
      >
        <span class="flex items-center gap-2 text-sm font-semibold text-ink">
          <span class={`h-2 w-2 rounded-full ${statusMeta[s].dot}`}></span>{statusMeta[s].label}
        </span>
        <span class="grid h-7 min-w-7 place-items-center rounded-full bg-sand/70 px-2 text-xs font-bold text-ink/60">{counts[s] ?? 0}</span>
      </CmsButton>
    {/each}
  </div>

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Name, email, phone, subject, message..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminButton variant="secondary" on:click={load}>Search</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading messages..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No messages found"
      message="Enquiries submitted through the public contact form will appear here."
      icon={Inbox}
    />
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[900px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">From</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Subject</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Assigned</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Received</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as msg (msg.id)}
              <CmsTable.Row class={`cursor-pointer transition hover:bg-sand/25 ${msg.status === 'new' ? 'bg-goldfinch-gold/[0.04]' : ''}`} onclick={() => openDetail(msg)}>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex items-center gap-3">
                    <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/10 text-xs font-bold text-forest">{initials(msg.full_name)}</div>
                    <div class="min-w-0">
                      <p class={`truncate ${msg.status === 'new' ? 'font-bold' : 'font-semibold'} text-ink`}>{msg.full_name}</p>
                      <p class="truncate text-xs text-ink/55">{msg.email}</p>
                    </div>
                  </div>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <p class="line-clamp-1 max-w-xs font-medium text-ink">{msg.subject || '(No subject)'}</p>
                  <p class="line-clamp-1 max-w-xs text-xs text-ink/50">{msg.message}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusMeta[msg.status].chip}`}>
                    <span class={`h-1.5 w-1.5 rounded-full ${statusMeta[msg.status].dot}`}></span>{statusMeta[msg.status].label}
                  </span>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{msg.assigned_to ? (users[msg.assigned_to] ?? 'Admin') : '—'}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{fmt(msg.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2" on:click|stopPropagation role="presentation">
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openDetail(msg)}>
                      <MailOpen size={14} />View
                    </CmsButton>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(msg)}>
                      <Trash2 size={14} />
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

<!-- detail modal -->
{#if detailOpen && selected}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeDetail)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),48rem);max-width:none">
      <CmsDialog.Title class="sr-only">{selected.full_name}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm" >
      <!-- header -->
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 bg-sand/30 p-5">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-sm font-bold text-white">{initials(selected.full_name)}</div>
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-ink">{selected.full_name}</h2>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink/55">
              <a class="inline-flex items-center gap-1 hover:text-forest" href={`mailto:${selected.email}`}><Mail size={12} />{selected.email}</a>
              {#if selected.phone}<a class="inline-flex items-center gap-1 hover:text-forest" href={`tel:${selected.phone}`}><Phone size={12} />{selected.phone}</a>{/if}
            </div>
          </div>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeDetail}>
          <X size={18} />
        </CmsButton>
      </div>

      <!-- body -->
      <div class="grid gap-5 overflow-y-auto p-5">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">Subject</p>
          <p class="mt-1 text-base font-semibold text-ink">{selected.subject || '(No subject)'}</p>
          <p class="mt-1 text-xs text-ink/45">Received {fmt(selected.created_at)}</p>
        </div>

        <div class="rounded-2xl border border-ink/10 bg-sand/20 p-4">
          <p class="whitespace-pre-line text-sm leading-6 text-ink/75">{selected.message}</p>
        </div>

        <!-- status workflow -->
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">Status</p>
            <div class="flex flex-wrap gap-2">
              {#each statusOrder as s}
                <CmsButton variant="ghost"
                  class={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition ${selected.status === s ? statusMeta[s].chip : 'bg-surface text-ink/55 ring-ink/10 hover:bg-sand/60'}`}
                  type="button"
                  onclick={() => changeStatus(s)}
                >
                  {#if selected.status === s}<Check size={12} />{/if}{statusMeta[s].label}
                </CmsButton>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">Assigned to</p>
            <div class="flex items-center gap-2">
              <User size={15} class="shrink-0 text-ink/40" />
              <CmsSelect.Root class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm shadow-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" value={selected.assigned_to ?? ''} onchange={assign}>
                {#each assignOptions as opt}
                  <CmsSelect.Option value={opt.value}>{opt.label}</CmsSelect.Option>
                {/each}
              </CmsSelect.Root>
            </div>
          </div>
        </div>

        <!-- internal notes -->
        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">Internal notes</p>
          <AdminTextArea label="" name="admin_notes" bind:value={notesDraft} rows={3} placeholder="Private notes for the team — not visible to the customer." />
          <div class="mt-2 flex justify-end">
            <AdminButton variant="secondary" type="button" disabled={savingNotes} on:click={saveNotes}>
              <Save size={14} />
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </AdminButton>
          </div>
        </div>
      </div>

      <!-- footer -->
      <div class="flex flex-col-reverse gap-3 border-t border-ink/10 bg-sand/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex gap-2">
          <CmsButton variant="ghost" class="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink/70 shadow-sm transition hover:bg-sand/70" type="button" onclick={() => changeStatus('archived')}>
            <Archive size={14} />Archive
          </CmsButton>
          <CmsButton variant="ghost" class="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => selected && openDelete(selected)}>
            <Trash2 size={14} />Delete
          </CmsButton>
        </div>
        <AdminButton type="button" on:click={replyByEmail}>
          <Reply size={15} />Reply via Email
        </AdminButton>
      </div>
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete message"
  message={`Delete the message from "${toDelete?.full_name ?? 'this contact'}"? This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting message...
  </div>
{/if}
