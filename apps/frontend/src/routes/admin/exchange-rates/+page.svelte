<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldCheck } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import type { CurrencyApiState } from '$lib/admin/types';

  type ExchangeRateStatus = CurrencyApiState & {
    refreshEnabled?: boolean;
    schedule?: string;
    timezone?: string;
    cacheHours?: number;
    enabledCurrencies?: string[];
    monthlyRequestEstimate?: number;
    refreshed?: boolean;
    reason?: string;
    errorCode?: string;
    errorMessage?: string;
    lastError?: { code?: string; message?: string; at?: string } | null;
  };

  let status: ExchangeRateStatus | null = null;
  let loading = true;
  let refreshing = false;
  let error = '';
  let notice = '';

  const dateTime = (iso?: string | null) =>
    iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'Not available';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.exchangeRates.status();
      status = res.data as ExchangeRateStatus;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load exchange-rate status.';
      status = null;
    } finally {
      loading = false;
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    notice = '';
    error = '';
    try {
      const res = await api.exchangeRates.refresh();
      status = res.data as ExchangeRateStatus;
      notice = status.refreshed
        ? 'Rates refreshed and cached.'
        : status.errorMessage || (status.reason === 'locked' ? 'Another server is refreshing rates right now.' : 'Cached rates were kept.');
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Manual refresh failed.';
    } finally {
      refreshing = false;
    }
  };

  onMount(load);

  $: rates = status
    ? (status.supportedCurrencies ?? []).filter((currency) => currency.enabled).map((currency) => ({
        ...currency,
        rate: status?.rates?.[currency.code] ?? null
      }))
    : [];
  $: statusLabel = status?.status === 'missing' ? 'USD only' : status?.isStale ? 'Stale cache' : 'Fresh cache';
  $: statusClass = status?.status === 'missing'
    ? 'bg-amber-500/10 text-amber-700'
    : status?.isStale
      ? 'bg-orange-500/10 text-orange-700'
      : 'bg-emerald-500/10 text-emerald-700';
</script>

<section class="grid gap-6">
  <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Pricing engine</p>
      <h2 class="mt-1 text-2xl font-bold text-ink">Exchange Rates</h2>
      <p class="mt-1 max-w-2xl text-sm text-ink/55">Cached Open Exchange Rates snapshots for public package-price display. Secrets stay in the backend environment.</p>
    </div>
    <AdminButton on:click={refresh} disabled={refreshing || loading}>
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
      {refreshing ? 'Refreshing' : 'Manual refresh'}
    </AdminButton>
  </div>

  {#if loading}
    <LoadingState message="Loading exchange rates..." />
  {:else if error && !status}
    <ErrorState message={error} />
  {:else if status}
    {#if notice}
      <div class="rounded-[8px] border border-forest/20 bg-forest/[0.06] p-4 text-sm font-semibold text-forest">{notice}</div>
    {/if}
    {#if error}
      <div class="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
    {/if}

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Status</p>
        <p class={`mt-3 inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm font-extrabold ${statusClass}`}>
          {#if status.status === 'missing'}<AlertTriangle size={15} />{:else}<CheckCircle2 size={15} />{/if}
          {statusLabel}
        </p>
        <p class="mt-3 text-xs leading-5 text-ink/55">{status.status === 'missing' ? 'No provider snapshot exists yet. Public display falls back to USD only.' : 'Latest successful snapshot is served from the database cache.'}</p>
      </article>

      <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Last refresh</p>
        <p class="mt-3 text-sm font-extrabold text-heading">{dateTime(status.lastUpdated)}</p>
        <p class="mt-2 text-xs text-ink/55">Provider timestamp: {dateTime(status.providerTimestamp)}</p>
      </article>

      <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Next refresh</p>
        <p class="mt-3 text-sm font-extrabold text-heading">{dateTime(status.nextRefresh)}</p>
        <p class="mt-2 inline-flex items-center gap-1.5 text-xs text-ink/55"><Clock size={13} /> {status.schedule} · {status.timezone}</p>
      </article>

      <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Markup</p>
        <p class="mt-3 text-2xl font-extrabold text-heading">{status.markupPercent ?? 0}%</p>
        <p class="mt-2 text-xs text-ink/55">Applied only to displayed conversions; provider rates remain unchanged.</p>
      </article>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section class="overflow-hidden rounded-[8px] border border-ink/10 bg-surface shadow-sm">
        <div class="flex flex-col gap-1 border-b border-ink/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-base font-extrabold text-heading">Current rates</h3>
            <p class="mt-1 text-xs text-ink/55">All values are relative to 1 USD from the latest successful cached snapshot.</p>
          </div>
          <span class="rounded-[8px] bg-sand px-3 py-1 text-xs font-bold text-ink/60">Base {status.baseCurrency}</span>
        </div>
        <div class="divide-y divide-ink/10">
          {#each rates as row (row.code)}
            <div class="grid gap-2 px-5 py-4 sm:grid-cols-[120px_1fr_140px] sm:items-center">
              <div>
                <p class="font-extrabold text-heading">{row.code}</p>
                <p class="text-xs text-ink/50">{row.name}</p>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-sand">
                <span class={`block h-full ${row.available ? 'bg-forest' : 'bg-amber-500'}`} style={`width:${row.available ? '100%' : '18%'}`}></span>
              </div>
              <p class="text-sm font-bold text-ink sm:text-right">{row.rate ?? 'Unavailable'}</p>
            </div>
          {/each}
        </div>
      </section>

      <aside class="grid gap-4">
        <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
          <p class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-forest/70"><ShieldCheck size={14} /> Security</p>
          <p class="mt-3 text-sm leading-6 text-ink/65">The App ID is never returned by this API, never shipped to SvelteKit, and never called from the browser. Public pages read cached rates only.</p>
        </article>

        <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Usage estimate</p>
          <p class="mt-3 text-2xl font-extrabold text-heading">{status.monthlyRequestEstimate ?? 60}</p>
          <p class="mt-1 text-xs text-ink/55">provider requests/month at the configured schedule.</p>
        </article>

        <article class="rounded-[8px] border border-ink/10 bg-surface p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Last error</p>
          {#if status.lastError}
            <p class="mt-3 text-sm font-bold text-red-700">{status.lastError.message}</p>
            <p class="mt-1 text-xs text-ink/50">{status.lastError.code} · {dateTime(status.lastError.at)}</p>
          {:else}
            <p class="mt-3 text-sm font-semibold text-ink/55">No refresh errors logged.</p>
          {/if}
        </article>
      </aside>
    </div>
  {/if}
</section>
