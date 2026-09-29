<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { Activity, CircleDollarSign } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';

  type Stats = {
    aiEnabled: boolean;
    tier: string;
    spendTodayUsd: number;
    spendMonthUsd: number;
    dailyBudgetUsd: number;
    monthlyBudgetUsd: number;
    dailyRemainingUsd: number;
    monthlyRemainingUsd: number;
    messagesToday: number;
    anthropicCallsToday: number;
    skippedNoAiToday: number;
    semanticCacheHitsToday: number;
    blockedRateLimitToday: number;
    blockedBudgetToday: number;
    degradedToday: number;
    costByModel: Array<{ model: string; cost: number; calls: number }>;
    costByRoute: Array<{ route: string; count: number; cost: number }>;
    topConversations: Array<{ conversation_id: string; cost: number; messages: number }>;
  };

  let stats: Stats | null = null;
  let evals: Array<Record<string, unknown>> = [];
  let loading = true;
  let error = '';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const [usageRes, evalRes] = await Promise.allSettled([api.aiTravelAdvisor.usage(), api.aiTravelAdvisor.evals()]);
      if (usageRes.status === 'fulfilled') stats = usageRes.value.data as unknown as Stats;
      if (evalRes.status === 'fulfilled') evals = evalRes.value.data ?? [];
      if (usageRes.status === 'rejected') throw usageRes.reason;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load AI usage.';
    } finally {
      loading = false;
    }
  };

  onMount(load);

  const usd = (n: number) => `$${Number(n ?? 0).toFixed(n >= 1 ? 2 : 4)}`;
  const pct = (used: number, budget: number) => (budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0);
  $: evalPassed = evals.filter((e) => e.passed === true).length;
  $: evalFailed = evals.filter((e) => e.passed === false).length;

  // On-demand maintenance (also runs nightly via the ai:nightly job).
  let busy = '';
  let notice = '';
  const runEvals = async () => {
    busy = 'evals';
    notice = '';
    try {
      const res = await api.aiTravelAdvisor.runEvals();
      notice = `Eval sweep: ${res.data.passed}/${res.data.total} passed${res.data.failed ? `, ${res.data.failed} failed` : ''}.`;
      await load();
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Eval sweep failed.';
    } finally {
      busy = '';
    }
  };
  const purgeRetention = async () => {
    busy = 'purge';
    notice = '';
    try {
      const res = await api.aiTravelAdvisor.purgeRetention();
      notice = `Purged ${res.data.purged} anonymous conversation(s) older than ${res.data.retentionDays} days.`;
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Purge failed.';
    } finally {
      busy = '';
    }
  };
  const refreshEmbeddings = async () => {
    busy = 'embeddings';
    notice = '';
    try {
      const res = await api.aiTravelAdvisor.refreshEmbeddings();
      notice = res.data.alreadyRunning
        ? 'An embeddings refresh is already running — check back shortly.'
        : 'Embeddings refresh started — it runs in the background (see server logs for the result).';
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Embeddings refresh failed.';
    } finally {
      busy = '';
    }
  };
</script>

<svelte:head><title>AI Usage | Key2africa CMS</title></svelte:head>

