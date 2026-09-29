<script lang="ts">
  // Provenance chip — every metric declares which real source it came from, so
  // the dashboard never blurs GA4 / Clarity / first-party data together. New
  // providers just add a row here; no UI redesign needed.
  export let source = 'makutano';

  const MAP: Record<string, { label: string; color: string }> = {
    makutano: { label: 'Makutano AI', color: '#153733' },
    business: { label: 'Makutano AI', color: '#153733' },
    website: { label: 'Website Tracking', color: '#4A3728' },
    ga4: { label: 'GA4', color: '#E37400' },
    clarity: { label: 'Microsoft Clarity', color: '#0F6CBD' },
    gsc: { label: 'Search Console', color: '#4285F4' },
    'google-ads': { label: 'Google Ads', color: '#4285F4' },
    'meta-ads': { label: 'Meta Ads', color: '#0866FF' },
    hubspot: { label: 'HubSpot', color: '#FF7A59' }
  };
  $: cfg = MAP[source] ?? { label: source, color: '#7A8B87' };
</script>

<span
  class="inline-flex items-center gap-1 rounded-full bg-ink/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-ink/50"
  title={`Source: ${cfg.label}`}
>
  <span class="h-1.5 w-1.5 shrink-0 rounded-full" style={`background:${cfg.color}`}></span>
  {cfg.label}
</span>
