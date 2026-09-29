<script lang="ts">
  import { onMount } from 'svelte';
  import { BarChart3, Bot, CheckCircle2, MessageCircle, ShieldCheck, XCircle, Users } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminWhatsAppConnection from '$lib/admin/components/admin/AdminWhatsAppConnection.svelte';

  type Status = { configured: boolean; portalId?: string | null };
  let data: Record<string, Status> | null = null;
  let whatsappConnection: Record<string, any> | null = null;
  let loading = true;

  const load = async () => {
    loading = true;
    try {
      const res = await api.analytics.integrations();
      data = res.data as Record<string, Status>;
    } catch {
      data = null;
    } finally {
      loading = false;
    }
    // Separate from the env-status list above: which WhatsApp account sends is
    // now a thing the business owns, not a variable on the server.
    try {
      whatsappConnection = (await api.whatsapp.connection()).data;
    } catch {
      whatsappConnection = null;
    }
  };
  onMount(load);

  $: rows = data
    ? [
        { key: 'ga4', onLabel: undefined as string | undefined, icon: BarChart3, name: 'Google Analytics 4', status: data.ga4, env: ['GA4_PROPERTY_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'], hint: 'Service-account credentials (backend only). Powers the traffic section of the analytics dashboard.' },
        { key: 'hubspot', icon: Users, name: 'HubSpot CRM', status: data.hubspot, env: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PORTAL_ID'], hint: 'Private-app token. Leads sync to HubSpot contacts/deals when connected.' },
        { key: 'whatsappCloudApi', icon: MessageCircle, name: 'WhatsApp Cloud API (server fallback)', status: data.whatsappCloudApi, env: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'], onLabel: 'Configured', hint: 'The sender used until a business connects their own account above. Nothing to click here — use the panel at the top.' },
        { key: 'aiAdvisor', icon: Bot, name: 'AI Travel Advisor', status: data.aiAdvisor, env: ['ANTHROPIC_API_KEY'], hint: 'Anthropic key for the public AI advisor.' },
        { key: 'turnstile', icon: ShieldCheck, name: 'Cloudflare Turnstile', status: data.turnstile, env: ['TURNSTILE_SECRET_KEY'], hint: 'Optional bot protection for the AI advisor.' }
      ]
    : [];
</script>

<section class="grid gap-6">
  <div>
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Settings</p>
    <h2 class="mt-1 text-2xl font-bold text-ink">Integrations</h2>
    <p class="mt-1 text-sm text-ink/55">Connection status for external services. Secrets live in the backend environment and are never shown here.</p>
  </div>

  {#if loading}
    <div class="grid gap-4">{#each Array(5) as _}<div class="h-24 animate-pulse rounded-[10px] border border-ink/10 bg-surface/70"></div>{/each}</div>
  {:else if !data}
    <p class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to load integration status.</p>
  {:else}
    <div class="grid gap-4">
      {#if whatsappConnection}
        <AdminWhatsAppConnection bind:connection={whatsappConnection} />
      {/if}

      {#each rows as row}
        {@const Icon = row.icon}
        <article class="flex flex-col gap-4 rounded-[10px] border border-ink/10 bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest/10 text-forest ring-1 ring-ink/5 dark:text-goldfinch-gold"><Icon size={19} /></span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-bold text-ink">{row.name}</p>
                {#if row.status?.portalId}<span class="rounded bg-sand/70 px-1.5 py-0.5 text-[10px] font-bold text-ink/60">Portal {row.status.portalId}</span>{/if}
              </div>
              <p class="mt-0.5 text-sm text-ink/55">{row.hint}</p>
              <p class="mt-1.5 flex flex-wrap gap-1.5">
                {#each row.env as v}<code class="rounded bg-ink/5 px-1.5 py-0.5 text-[11px] font-semibold text-ink/60">{v}</code>{/each}
              </p>
            </div>
          </div>
          <div class="shrink-0">
            {#if row.status?.configured}
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 size={15} /> {row.onLabel ?? 'Connected'}</span>
            {:else}
              <span class="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold text-ink/50"><XCircle size={15} /> Not configured</span>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
