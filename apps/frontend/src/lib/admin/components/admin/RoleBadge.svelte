<script lang="ts">
  export let role = 'viewer';

  const tones: Record<string, string> = {
    super_admin: 'bg-goldfinch-gold/20 text-heading ring-goldfinch-gold/30',
    admin: 'bg-forest/10 text-forest ring-forest/20',
    content_manager: 'bg-sky-50 text-sky-700 ring-sky-200/70',
    booking_manager: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
    finance_manager: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    editor: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    viewer: 'bg-slate-100 text-slate-600 ring-slate-200'
  };

  $: label = role.replace(/_/g, ' ');
  $: tone = tones[role] ?? 'bg-skywash text-ink ring-ink/10';
</script>

<span class={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${tone}`}>
  {label}
</span>
