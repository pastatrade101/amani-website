<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowUpRight, ArrowRight, Plus, Map, CalendarDays, Inbox, Wallet, Compass, Check, Circle, Image, Settings, RefreshCw, AlertCircle, MessageSquare, FileText } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Card from '$lib/components/ui/card';
  import * as Tabs from '$lib/components/ui/tabs';
  import ChartCanvas from '$lib/admin/components/admin/ChartCanvas.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import { lineConfig } from '$lib/admin/charts';
  type Money = { received: number; refunded: number; outstanding: number };
  type Snapshot = {
    counts: Record<string, number>;
    commerce: null | { days: number; currencies: string[]; money: Record<string, Money>; series: {date: string; received: number; enquiries: number; accepted: number}[]; attention: Record<string,number> };
    recent: { bookings: Record<string, any>[]; messages: Record<string, any>[]; tours: Record<string,any>[] };
  };
  let stats = $state<Snapshot | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activityTab = $state('bookings');
  let name = $state('Key2africa');
  async function load() {
    loading = true; error = '';
    try { stats = (await api.dashboard.stats()).data as Snapshot; }
    catch (err) { error = err instanceof Error ? err.message : 'Unable to load your workspace.'; }
    finally { loading = false; }
  }
  onMount(() => {
    try { const user = JSON.parse(localStorage.getItem('admin_user') ?? '{}'); name = (user.name || user.full_name || 'Key2africa').split(' ')[0]; } catch { /* default name */ }
    void load();
  });
  const counts = $derived(stats?.counts ?? {});
  const commerce = $derived(stats?.commerce);
  const currency = $derived(commerce?.currencies?.[0] ?? 'USD');
  const money = $derived(commerce?.money?.[currency]);
  const series = $derived(commerce?.series ?? []);
  const chart = $derived(lineConfig(series.map(row => new Date(`${row.date}T00:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})), series.map(row => row.received), currency));
  const hasRevenue = $derived(series.some(row => row.received > 0));
  const formatMoney = (value: number) => new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value);
  const dateLabel = new Intl.DateTimeFormat('en-GB',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
  const steps = $derived([
    { title: 'Add your destinations', description: 'Introduce the places your travellers will discover.', href: '/admin/destinations', complete: (counts.destinations ?? 0) > 0 },
    { title: 'Create your first safari', description: 'Turn your local knowledge into an unforgettable itinerary.', href: '/admin/tours/new', complete: (counts.totalTours ?? 0) > 0 },
    { title: 'Bring your story to life', description: 'Upload the photography that makes people want to go.', href: '/admin/media', complete: (counts.mediaFiles ?? 0) > 0 },
    { title: 'Publish and start exploring', description: 'Make your first safari available on your website.', href: '/admin/tours', complete: (counts.publishedTours ?? 0) > 0 }
  ]);
  const completedSteps = $derived(steps.filter(step => step.complete).length);
  const attention = $derived(Object.entries(commerce?.attention ?? {}).filter(([,count]) => count > 0));
  const recentBookings = $derived(stats?.recent?.bookings ?? []);
  const recentMessages = $derived(stats?.recent?.messages ?? []);
  const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
</script>

<div class="cms-dashboard">
  <div class="cms-dashboard-heading">
    <div><p class="cms-eyebrow"><span></span>YOUR WORKSPACE, CONNECTED</p><h1>Welcome back, {name}<span class="text-[#d5aa09]">.</span></h1><p>Every remarkable journey starts with a little planning.</p></div>
    <div class="flex items-center gap-3"><span class="cms-today"><CalendarDays size={14}/>{dateLabel}</span><Button href="/admin/tours/new" variant="safari" class="h-10 px-4 text-xs gap-2"><Plus size={16}/>Create a safari</Button></div>
  </div>
  {#if error}
    <Card.Root class="border-destructive/20"><Card.Content class="flex flex-wrap items-center gap-4 p-6"><AlertCircle class="text-destructive"/><div class="flex-1"><h2 class="text-sm font-semibold">We couldn’t load your dashboard</h2><p class="text-sm text-muted-foreground mt-1">{error}</p></div><Button variant="outline" onclick={load}><RefreshCw/>Try again</Button></Card.Content></Card.Root>
  {:else if loading}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard" role="status">{#each Array(4) as _}<Skeleton class="h-36 rounded-xl"/>{/each}</div><Skeleton class="h-80 rounded-xl"/>
  {:else}
    <div class="cms-metrics">
      {#each [
        { label: 'Published safaris', value: String(counts.publishedTours ?? 0), detail: `${counts.draftTours ?? 0} drafts in progress`, icon: Map, href: '/admin/tours', tone: 'yellow' },
        { label: 'Total bookings', value: String(counts.totalBookings ?? 0), detail: `${counts.pendingBookings ?? 0} awaiting confirmation`, icon: CalendarDays, href: '/admin/bookings', tone: 'blue' },
        { label: 'Unread messages', value: String(counts.unreadMessages ?? 0), detail: 'Keep the conversation going', icon: Inbox, href: '/admin/messages', tone: 'violet' },
        { label: 'Payments received', value: commerce ? formatMoney(money?.received ?? 0) : '—', detail: commerce ? `Last ${commerce.days} days · ${currency}` : 'Payment summary unavailable', icon: Wallet, href: '/admin/payments', tone: 'mint' }
      ] as metric}
        <a href={metric.href} class="cms-metric-card"><div class="flex items-center justify-between"><span class="text-xs font-medium text-muted-foreground">{metric.label}</span><span class={`cms-metric-icon ${metric.tone}`}><metric.icon size={17}/></span></div><strong>{metric.value}</strong><div class="flex items-center justify-between"><p>{metric.detail}</p><ArrowUpRight size={15}/></div></a>
      {/each}
    </div>

    <div class="cms-overview-grid">
      <Card.Root class="cms-panel gap-0">
        <Card.Header class="cms-panel-header"><div><Card.Title>Revenue overview</Card.Title><Card.Description>Payments received over the last 30 days</Card.Description></div><Badge variant="outline" class="font-normal gap-2"><span class="size-1.5 bg-[#e9bc10] rounded-full"></span>{currency}</Badge></Card.Header>
        <Card.Content class="pt-0">
          {#if commerce}<div class="cms-revenue-summary"><strong>{formatMoney(money?.received ?? 0)}</strong><span><span class="text-muted-foreground">Outstanding</span> {formatMoney(money?.outstanding ?? 0)}</span></div>{/if}
          {#if hasRevenue}<div class="h-[230px] mt-5"><ChartCanvas {...chart}/></div>
          {:else}<div class="cms-chart-empty"><div class="cms-chart-grid"></div><div class="relative text-center"><span class="inline-flex size-10 items-center justify-center rounded-full bg-muted mb-3"><Wallet size={18}/></span><p class="text-xs font-medium">{commerce ? 'Your next chapter starts here' : 'Revenue is temporarily unavailable'}</p><p class="text-xs text-muted-foreground mt-1">{commerce ? 'Recorded payments will appear in this chart.' : 'Refresh to try loading your payment summary again.'}</p></div></div>{/if}
        </Card.Content>
        <Card.Footer class="cms-panel-footer"><span class="text-xs text-muted-foreground">Based on recorded payments</span><Button href="/admin/payments" variant="ghost" size="sm" class="text-xs">View payments<ArrowRight size={13}/></Button></Card.Footer>
      </Card.Root>
      <section class="cms-inspiration-card">
        <img src="/images/safari-hero.jpg" alt="Tanzania’s open savanna at sunset"/>
        <div class="cms-inspiration-content"><span class="cms-inspiration-label"><Compass size={14}/> THE KEY2AFRICA WAY</span><div><h2>Extraordinary places.<br/>Thoughtfully planned.</h2><p>Build the next journey your travellers will talk about for years.</p><Button href="/admin/tours/new" variant="safari" class="mt-5 h-10 px-4 gap-2 text-xs">Craft an itinerary<ArrowUpRight size={15}/></Button></div></div>
      </section>
    </div>

    <div class="cms-detail-grid">
      <Card.Root class="cms-panel gap-0">
        <Card.Header class="cms-panel-header"><div><Card.Title>Recent activity</Card.Title><Card.Description>A little closer to every traveller</Card.Description></div><Button href={activityTab === 'bookings' ? '/admin/bookings' : '/admin/messages'} variant="ghost" size="sm" class="text-xs">View all<ArrowUpRight size={14}/></Button></Card.Header>
        <Card.Content class="pt-0">
          <Tabs.Root bind:value={activityTab}>
            <Tabs.List class="cms-tabs"><Tabs.Trigger value="bookings">Bookings<Badge variant="secondary" class="ml-1 text-[10px]">{counts.totalBookings ?? 0}</Badge></Tabs.Trigger><Tabs.Trigger value="messages">Messages<Badge variant="secondary" class="ml-1 text-[10px]">{counts.unreadMessages ?? 0}</Badge></Tabs.Trigger></Tabs.List>
            <Tabs.Content value="bookings" class="mt-4">
              {#each recentBookings as booking}<a href="/admin/bookings" class="cms-activity-row"><span class="cms-activity-icon"><CalendarDays size={17}/></span><span class="min-w-0 flex-1"><strong>{booking.customer_name || booking.full_name || booking.booking_reference || 'Safari booking'}</strong><small>{date(booking.created_at)}</small></span><StatusBadge status={booking.status || 'pending'}/></a>
              {:else}<div class="cms-activity-empty"><CalendarDays size={25} strokeWidth={1.3}/><h3>No bookings just yet</h3><p>When a traveller books a safari, you’ll find it here.</p><Button href="/admin/bookings" variant="outline" size="sm">Manage bookings<ArrowRight size={13}/></Button></div>{/each}
            </Tabs.Content>
            <Tabs.Content value="messages" class="mt-4">
              {#each recentMessages as message}<a href="/admin/messages" class="cms-activity-row"><span class="cms-activity-icon"><MessageSquare size={17}/></span><span class="min-w-0 flex-1"><strong>{message.subject || message.name || 'Traveller enquiry'}</strong><small>{date(message.created_at)}</small></span><ArrowUpRight size={15}/></a>
              {:else}<div class="cms-activity-empty"><Inbox size={25} strokeWidth={1.3}/><h3>Your inbox is clear</h3><p>New traveller enquiries will arrive here.</p><Button href="/admin/messages" variant="outline" size="sm">Open inbox<ArrowRight size={13}/></Button></div>{/each}
            </Tabs.Content>
          </Tabs.Root>
        </Card.Content>
      </Card.Root>
      <Card.Root class="cms-panel gap-0">
        <Card.Header class="cms-panel-header"><div><Card.Title>{completedSteps < 4 ? 'Make it yours' : 'Workspace essentials'}</Card.Title><Card.Description>{completedSteps < 4 ? 'A few steps to your next adventure' : 'Keep your safari collection growing'}</Card.Description></div><span class="cms-progress-count">{completedSteps}/4</span></Card.Header>
        <Card.Content class="pt-0"><div class="cms-progress-track" role="progressbar" aria-label="Workspace setup" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completedSteps}><span style={`width:${completedSteps * 25}%`}></span></div><div class="mt-4">{#each steps as step}<a href={step.href} class="cms-setup-step"><span class:complete={step.complete}>{#if step.complete}<Check size={14}/>{:else}<Circle size={17}/>{/if}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><ArrowUpRight size={15}/></a>{/each}</div></Card.Content>
      </Card.Root>
    </div>
    {#if attention.length}<Card.Root class="cms-panel"><Card.Content class="flex flex-wrap items-center gap-3 p-5"><AlertCircle size={18}/><p class="flex-1 text-sm">There are outstanding tasks in your bookings and quotations.</p><Button href="/admin/quotations" variant="outline" size="sm">Review quotations<ArrowUpRight/></Button><Button href="/admin/bookings" variant="outline" size="sm">Review bookings<ArrowUpRight/></Button></Card.Content></Card.Root>{/if}
    <footer class="cms-dashboard-footer"><span>Key2africa Tours and Safaris ltd</span><span>Thoughtfully crafted journeys. Seamlessly managed.</span></footer>
  {/if}
</div>
