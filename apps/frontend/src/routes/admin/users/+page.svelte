<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, KeyRound, Plus, Power, Search, ShieldCheck, Trash2, UserPlus, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import RoleBadge from '$lib/admin/components/admin/RoleBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type User = {
    avatar_url?: string | null;
    created_at?: string;
    email: string;
    full_name: string;
    id: string;
    is_active: boolean;
    last_login_at?: string | null;
    phone?: string | null;
    role: string;
  };

  const ROLES = ['super_admin', 'admin', 'content_manager', 'booking_manager', 'finance_manager', 'editor', 'viewer'];
  const roleLabel = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  let rows: User[] = [];
  let loading = true;
  let saving = false;
  let savingPassword = false;
  let deleting = false;
  let error = '';
  let search = '';
  let roleFilter = 'all';
  let statusFilter = 'all';

  let currentRole = '';
  let currentEmail = '';
  $: isSuperAdmin = currentRole === 'super_admin';
  // Roles a non-super-admin may assign (cannot grant super_admin).
  $: assignableRoles = (isSuperAdmin ? ROLES : ROLES.filter((r) => r !== 'super_admin')).map((r) => ({ label: roleLabel(r), value: r }));

  let toasts: Toast[] = [];
  let modalOpen = false;
  let editing: User | null = null;
  let pwUser: User | null = null;
  let confirmOpen = false;
  let toDelete: User | null = null;
  let newPassword = '';

  const emptyForm = () => ({ full_name: '', email: '', password: '', phone: '', avatar_url: '', role: 'viewer', is_active: true });
  let form = emptyForm();

  $: stats = {
    total: rows.length,
    active: rows.filter((u) => u.is_active).length,
    superAdmins: rows.filter((u) => u.role === 'super_admin').length
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const fmtDate = (v?: string | null) => (v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : 'Never');
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

  // A super-admin row can only be managed by a super admin.
  const canManage = (u: User) => isSuperAdmin || u.role !== 'super_admin';
  const isSelf = (u: User) => u.email.toLowerCase() === currentEmail.toLowerCase();

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.users.list({ search, role: roleFilter, is_active: statusFilter === 'all' ? undefined : statusFilter, limit: 200 });
      rows = res.data.items as unknown as User[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load admin users.';
    } finally {
      loading = false;
    }
  };

  const openCreate = () => { editing = null; form = emptyForm(); modalOpen = true; };
  const openEdit = (u: User) => {
    editing = u;
    form = { full_name: u.full_name, email: u.email, password: '', phone: u.phone ?? '', avatar_url: u.avatar_url ?? '', role: u.role, is_active: u.is_active };
    modalOpen = true;
  };
  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { showToast('Name and email are required.', 'error'); return; }
    if (!editing && form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    saving = true;
    try {
      if (editing) {
        await api.users.update(editing.id, {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          role: form.role,
          is_active: form.is_active
        });
        showToast('User updated successfully.');
      } else {
        await api.users.create({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          role: form.role,
          is_active: form.is_active
        });
        showToast('User created successfully.');
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save user.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleStatus = async (u: User) => {
    try {
      await api.users.updateStatus(u.id, { is_active: !u.is_active });
      showToast(u.is_active ? 'User deactivated.' : 'User activated.');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  };

  const openPassword = (u: User) => { pwUser = u; newPassword = ''; };
  const closePassword = () => { pwUser = null; newPassword = ''; };
  const savePassword = async () => {
    if (!pwUser) return;
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    savingPassword = true;
    try {
      await api.users.updatePassword(pwUser.id, { password: newPassword });
      showToast('Password updated successfully.');
      closePassword();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update password.', 'error');
    } finally {
      savingPassword = false;
    }
  };

  const openDelete = (u: User) => { toDelete = u; confirmOpen = true; };
  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.users.remove(toDelete.id);
      showToast('User removed.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove user.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') ?? 'null');
      currentRole = String(u?.role ?? '');
      currentEmail = String(u?.email ?? '');
    } catch {
      currentRole = '';
    }
    load();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Administration"
    title="Admin Users"
    description="Manage CMS team accounts, roles, account status, and passwords."
    actionLabel="New User"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <div class="grid grid-cols-3 gap-3">
    {#each [['Total users', stats.total, 'text-ink'], ['Active', stats.active, 'text-emerald-600'], ['Super admins', stats.superAdmins, 'text-goldfinch-gold']] as [label, value, tone]}
      <div class="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold text-ink/50">{label}</p>
        <p class={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
      </div>
    {/each}
  </div>

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Name, email, phone..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Role" name="role_filter" bind:value={roleFilter} options={[{ label: 'All roles', value: 'all' }, ...ROLES.map((r) => ({ label: roleLabel(r), value: r }))]} />
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, { label: 'Active', value: 'true' }, { label: 'Inactive', value: 'false' }]} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading users..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState title="No admin users found" message="Create your first CMS team member to grant access to the Key2africa admin." actionLabel="New User" icon={UserPlus} on:action={openCreate} />
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[900px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">User</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Role</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Last login</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as u (u.id)}
              <CmsTable.Row class="transition hover:bg-sand/25">
                <CmsTable.Cell class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/10 text-xs font-bold text-forest">{initials(u.full_name)}</div>
                    <div class="min-w-0">
                      <p class="font-semibold text-ink">{u.full_name}{#if isSelf(u)}<span class="ml-1 text-[11px] font-medium text-ink/40">(you)</span>{/if}</p>
                      <p class="truncate text-xs text-ink/55">{u.email}</p>
                    </div>
                  </div>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3"><RoleBadge role={u.role} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  {#if u.is_active}
                    <span class="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/70">Active</span>
                  {:else}
                    <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">Inactive</span>
                  {/if}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3 text-ink/65">{fmtDate(u.last_login_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  <div class="flex justify-end gap-1.5">
                    {#if canManage(u)}
                      <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 bg-surface text-ink/70 shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" aria-label="Edit" onclick={() => openEdit(u)}><Edit size={15} /></CmsButton>
                      <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 bg-surface text-ink/70 shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" aria-label="Change password" onclick={() => openPassword(u)}><KeyRound size={15} /></CmsButton>
                      <CmsButton variant="ghost" class={`grid h-9 w-9 place-items-center rounded-xl border bg-surface shadow-sm transition ${u.is_active ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`} type="button" aria-label={u.is_active ? 'Deactivate' : 'Activate'} onclick={() => toggleStatus(u)}><Power size={15} /></CmsButton>
                      <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-surface text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-30" type="button" aria-label="Delete" disabled={isSelf(u)} onclick={() => openDelete(u)}><Trash2 size={15} /></CmsButton>
                    {:else}
                      <span class="inline-flex items-center gap-1 text-xs text-ink/35"><ShieldCheck size={13} />Super admin</span>
                    {/if}
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

<!-- create / edit modal -->
{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? editing.full_name : 'Create admin user'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-5 shadow-sm sm:p-6"  on:submit|preventDefault={save}>
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit user' : 'New user'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? editing.full_name : 'Create admin user'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}><X size={18} /></CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Full name" name="full_name" bind:value={form.full_name} required />
          <AdminFormInput label="Email" name="email" type="email" bind:value={form.email} required />
        </div>
        {#if !editing}
          <AdminFormInput label="Password" name="password" type="password" bind:value={form.password} placeholder="At least 8 characters" required />
        {/if}
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Phone" name="phone" bind:value={form.phone} />
          <AdminSelect label="Role" name="role" bind:value={form.role} options={assignableRoles} />
        </div>
        <!-- Square: the topbar renders this in a round 9x9 frame with object-cover. -->
        <MediaPicker label="Avatar" uploadFolder="users/avatars" aspect="aspect-square" bind:value={form.avatar_url} />
        <CmsLabel class="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 transition hover:bg-sand/30">
          <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_active} />
          <div>
            <p class="text-sm font-semibold text-ink">Active account</p>
            <p class="text-xs text-ink/50">Inactive users cannot sign in to the admin.</p>
          </div>
        </CmsLabel>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}</AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<!-- change password modal -->
{#if pwUser}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closePassword)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),28rem);max-width:none">
      <CmsDialog.Title class="sr-only">{pwUser.full_name}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"  on:submit|preventDefault={savePassword}>
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Change password</p>
          <h2 class="mt-1 text-xl font-bold text-ink">{pwUser.full_name}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closePassword}><X size={18} /></CmsButton>
      </div>
      <div class="mt-5">
        <AdminFormInput label="New password" name="new_password" type="password" bind:value={newPassword} placeholder="At least 8 characters" required />
      </div>
      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closePassword}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={savingPassword}><KeyRound size={15} />{savingPassword ? 'Saving...' : 'Update Password'}</AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Remove admin user"
  message={`Remove "${toDelete?.full_name ?? 'this user'}"? This soft-deletes the account and revokes access.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">Removing user...</div>
{/if}
