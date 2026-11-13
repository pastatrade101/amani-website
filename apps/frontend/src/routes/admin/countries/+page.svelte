<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { Edit, ExternalLink, Globe, Plus, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { EAST_AFRICA_COUNTRIES, countryGroups, countryHref, countrySlug } from '$lib/countries';
  import type { Country } from '$lib/types/api';

  // A country page (/destinations/kenya) lists every published destination
  // whose Country is set to it. This record adds what places can't say: the
  // country's photo, intro and travel facts. Without one, the page uses its places.
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const emptyForm = (name = '') => ({
    name,
    hero_image_url: '',
    intro_text: '',
    capital: '',
    currency: '',
    best_months: [] as string[],
    visa_info: '',
    health_info: '',
    status: 'draft' as NonNullable<Country['status']>,
    meta_title: '',
    meta_description: ''
  });

  let rows: Country[] = [];
  let placeCounts = new Map<string, number>();
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let modalOpen = false;
  let confirmOpen = false;
  let editing: Country | null = null;
  let toDelete: Country | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  // Countries that have places on the site but no record of their own yet.
  $: recorded = new Set(rows.map((row) => countrySlug(row.name)));
  $: missing = [...placeCounts].filter(([slug]) => !recorded.has(slug));
  $: nameOptions = EAST_AFRICA_COUNTRIES.filter((name) => !recorded.has(countrySlug(name)) || (editing && countrySlug(editing.name) === countrySlug(name))).map((name) => ({ label: name, value: name }));
  const nameOf = (slug: string) => EAST_AFRICA_COUNTRIES.find((name) => countrySlug(name) === slug) ?? slug;
  const places = (name: string) => placeCounts.get(countrySlug(name)) ?? 0;

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
      const [countries, destinations] = await Promise.all([
        api.countries.list({ status: 'all', limit: 100 }),
        api.destinations.list({ status: 'published', limit: 100 }).catch(() => null)
      ]);
      rows = countries.data.items as Country[];
      if (destinations) placeCounts = new Map(countryGroups(destinations.data.items as { country?: string | null }[]).map((group) => [group.slug, group.count]));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load countries.';
    } finally {
      loading = false;
    }
  };

  const openCreate = (name = '') => {
    editing = null;
    form = emptyForm(name || nameOptions[0]?.value || '');
    modalOpen = true;
  };

  const openEdit = (c: Country) => {
    editing = c;
    form = {
      name: c.name,
      hero_image_url: c.hero_image_url ?? '',
      intro_text: c.intro_text ?? '',
      capital: c.capital ?? '',
      currency: c.currency ?? '',
      best_months: Array.isArray(c.best_months) ? [...c.best_months] : [],
      visa_info: c.visa_info ?? '',
      health_info: c.health_info ?? '',
      status: c.status ?? 'draft',
      meta_title: c.meta_title ?? '',
      meta_description: c.meta_description ?? ''
    };
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };
  const toggleMonth = (month: string, on: boolean) => {
    form.best_months = on ? MONTHS.filter((m) => m === month || form.best_months.includes(m)) : form.best_months.filter((m) => m !== month);
  };

  const save = async () => {
    if (!form.name) { showToast('Choose the country.', 'error'); return; }
    saving = true;
    const payload = {
      name: form.name,
      slug: countrySlug(form.name),
      hero_image_url: form.hero_image_url.trim() || null,
      intro_text: form.intro_text.trim() || null,
      capital: form.capital.trim() || null,
      currency: form.currency.trim() || null,
      best_months: form.best_months,
      visa_info: form.visa_info.trim() || null,
      health_info: form.health_info.trim() || null,
      status: form.status,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null
    };
    try {
      if (editing) {
        await api.countries.update(editing.id, payload);
        showToast(`${form.name} updated.`);
      } else {
        await api.countries.create(payload);
        showToast(`${form.name} created.`);
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save the country.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDelete = (c: Country) => { toDelete = c; confirmOpen = true; };
  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.countries.remove(toDelete.id);
      showToast(`${toDelete.name} deleted.`);
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete the country.', 'error');
    } finally {
      deleting = false;
    }
  };

  const fmt = (v?: string) => v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '-';

  onMount(load);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Safaris & destinations"
    title="Countries"
    description="Each country has a page at /destinations/country-name listing its published destinations. Add a photo, an intro and travel facts here; until a country is published, its page uses its places only."
    actionLabel="New Country"
    actionIcon={Plus}
    on:action={() => openCreate()}
  />

  {#if !loading && !error && missing.length}
    <div class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:flex sm:flex-wrap sm:items-center">
      <p class="text-sm text-ink/70 sm:mr-auto">These countries have places on the site but no intro or photo yet:</p>
      {#each missing as [slug, count] (slug)}
        <AdminButton variant="secondary" on:click={() => openCreate(nameOf(slug))}>Add {nameOf(slug)} ({count} {count === 1 ? 'place' : 'places'})</AdminButton>
      {/each}
    </div>
  {/if}

  {#if loading}
    <LoadingState message="Loading countries..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState title="No country pages written yet" message="Country pages already list their places. Add a country to give its page a photo, an intro and travel facts." actionLabel="New Country" icon={Globe} on:action={() => openCreate()} />
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[760px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Country</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Places</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as c (c.id)}
              <CmsTable.Row class="transition hover:bg-sand/25">
                <CmsTable.Cell class="px-4 py-4">
                  <div class="font-semibold text-ink">{c.name}</div>
                  <a class="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-ink/50 hover:text-ink" href={countryHref(c.name)} target="_blank" rel="noopener">{countryHref(c.name)}<ExternalLink size={12} /></a>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{places(c.name)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={c.status ?? 'draft'} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{fmt(c.updated_at ?? c.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-lg border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:bg-sand/70" type="button" onclick={() => openEdit(c)}>
                      <Edit size={14} />Edit
                    </CmsButton>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(c)}>
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

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) closeModal(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),46rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? editing.name : 'Add a country'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">The country page's photo, intro and travel facts.</CmsDialog.Description>
      <form class="max-h-[92vh] w-full overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm" on:submit|preventDefault={save}>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold text-ink">{editing ? editing.name : 'Add a country'}</h2>
            <p class="mt-1 text-sm text-ink/60">{form.name ? `Shown on ${countryHref(form.name)}, with its ${places(form.name)} published ${places(form.name) === 1 ? 'place' : 'places'}.` : 'Choose the country.'}</p>
          </div>
          <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
            <X size={18} />
          </CmsButton>
        </div>

        <div class="mt-6 grid gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            {#if editing}
              <div class="cms-field"><span class="text-sm font-medium text-ink">Country</span><p class="flex h-11 items-center rounded-lg border border-ink/10 bg-sand/40 px-3 text-sm text-ink">{form.name}</p></div>
            {:else}
              <AdminSelect label="Country" name="name" bind:value={form.name} options={nameOptions} />
            {/if}
            <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
          </div>

          <MediaPicker label="Hero photo" uploadFolder="countries" aspect="aspect-[16/9]" bind:value={form.hero_image_url} />
          <AdminTextArea label="Intro" name="intro_text" bind:value={form.intro_text} rows={4} placeholder="Two or three sentences under the country's name at the top of its page." />

          <div class="grid gap-4 sm:grid-cols-2">
            <AdminFormInput label="Capital" name="capital" bind:value={form.capital} />
            <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="e.g. Kenyan shilling (KES)" />
          </div>

          <fieldset class="grid gap-2">
            <legend class="text-sm font-medium text-ink">Best months to go</legend>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {#each MONTHS as month (month)}
                <CmsLabel class="flex cursor-pointer items-center gap-2 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-sm text-ink">
                  <CmsCheckbox class="h-4 w-4" checked={form.best_months.includes(month)} onCheckedChange={(on) => toggleMonth(month, on === true)} />
                  {month.slice(0, 3)}
                </CmsLabel>
              {/each}
            </div>
          </fieldset>

          <AdminTextArea label="Visas" name="visa_info" bind:value={form.visa_info} rows={3} placeholder="What travellers need to enter the country." />
          <AdminTextArea label="Health" name="health_info" bind:value={form.health_info} rows={3} placeholder="Vaccinations, malaria advice and other health notes." />

          <div class="grid gap-4 sm:grid-cols-2">
            <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} />
            <AdminFormInput label="Meta description" name="meta_description" bind:value={form.meta_description} />
          </div>
        </div>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
          <AdminButton type="submit" disabled={saving || !form.name}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Country'}
          </AdminButton>
        </div>
      </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete country"
  message={`Delete ${toDelete?.name ?? 'this country'}? Its page keeps listing its places, without the photo, intro and facts.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting country...
  </div>
{/if}