<section class="grid gap-6">
  <AdminPageHeader eyebrow="AI System" title="AI Usage & Cost" description="Live Anthropic spend, budget headroom, route mix and abuse signals for the Key2africa Travel Advisor." />

  <!-- maintenance actions (also run nightly via the ai:nightly job) -->
  <div class="flex flex-wrap items-center gap-3">
    <CmsButton variant="ghost"
      class="inline-flex h-9 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-bold text-white transition hover:bg-deep-green disabled:opacity-60"
      type="button"
      onclick={runEvals}
      disabled={busy !== ''}
    >
      {busy === 'evals' ? 'Running eval sweep…' : 'Run eval sweep'}
    </CmsButton>
    <CmsButton variant="ghost"
      class="inline-flex h-9 items-center gap-2 rounded-lg border border-ink/15 bg-surface px-4 text-sm font-bold text-ink transition hover:bg-black/5 disabled:opacity-60"
      type="button"
      onclick={refreshEmbeddings}
      disabled={busy !== ''}
    >
      {busy === 'embeddings' ? 'Refreshing embeddings…' : 'Refresh embeddings'}
    </CmsButton>
    <CmsButton variant="ghost"
      class="inline-flex h-9 items-center gap-2 rounded-lg border border-ink/15 bg-surface px-4 text-sm font-bold text-ink transition hover:bg-black/5 disabled:opacity-60"
      type="button"
      onclick={purgeRetention}
      disabled={busy !== ''}
    >
      {busy === 'purge' ? 'Purging…' : 'Purge old anonymous chats'}
    </CmsButton>
    {#if notice}<span class="text-sm font-medium text-ink/70">{notice}</span>{/if}
  </div>

  {#if loading}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{#each Array(4) as _}<div class="h-24 animate-pulse rounded-xl bg-black/5"></div>{/each}</div>
  {:else if error}
    <p class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
  {:else if stats}
    <!-- status + budget -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
        <p class="text-xs font-semibold text-ink/50">Assistant status</p>
        <p class="mt-1 text-lg font-bold {stats.aiEnabled ? 'text-forest' : 'text-red-600'}">{stats.aiEnabled ? 'Enabled' : 'Disabled'}</p>
        <p class="mt-0.5 text-xs capitalize text-ink/50">Mode: {stats.tier.replace(/_/g, ' ')}</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
        <div class="flex items-center justify-between"><p class="text-xs font-semibold text-ink/50">Today's spend</p><CircleDollarSign size={16} class="text-goldfinch-gold" /></div>
        <p class="mt-1 text-2xl font-extrabold text-heading">{usd(stats.spendTodayUsd)}</p>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10"><div class="h-full rounded-full bg-forest" style={`width:${pct(stats.spendTodayUsd, stats.dailyBudgetUsd)}%`}></div></div>
        <p class="mt-1 text-[11px] text-ink/45">{usd(stats.dailyRemainingUsd)} left of {usd(stats.dailyBudgetUsd)}/day</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
        <div class="flex items-center justify-between"><p class="text-xs font-semibold text-ink/50">This month</p><CircleDollarSign size={16} class="text-goldfinch-gold" /></div>
        <p class="mt-1 text-2xl font-extrabold text-heading">{usd(stats.spendMonthUsd)}</p>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10"><div class="h-full rounded-full bg-forest" style={`width:${pct(stats.spendMonthUsd, stats.monthlyBudgetUsd)}%`}></div></div>
        <p class="mt-1 text-[11px] text-ink/45">{usd(stats.monthlyRemainingUsd)} left of {usd(stats.monthlyBudgetUsd)}/mo</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
        <div class="flex items-center justify-between"><p class="text-xs font-semibold text-ink/50">Messages today</p><Activity size={16} class="text-forest" /></div>
        <p class="mt-1 text-2xl font-extrabold text-heading">{stats.messagesToday}</p>
        <p class="mt-0.5 text-[11px] text-ink/45">{stats.anthropicCallsToday} Anthropic calls</p>
      </div>
    </div>

    <!-- cost-control signals -->
    <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {#each [['No-AI skipped', stats.skippedNoAiToday], ['Cache hits', stats.semanticCacheHitsToday], ['Degraded', stats.degradedToday], ['Rate-limited', stats.blockedRateLimitToday], ['Budget-blocked', stats.blockedBudgetToday]] as signal}
        <div class="rounded-xl border border-ink/10 bg-surface p-3.5 shadow-card">
          <p class="text-[11px] font-semibold text-ink/50">{signal[0]}</p>
          <p class="mt-1 text-xl font-bold text-ink">{signal[1]}</p>
        </div>
      {/each}
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- cost by model -->
      <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
        <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Cost by model (month)</h2>
        <div class="mt-3 grid gap-2">
          {#each stats.costByModel as m}
            <div class="flex items-center justify-between text-sm"><span class="font-medium text-ink/75">{m.model}</span><span class="text-ink/55">{m.calls} calls · <span class="font-bold text-heading">{usd(m.cost)}</span></span></div>
          {:else}<p class="text-sm text-ink/45">No model calls yet.</p>{/each}
        </div>
      </div>
      <!-- cost by route -->
      <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
        <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Requests by route (month)</h2>
        <div class="mt-3 grid gap-2">
          {#each stats.costByRoute as r}
            <div class="flex items-center justify-between text-sm"><span class="font-medium capitalize text-ink/75">{r.route.replace(/_/g, ' ')}</span><span class="text-ink/55">{r.count} · {usd(r.cost)}</span></div>
          {:else}<p class="text-sm text-ink/45">No requests yet.</p>{/each}
        </div>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- most expensive conversations -->
      <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
        <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Most expensive conversations</h2>
        <div class="mt-3 grid gap-2">
          {#each stats.topConversations as c}
            <a class="flex items-center justify-between text-sm hover:text-forest" href={`/admin/ai-conversations/${c.conversation_id}`}>
              <span class="truncate font-mono text-xs text-ink/55">{c.conversation_id.slice(0, 8)}…</span>
              <span class="text-ink/60">{c.messages} msgs · <span class="font-bold text-heading">{usd(c.cost)}</span></span>
            </a>
          {:else}<p class="text-sm text-ink/45">No conversations yet.</p>{/each}
        </div>
      </div>
      <!-- eval summary -->
      <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
        <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Latest evals</h2>
        {#if evals.length}
          <div class="mt-3 flex items-center gap-4">
            <p class="text-2xl font-extrabold text-forest">{evalPassed}<span class="text-sm font-medium text-ink/45"> passed</span></p>
            <p class="text-2xl font-extrabold {evalFailed ? 'text-red-600' : 'text-ink/30'}">{evalFailed}<span class="text-sm font-medium text-ink/45"> failed</span></p>
          </div>
          <p class="mt-1 text-xs text-ink/45">Across the {evals.length} most recent eval records.</p>
        {:else}
          <p class="mt-3 text-sm text-ink/45">No eval runs yet. The nightly eval harness lands in Phase 6.</p>
        {/if}
      </div>
    </div>
  {/if}
</section>
