<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ArrowLeft, MessageCircle, Sparkles } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';

  type Msg = { id: string; role: string; content: string; created_at: string };
  type Match = {
    tour_id?: string;
    confidence_label?: string;
    score?: number;
    reasons?: string[];
    limitations?: string[];
    price_note?: string;
    tours?: { title?: string; slug?: string; price_from?: number; currency?: string } | null;
  };
  type Detail = {
    conversation: Record<string, unknown>;
    messages: Msg[];
    lead_context: Record<string, unknown> | null;
    tour_matches: Match[];
    usage: { calls: number; cost: number };
  };

  $: id = $page.params.id ?? '';
  let data: Detail | null = null;
  let loading = true;
  let error = '';
  let busy = false;
  let notice = '';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.aiTravelAdvisor.conversation(id);
      data = res.data as unknown as Detail;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load conversation.';
    } finally {
      loading = false;
    }
  };

  onMount(load);

  const setLead = async (lead_status: string) => {
    busy = true;
    notice = '';
    try {
      await api.aiTravelAdvisor.updateStatus(id, { lead_status });
      notice = `Marked ${lead_status}.`;
      await load();
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Update failed.';
    } finally {
      busy = false;
    }
  };

  const createBooking = async () => {
    busy = true;
    notice = '';
    try {
      const res = await api.aiTravelAdvisor.adminCreateBooking(id);
      notice = res.data.booking_request_id
        ? `Booking request created (${res.data.status}).`
        : res.data.missing?.length
          ? `Cannot create yet — missing: ${res.data.missing.join(', ')}.`
          : res.data.error || 'Could not create booking request.';
      await load();
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Create failed.';
    } finally {
      busy = false;
    }
  };

  const str = (v: unknown) => (v == null ? '' : String(v));
  const conv = () => data?.conversation ?? {};
  const lead = () => data?.lead_context ?? {};
  const fmt = (v?: string) => (v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '');
  $: waDigits = str((lead() as Record<string, unknown>).phone || (conv() as Record<string, unknown>).visitor_phone).replace(/\D/g, '');
  // Show only meaningful lead fields.
  const LEAD_FIELDS = ['full_name', 'email', 'phone', 'country', 'traveler_type', 'adults', 'children', 'total_travelers', 'destination_interest', 'experience_interest', 'preferred_month', 'start_date', 'end_date', 'budget_tier', 'comfort_level', 'urgency', 'message_summary'];
</script>

<svelte:head><title>AI Conversation | Key2africa CMS</title></svelte:head>

<section class="grid gap-5">
  <a class="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-forest hover:text-heading" href="/admin/ai-conversations"><ArrowLeft size={15} /> All conversations</a>

  {#if loading}
    <div class="h-64 animate-pulse rounded-xl bg-black/5"></div>
  {:else if error}
    <p class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
  {:else if data}
    {@const c = conv()}
    <!-- header + actions -->
    <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-ink">{str(c.visitor_name) || 'Anonymous visitor'}</h1>
          <p class="mt-1 text-sm text-ink/55">{str(c.visitor_email) || str(c.source_page) || '—'}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={str(c.status) || 'in_progress'} />
            <StatusBadge status={str(c.lead_status) || 'cold'} />
            <span class="text-xs font-semibold text-ink/50">Lead score {str(c.lead_score) || '0'}</span>
            {#if c.handoff_required}<span class="rounded bg-goldfinch-gold/20 px-2 py-0.5 text-[11px] font-bold text-clay">Handoff required</span>{/if}
            <span class="text-xs text-ink/45">· {data.usage.calls} AI calls · ${data.usage.cost.toFixed(4)}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <CmsButton variant="ghost" class="rounded-lg bg-forest px-3 py-2 text-xs font-bold text-white transition hover:bg-deep-green disabled:opacity-50" disabled={busy} onclick={() => setLead('contacted' as string)}>Mark contacted</CmsButton>
          <CmsButton variant="ghost" class="rounded-lg bg-forest px-3 py-2 text-xs font-bold text-white transition hover:bg-deep-green disabled:opacity-50" disabled={busy} onclick={() => setLead('qualified')}>Mark qualified</CmsButton>
          <CmsButton variant="ghost" class="rounded-lg border border-ink/15 px-3 py-2 text-xs font-bold text-ink/70 transition hover:bg-black/5 disabled:opacity-50" disabled={busy} onclick={() => setLead('lost')}>Mark lost</CmsButton>
          <CmsButton variant="ghost" class="inline-flex items-center gap-1.5 rounded-lg bg-goldfinch-gold px-3 py-2 text-xs font-bold text-heading transition hover:brightness-105 disabled:opacity-50" disabled={busy} onclick={createBooking}><Sparkles size={13} /> Create booking</CmsButton>
          {#if waDigits}<a class="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a>{/if}
        </div>
      </div>
      {#if notice}<p class="mt-3 rounded-lg bg-sand/60 px-3 py-2 text-sm text-ink/75">{notice}</p>{/if}
    </div>

    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <!-- transcript -->
      <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
        <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Transcript</h2>
        <div class="mt-3 grid gap-2.5">
          {#each data.messages as m (m.id)}
            <div class={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div class={`max-w-[85%] rounded-[12px] px-3 py-2 text-sm leading-6 ${m.role === 'user' ? 'bg-forest text-white' : 'bg-sand/50 text-ink'}`}>
                <p class="whitespace-pre-wrap">{m.content}</p>
                <p class={`mt-1 text-[10px] ${m.role === 'user' ? 'text-white/60' : 'text-ink/40'}`}>{m.role} · {fmt(m.created_at)}</p>
              </div>
            </div>
          {:else}
            <p class="text-sm text-ink/50">No messages.</p>
          {/each}
        </div>
      </div>

      <!-- sidebar: lead + recommendations -->
      <div class="grid gap-5">
        <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
          <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Lead context</h2>
          <dl class="mt-3 grid gap-1.5 text-sm">
            {#each LEAD_FIELDS as f}
              {@const val = (lead() as Record<string, unknown>)[f]}
              {#if val != null && String(val).length && !(Array.isArray(val) && !val.length)}
                <div class="flex justify-between gap-3">
                  <dt class="text-ink/45">{f.replace(/_/g, ' ')}</dt>
                  <dd class="text-right font-medium text-ink">{Array.isArray(val) ? val.join(', ') : String(val)}</dd>
                </div>
              {/if}
            {/each}
            {#if !data.lead_context}<p class="text-sm text-ink/50">No lead details captured yet.</p>{/if}
          </dl>
        </div>

        <div class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
          <h2 class="text-sm font-bold uppercase tracking-wide text-ink/55">Recommended tours</h2>
          <div class="mt-3 grid gap-2.5">
            {#each data.tour_matches as m, i (i)}
              <article class="rounded-xl border border-ink/10 p-3">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-bold text-heading">{m.tours?.title || 'Tour'}</p>
                  {#if m.confidence_label}<span class="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold text-clay">{m.confidence_label}{#if m.score != null} · {m.score}{/if}</span>{/if}
                </div>
                {#if m.reasons?.length}<ul class="mt-1.5 list-disc pl-4 text-xs text-ink/65">{#each m.reasons.slice(0, 3) as r}<li>{r}</li>{/each}</ul>{/if}
                {#if m.tours?.slug}<a class="mt-1.5 inline-block text-xs font-bold text-forest" href={`/tours/${m.tours.slug}`} target="_blank" rel="noopener noreferrer">View tour →</a>{/if}
              </article>
            {:else}
              <p class="text-sm text-ink/50">No tour recommendations recorded.</p>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>
