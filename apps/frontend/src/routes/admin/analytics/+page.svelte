<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import {
    Activity, AlertTriangle, AppWindow, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bot, Check,
    CheckCircle2, ClipboardList, Compass, Copy, Download, ExternalLink, Eye, Filter, Flame, Globe, Hand, History,
    Info, Lightbulb, Link2, ListChecks, MapPin, MessageCircle, Monitor, MousePointer2, MousePointerClick,
    MoveVertical, PlayCircle, RefreshCw, ScanEye, Send, ShieldCheck, Sparkles, Target, TrendingUp, Trophy, Users, Zap
  } from '@lucide/svelte';
  import { env as publicEnv } from '$env/dynamic/public';
  import { api } from '$lib/admin/api/client';
  import { clarityDashboardUrl } from '$lib/admin/clarity';
  import ChartCanvas from '$lib/admin/components/admin/ChartCanvas.svelte';
  import Sparkline from '$lib/admin/components/admin/Sparkline.svelte';
  import Counter from '$lib/admin/components/admin/Counter.svelte';
  import AnalyticsEmpty from '$lib/admin/components/admin/AnalyticsEmpty.svelte';
  import MetricCard from '$lib/admin/components/admin/ux/MetricCard.svelte';
  import InsightCard from '$lib/admin/components/admin/ux/InsightCard.svelte';
  import BreakdownBars from '$lib/admin/components/admin/ux/BreakdownBars.svelte';
  import DeepLinkCard from '$lib/admin/components/admin/ux/DeepLinkCard.svelte';
  import ScoreRing from '$lib/admin/components/admin/ux/ScoreRing.svelte';
  import { barConfig, doughnutConfig, funnelConfig, lineConfig } from '$lib/admin/charts';

  type Tally = Array<{ label: string; value: number }>;
  type Overview = {
    visitors: number; interactions: number; planMyTripSubmissions: number; requestTripSubmissions: number;
    aiLeads: number; whatsappClicks: number; phoneClicks: number; emailClicks: number; aiAdvisorOpened: number;
    totalLeads: number; formOpens: number; formConversionRate: number; leadConversionRate: number;
  };
  type LeadData = {
    total: number; leadsByDay: Array<{ date: string; value: number }>;
    bySource: Tally; byDestination: Tally; byBudget: Tally; byExperience: Tally;
    byTravellerType: Tally; byAccommodation: Tally; byStatus: Tally;
  };
  type Funnel = { stages: Array<{ key: string; label: string; value: number }>; rates: Record<string, number> };
  type Traffic = { byDay: Array<{ date: string; visitors: number; whatsapp: number; ai: number; events: number }>; byDevice: Tally; topEvents: Tally };
  type Ga4 = {
    configured: boolean; error?: string; activeUsers: number; totalUsers: number; sessions: number; pageViews: number;
    byDay: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
    topPages: Tally; sources: Tally; countries: Tally; devices: Tally;
  };
  // Real Microsoft Clarity aggregates (Data Export API) — nulls where unavailable.
  type ClarityTotals = {
    sessions: number | null; botSessions: number | null; distinctUsers: number | null; pagesPerSession: number | null;
    avgScrollDepth: number | null; totalTimeMs: number | null; activeTimeMs: number | null; rageClicks: number | null;
    deadClicks: number | null; excessiveScroll: number | null; quickBacks: number | null; scriptErrors: number | null; errorClicks: number | null;
  };
  type Clarity = {
    configured: boolean; error?: string; windowDays: number; fetchedAt: string | null;
    totals: ClarityTotals; byDevice: Tally; byBrowser: Tally; byCountry: Tally; byUrl: Tally;
  };
  type UxInsight = {
    id: string; priority: 'critical' | 'high' | 'medium' | 'low'; confidence: 'high' | 'medium' | 'low';
    title: string; why: string; impact: string; difficulty: 'easy' | 'medium' | 'hard'; estTime: string; source: string;
  };
  type UxInsights = { available: boolean; reason?: string; generatedAt: string | null; summary: string | null; insights: UxInsight[]; dataSources: string[] };
  // Deterministic website-intelligence engine (no LLM) — health/category scores,
  // executive summary, rule-based alerts, prioritized actions, real timeline.
  type MetricRef = { value: number | null; source: string; changePct: number | null; status: 'direct' | 'derived' | 'na'; note?: string };
  type CategoryScore = { key: string; label: string; score: number | null; changePct: number | null; available: boolean; reason: string; basis: string };
  type WiAlert = { id: string; severity: 'critical' | 'warning' | 'info' | 'success'; category: string; title: string; detail: string; metric: string | null; deepLink?: string };
  type WiAction = { id: string; priority: 'critical' | 'high' | 'medium' | 'low'; category: string; issue: string; supportingMetric: string; why: string; fix: string; expectedOutcome: string; effort: 'easy' | 'medium' | 'hard'; confidence: 'high' | 'medium' | 'low'; deepLink?: string };
  type WiTimeline = { when: string; date: string; label: string; detail: string; direction: 'up' | 'down' | 'flat' };
  type Intelligence = {
    generatedAt: string; range: { from: string; to: string; days: number; label: string };
    sources: { firstParty: boolean; ga4: boolean; clarity: boolean };
    health: { score: number | null; status: string; changePct: number | null; criticalCount: number; basis: string; contributing: string[] };
    categoryScores: CategoryScore[];
    executive: { metrics: Record<string, MetricRef>; biggestDropOff: string | null; topIssue: string | null };
    alerts: WiAlert[]; actions: WiAction[]; timeline: WiTimeline[];
  };
  // A source-labeled KPI — provider-agnostic so new providers slot in unchanged.
  type MetricCardModel = {
    key: string; label: string; value: number | null; format?: 'number' | 'percent' | 'duration' | 'currency';
    source: string; available: boolean; deepLink?: string; deepLinkLabel?: string; emptyText?: string;
    hint?: string; series?: number[]; icon?: typeof Users; accent?: string;
  };

  const RANGES = [
    { k: 'today', l: 'Today' }, { k: 'yesterday', l: 'Yesterday' }, { k: '7d', l: '7 days' },
    { k: '30d', l: '30 days' }, { k: 'this_month', l: 'This month' }, { k: 'last_month', l: 'Last month' }
  ];

  let range = '30d';
  let loading = true;
  let overview: Overview | null = null;
  let leads: LeadData | null = null;
  let funnel: Funnel | null = null;
  let traffic: Traffic | null = null;
  let ga4: Ga4 | null = null;
  let clarity: Clarity | null = null;
  let ux: UxInsights | null = null;
  let intel: Intelligence | null = null;
  let uxLoading = false;
  let copied = false;
  let updatedAt = 0;
  let eventView: 'business' | 'dev' = 'business';
  let activeStep = -1;

  // ── Microsoft Clarity — one source inside the UX Intelligence Hub. Recordings
  // & heatmaps stay in Clarity (deep-linked); real aggregates come from the API.
  const clarityId = publicEnv.PUBLIC_CLARITY_PROJECT_ID;
  const clarityConnected = Boolean(clarityId);
  const clarityUrl = clarityDashboardUrl(clarityId);
  const clarityLink = (view: string) =>
    clarityId ? `https://clarity.microsoft.com/projects/view/${clarityId}/${view}` : 'https://clarity.microsoft.com/';

  const load = async () => {
    loading = true;
    const params = { range };
    try {
      const [o, l, f, t, g] = await Promise.all([
        api.analytics.overview(params), api.analytics.leads(params),
        api.analytics.funnel(params), api.analytics.timeseries(params),
        api.analytics.traffic(params)
      ]);
      overview = o.data as Overview;
      leads = l.data as LeadData;
      funnel = f.data as Funnel;
      traffic = t.data as Traffic;
      ga4 = g.data as Ga4;
      updatedAt = Date.now();
    } catch {
      overview = null; leads = null; funnel = null; traffic = null; ga4 = null;
    } finally {
      loading = false;
    }
    void loadUx();
  };

  // UX Intelligence (Clarity aggregates + grounded AI insights) loads separately
  // so the core KPIs never wait on it. `force` bypasses the server-side cache.
  const loadUx = async (force = false) => {
    uxLoading = true;
    const q = force ? { range, refresh: '1' } : { range };
    try {
      const [c, u, w] = await Promise.all([
        api.analytics.clarity(force ? { refresh: '1' } : undefined).catch(() => null),
        api.analytics.uxInsights(q).catch(() => null),
        api.analytics.intelligence({ range }).catch(() => null)
      ]);
      clarity = (c?.data ?? null) as Clarity | null;
      ux = (u?.data ?? null) as UxInsights | null;
      intel = (w?.data ?? null) as Intelligence | null;
    } finally {
      uxLoading = false;
    }
  };

  // ── Export + share (real data only) ─────────────────────────────────────────
  const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const exportCsv = () => {
    if (typeof document === 'undefined') return;
    const rows: string[][] = [['Section', 'Metric', 'Value', 'Source', 'Change vs prev']];
    const m = intel?.executive.metrics ?? {};
    for (const [k, v] of Object.entries(m)) rows.push(['Executive', k, v.value == null ? 'N/A' : String(v.value), v.source, v.changePct == null ? '' : `${v.changePct}%`]);
    for (const s of intel?.categoryScores ?? []) rows.push(['Score', s.label, s.score == null ? 'N/A' : String(s.score), 'derived', s.changePct == null ? '' : `${s.changePct}%`]);
    for (const a of intel?.actions ?? []) rows.push(['Action', a.issue, a.supportingMetric, a.priority, a.expectedOutcome]);
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `website-analytics-${range}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const copyLink = async () => {
    if (typeof window === 'undefined') return;
    try { await navigator.clipboard.writeText(window.location.href); copied = true; setTimeout(() => (copied = false), 1800); } catch { /* clipboard blocked */ }
  };

  const setRange = (k: string) => { range = k; activeStep = -1; void load(); };
  const scrollTo = (id: string) => { if (typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  onMount(load);

  // ── helpers ──────────────────────────────────────────────────────────────
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);
  const share = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  // Momentum = 2nd half of the period vs the 1st half of the same daily series.
  const momentum = (series: number[]): { pct: number } | null => {
    const s = (series ?? []).filter((n) => Number.isFinite(n));
    if (s.length < 4) return null;
    const mid = Math.floor(s.length / 2);
    const earlier = s.slice(0, mid).reduce((a, b) => a + b, 0);
    const recent = s.slice(mid).reduce((a, b) => a + b, 0);
    if (earlier === 0 && recent === 0) return null;
    return { pct: pct(recent, earlier) };
  };
  const topRow = (t?: Tally) =>
    (t ?? []).filter((x) => x.value > 0 && x.label !== 'Not specified' && x.label !== '(not set)').sort((a, b) => b.value - a.value)[0] ?? null;
  const sum = (t?: Tally) => (t ?? []).reduce((a, x) => a + x.value, 0);

  const rel = (ts: number, ref: number) => {
    if (!ts) return '';
    const m = Math.round((ref - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    return `${Math.round(m / 60)}h ago`;
  };
  let now = Date.now();
  onMount(() => { const i = setInterval(() => (now = Date.now()), 30000); return () => clearInterval(i); });
  $: lastUpdatedLabel = updatedAt ? `Updated ${rel(updatedAt, now)}` : '';

  // ── KPI cards (with per-card daily series for sparkline + trend) ────────────
  $: visitorSeries = (traffic?.byDay ?? []).map((d) => d.visitors);
  $: leadSeries = (leads?.leadsByDay ?? []).map((d) => d.value);
  $: eventSeries = (traffic?.byDay ?? []).map((d) => d.events);
  $: waSeries = (traffic?.byDay ?? []).map((d) => d.whatsapp);
  $: aiSeries = (traffic?.byDay ?? []).map((d) => d.ai);

  // ── UX friction cards (Clarity) — real or honestly empty; source-labeled.
  // The business + GA4 KPIs now live in the deterministic Executive summary.
  $: ga4Cfg = ga4?.configured === true;
  $: cCfg = clarity?.configured === true; // Data Export API token present (real numbers)
  $: cT = clarity?.totals ?? null;

  $: clarityMetrics = [
    { key: 'rage', label: 'Rage clicks', value: cT?.rageClicks ?? null, source: 'clarity', available: cCfg && cT?.rageClicks != null, deepLink: clarityLink('impressions'), deepLinkLabel: 'Watch recordings', icon: Hand, accent: '#0F6CBD' },
    { key: 'dead', label: 'Dead clicks', value: cT?.deadClicks ?? null, source: 'clarity', available: cCfg && cT?.deadClicks != null, deepLink: clarityLink('impressions'), deepLinkLabel: 'Watch recordings', icon: MousePointer2, accent: '#0F6CBD' },
    { key: 'scroll', label: 'Avg scroll depth', value: cT?.avgScrollDepth ?? null, format: 'percent', source: 'clarity', available: cCfg && cT?.avgScrollDepth != null, deepLink: clarityLink('heatmaps'), deepLinkLabel: 'Open heatmap', icon: MoveVertical, accent: '#0F6CBD' },
    { key: 'quick', label: 'Quick-backs', value: cT?.quickBacks ?? null, source: 'clarity', available: cCfg && cT?.quickBacks != null, deepLink: clarityLink('impressions'), deepLinkLabel: 'Watch recordings', icon: Zap, accent: '#0F6CBD' }
  ] as MetricCardModel[];

  // Breakdowns prefer GA4 (richer), falling back to Clarity; each stays labeled.
  $: deviceRows = ga4Cfg && ga4!.devices.length ? ga4!.devices : clarity?.byDevice ?? [];
  $: deviceSource = ga4Cfg && ga4!.devices.length ? 'ga4' : 'clarity';
  $: countryRows = ga4Cfg && ga4!.countries.length ? ga4!.countries : clarity?.byCountry ?? [];
  $: countrySource = ga4Cfg && ga4!.countries.length ? 'ga4' : 'clarity';
  $: pageRows = ga4Cfg && ga4!.topPages.length ? ga4!.topPages : clarity?.byUrl ?? [];
  $: pageSource = ga4Cfg && ga4!.topPages.length ? 'ga4' : 'clarity';
  $: browserRows = clarity?.byBrowser ?? [];

  // Connection panel — Makutano AI is always live; the rest reflect real config.
  $: hubSources = [
    { key: 'makutano', label: 'Makutano AI', connected: true, note: 'First-party events · live' },
    { key: 'ga4', label: 'Google Analytics 4', connected: ga4Cfg, note: ga4Cfg ? 'Traffic API · live' : 'Add GA4 credentials' },
    { key: 'clarity', label: 'Microsoft Clarity', connected: clarityConnected, note: cCfg ? 'Recordings + data export · live' : clarityConnected ? 'Recordings live · export off' : 'Not connected' }
  ];
  $: connectedCount = hubSources.filter((s) => s.connected).length;

  // ── Executive summary — real KPIs + previous-period benchmarks (deterministic).
  const execConfig: Array<{ key: string; label: string; icon: typeof Users; accent: string; format?: 'percent'; series?: () => number[] }> = [
    { key: 'visitors', label: 'Visitors', icon: Users, accent: '#4A3728', series: () => visitorSeries },
    { key: 'sessions', label: 'Sessions', icon: Activity, accent: '#E37400' },
    { key: 'pageViews', label: 'Page views', icon: Eye, accent: '#E37400' },
    { key: 'interactions', label: 'Interactions', icon: MousePointerClick, accent: '#153733' },
    { key: 'leads', label: 'Leads', icon: Target, accent: '#153733', series: () => leadSeries },
    { key: 'conversionRate', label: 'Conversion rate', icon: TrendingUp, accent: '#153733', format: 'percent' },
    { key: 'formOpens', label: 'Form opens', icon: ClipboardList, accent: '#4A3728' },
    { key: 'formSubmissions', label: 'Form submissions', icon: Send, accent: '#4A3728' },
    { key: 'bookingRequests', label: 'Booking requests', icon: MapPin, accent: '#153733' },
    { key: 'whatsappClicks', label: 'WhatsApp clicks', icon: MessageCircle, accent: '#128C7E', series: () => waSeries }
  ];
  $: execCards = intel
    ? execConfig.flatMap((cfg) => {
        const ref = intel!.executive.metrics[cfg.key];
        return ref ? [{ cfg, ref }] : [];
      })
    : [];

  // deterministic-alert + action styling (const maps, used in markup)
  const ALERT_STYLE: Record<string, { cls: string; text: string; icon: typeof Info }> = {
    critical: { cls: 'border-red-300/70 bg-red-50/50', text: 'text-red-700', icon: AlertTriangle },
    warning: { cls: 'border-amber-300/70 bg-amber-50/40', text: 'text-amber-700', icon: AlertTriangle },
    info: { cls: 'border-ink/12 bg-sand/25', text: 'text-ink/60', icon: Info },
    success: { cls: 'border-emerald-300/70 bg-emerald-50/40', text: 'text-emerald-700', icon: CheckCircle2 }
  };
  const PRIO_STYLE: Record<string, { label: string; cls: string; bar: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-500/12 text-red-600', bar: 'bg-red-500' },
    high: { label: 'High', cls: 'bg-amber-500/12 text-amber-600', bar: 'bg-amber-500' },
    medium: { label: 'Medium', cls: 'bg-forest/12 text-forest', bar: 'bg-forest' },
    low: { label: 'Low', cls: 'bg-ink/[0.06] text-ink/50', bar: 'bg-ink/30' }
  };
  $: healthStatusColor =
    intel?.health.score == null ? 'text-ink/40'
    : intel.health.score >= 70 ? 'text-emerald-600'
    : intel.health.score >= 50 ? 'text-amber-600' : 'text-red-500';

  $: cards = overview
    ? [
        { label: 'Visitors', value: overview.visitors, suffix: '', helper: 'Unique sessions', icon: Users, series: visitorSeries, anchor: 'sec-traffic' },
        { label: 'Total leads', value: overview.totalLeads, suffix: '', helper: `${overview.leadConversionRate}% of visitors`, icon: ClipboardList, series: leadSeries, anchor: 'sec-leads' },
        { label: 'Plan My Safari', value: overview.planMyTripSubmissions, suffix: '', helper: 'General planning leads', icon: MapPin, series: [] as number[], anchor: 'sec-leads' },
        { label: 'Request This Trip', value: overview.requestTripSubmissions, suffix: '', helper: 'Tour-specific leads', icon: Send, series: [] as number[], anchor: 'sec-leads' },
        { label: 'AI advisor leads', value: overview.aiLeads, suffix: '', helper: `${overview.aiAdvisorOpened} advisor opens`, icon: Bot, series: aiSeries, anchor: 'sec-events' },
        { label: 'WhatsApp clicks', value: overview.whatsappClicks, suffix: '', helper: `${overview.phoneClicks} phone · ${overview.emailClicks} email`, icon: MessageCircle, series: waSeries, anchor: 'sec-events' },
        { label: 'Form conversion', value: overview.formConversionRate, suffix: '%', helper: `${overview.formOpens} form opens`, icon: TrendingUp, series: [] as number[], anchor: 'sec-funnel' },
        { label: 'Interactions', value: overview.interactions, suffix: '', helper: 'Tracked events', icon: MousePointerClick, series: eventSeries, anchor: 'sec-events' }
      ]
    : [];

  // ── Conversion funnel drop-offs + auto-detected bottleneck ──────────────────
  const RATE_STEPS = [
    { key: 'visitorsToFormOpen', label: 'Visitors → form open', tip: 'Few visitors start an enquiry — make the "Plan my safari" CTAs more prominent above the fold.' },
    { key: 'formOpenToSubmit', label: 'Form open → submit', tip: 'People open the form but don\'t finish — shorten it, cut optional fields, and reassure on privacy.' },
    { key: 'submitToContacted', label: 'Submit → contacted', tip: 'Leads submit but aren\'t marked contacted — speed up first response; most enquiries expect a reply within hours.' },
    { key: 'contactedToBooked', label: 'Contacted → booked', tip: 'Contacted leads aren\'t booking — revisit quote turnaround, pricing clarity and follow-up cadence.' }
  ];
  $: funnelSteps = funnel ? RATE_STEPS.map((s) => ({ ...s, rate: funnel!.rates[s.key] ?? 0, dropoff: Math.max(0, 100 - (funnel!.rates[s.key] ?? 0)) })) : [];
  $: bottleneck = funnelSteps.length ? [...funnelSteps].sort((a, b) => a.rate - b.rate)[0] : null;

  // ── AI insight engine — plain-language, derived only from the real data ─────
  type Insight = { icon: typeof Trophy; tone: 'up' | 'down' | 'good' | 'warn' | 'neutral'; label: string; text: string };
  $: insights = (() => {
    if (!overview) return [] as Insight[];
    const out: Insight[] = [];
    const vm = momentum(visitorSeries) ?? momentum(eventSeries);
    if (vm) {
      const up = vm.pct >= 0;
      out.push({
        icon: up ? ArrowUpRight : ArrowDownRight, tone: up ? 'up' : 'down', label: 'Traffic trend',
        text: `Visitor activity is trending ${up ? 'up' : 'down'} ${Math.abs(vm.pct)}% across this period (second half vs first).`
      });
    }
    const dest = topRow(leads?.byDestination);
    if (dest) out.push({ icon: MapPin, tone: 'good', label: 'Top destination', text: `${dest.label} leads demand with ${dest.value} enquir${dest.value === 1 ? 'y' : 'ies'} (${share(dest.value, leads!.total)}% of leads).` });
    const src = topRow(leads?.bySource);
    if (src) out.push({ icon: Compass, tone: 'good', label: 'Best source', text: `Most leads arrive via ${src.label} — ${src.value} (${share(src.value, leads!.total)}% of the total).` });
    if (bottleneck) out.push({ icon: AlertTriangle, tone: 'warn', label: 'Biggest drop-off', text: `${bottleneck.label}: only ${bottleneck.rate}% continue — this is the weakest step in your funnel.` });
    if (overview.leadConversionRate != null) {
      const good = overview.leadConversionRate >= 2;
      out.push({ icon: Target, tone: good ? 'good' : 'neutral', label: 'Conversion', text: `${overview.leadConversionRate}% of visitors become a lead${good ? ' — a healthy rate for a considered purchase.' : '. There is room to lift this with stronger CTAs.'}` });
    }
    if (bottleneck) out.push({ icon: Lightbulb, tone: 'neutral', label: 'Recommended action', text: bottleneck.tip });
    return out;
  })();
  const TONE: Record<Insight['tone'], string> = {
    up: 'bg-emerald-500/12 text-emerald-600', down: 'bg-red-500/12 text-red-600',
    good: 'bg-forest/12 text-forest', warn: 'bg-amber-500/15 text-amber-600', neutral: 'bg-goldfinch-gold/15 text-clay'
  };

  // ── Business-friendly event names (toggle vs raw GA4 names) ──────────────────
  const EVENT_LABELS: Record<string, string> = {
    page_view: 'Page viewed', tour_page_view: 'Tour viewed', destination_page_view: 'Destination viewed',
    safari_style_view: 'Safari style viewed', accommodation_view: 'Stay viewed', tour_list_view: 'Tours list viewed',
    tour_card_click: 'Tour selected', related_tour_click: 'Related tour clicked', tour_filter_used: 'Filters used',
    search: 'Search', no_search_results: 'Search — no results',
    plan_my_trip_opened: 'Safari planner opened', plan_my_trip_submitted: 'Plan lead submitted',
    begin_journey_opened: 'Journey planner opened', begin_journey_submitted: 'Journey lead submitted',
    request_trip_opened: 'Quote request started', request_trip_submitted: 'Quote lead submitted',
    form_submit_error: 'Form error', ai_advisor_opened: 'AI advisor opened', ai_advisor_message_sent: 'AI advisor message',
    ai_advisor_lead_created: 'AI advisor lead', cta_click: 'CTA clicked',
    whatsapp_click: 'WhatsApp clicked', phone_click: 'Phone clicked', email_click: 'Email clicked'
  };
  const prettyEvent = (raw: string) => EVENT_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Chart configs ───────────────────────────────────────────────────────────
  const topRows = (t: Tally, n = 6) =>
    (t ?? []).filter((x) => x.value > 0 && x.label !== 'Not specified' && x.label !== '(not set)').slice(0, n);
  const cleanRows = (t: Tally, n = 6) => {
    const rows = (t ?? []).filter((x) => x.label !== 'Not specified' && x.label !== '(not set)' && x.value > 0).slice(0, n);
    return { rows, max: Math.max(1, ...rows.map((x) => x.value)) };
  };

  $: leadsLineCfg = lineConfig((leads?.leadsByDay ?? []).map((d) => d.date.slice(5)), (leads?.leadsByDay ?? []).map((d) => d.value), ' leads');
  $: sourceDonutCfg = doughnutConfig(topRows(leads?.bySource ?? []), ' leads');
  $: budgetDonutCfg = doughnutConfig(topRows(leads?.byBudget ?? []), ' leads');
  $: destBarCfg = barConfig(topRows(leads?.byDestination ?? [], 7), { horizontal: true, unit: ' leads' });
  $: funnelCfg = funnel ? funnelConfig(funnel.stages) : null;
  $: deviceDonutCfg = doughnutConfig(topRows(traffic?.byDevice ?? [], 3));

  $: ga4ListBlocks = ga4
    ? [
        { title: 'Top pages', list: cleanRows(ga4.topPages, 8) },
        { title: 'Traffic sources', list: cleanRows(ga4.sources) },
        { title: 'Countries', list: cleanRows(ga4.countries) },
        { title: 'Devices', list: cleanRows(ga4.devices, 3) }
      ]
    : [];
  // Most-viewed tours / destinations, derived from real GA4 page paths.
  const pagesUnder = (prefix: string, n = 6) =>
    cleanRows((ga4?.topPages ?? []).filter((p) => String(p.label).startsWith(prefix) && String(p.label) !== prefix)
      .map((p) => ({ label: String(p.label).replace(prefix, '').replace(/\/$/, '') || '—', value: p.value })), n);
  $: topTourPages = ga4?.configured ? pagesUnder('/tours/') : { rows: [], max: 1 };
  $: topDestPages = ga4?.configured ? pagesUnder('/destinations/') : { rows: [], max: 1 };

  $: breakdownBlocks = leads
    ? [
        { t: 'Experience interests', ...cleanRows(leads.byExperience) },
        { t: 'Traveller type', ...cleanRows(leads.byTravellerType) },
        { t: 'Accommodation preference', ...cleanRows(leads.byAccommodation) }
      ]
    : [];
  $: statusRows = leads ? cleanRows(leads.byStatus, 8) : { rows: [], max: 1 };
  $: topEventRows = traffic ? cleanRows(traffic.topEvents, 8) : { rows: [], max: 1 };
</script>

<section class="grid gap-6">
  <!-- header + range filter -->
  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Insights</p>
      <h2 class="mt-1 text-2xl font-bold text-ink">Analytics &amp; lead performance</h2>
      <p class="mt-1 text-sm text-ink/55">
        What's working, what's not, and what to do next.{#if lastUpdatedLabel}<span class="ml-1 text-ink/40">· {lastUpdatedLabel}</span>{/if}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <Filter size={15} class="mr-1 text-ink/40" />
      {#each RANGES as r}
        <CmsButton variant="ghost"
          class={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${range === r.k ? 'bg-forest text-white' : 'border border-ink/10 bg-surface text-ink/65 hover:border-goldfinch-gold/40'}`}
          type="button"
          onclick={() => setRange(r.k)}
        >{r.l}</CmsButton>
      {/each}
    </div>
  </div>

  {#if loading}
    <!-- full-page skeleton -->
    <div class="h-40 animate-pulse rounded-none border border-ink/10 bg-surface/70"></div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each Array(8) as _}<div class="h-32 animate-pulse rounded-none border border-ink/10 bg-surface/70"></div>{/each}
    </div>
    <div class="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <div class="h-72 animate-pulse rounded-none border border-ink/10 bg-surface/70"></div>
      <div class="h-72 animate-pulse rounded-none border border-ink/10 bg-surface/70"></div>
    </div>
  {:else if !overview}
    <AnalyticsEmpty icon={BarChart3} title="Couldn't load analytics" minHeight={260}
      description="We couldn't reach the analytics service. Check your connection and try again — your tracking is still recording in the background."
      hint="Pick a date range above to retry." />
  {:else}
    <!-- ── AI INSIGHTS (first thing you see) ─────────────────────────────── -->
    <div class="rounded-none border border-goldfinch-gold/30 bg-gradient-to-br from-forest/[0.04] to-goldfinch-gold/[0.06] p-5 shadow-card">
      <div class="mb-3 flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-xl bg-forest text-white"><Sparkles size={17} /></span>
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">AI insights</p>
          <h3 class="text-lg font-bold text-ink">Your key takeaways this period</h3>
        </div>
      </div>
      {#if insights.length}
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {#each insights as ins}
            {@const I = ins.icon}
            <div class="flex gap-3 rounded-xl border border-ink/[0.07] bg-surface/80 p-3.5">
              <span class={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONE[ins.tone]}`}><I size={16} /></span>
              <div class="min-w-0">
                <p class="text-[11px] font-bold uppercase tracking-[0.1em] text-ink/45">{ins.label}</p>
                <p class="mt-0.5 text-[13px] leading-5 text-ink/75">{ins.text}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <AnalyticsEmpty icon={Sparkles} title="Insights are warming up" minHeight={140}
          description="As soon as visitors browse tours and submit enquiries, we'll surface trends, your top destination, best traffic source and the biggest funnel drop-off here."
          hint="Share your site link on WhatsApp, Instagram or Google to start collecting data." />
      {/if}
    </div>

    <!-- ── KPI cards (sparkline + trend + click to drill in) ─────────────── -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each cards as c}
        {@const Icon = c.icon}
        {@const m = c.series.length ? momentum(c.series) : null}
        <CmsButton variant="ghost"
          type="button"
          class="group rounded-none border border-ink/10 bg-surface p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-goldfinch-gold/40 hover:shadow-[0_16px_40px_-18px_rgba(28,26,22,0.35)]"
          onclick={() => scrollTo(c.anchor)}
        >
          <div class="flex items-start justify-between">
            <span class="grid h-11 w-11 place-items-center rounded-2xl bg-forest/10 text-forest ring-1 ring-ink/5 dark:text-goldfinch-gold"><Icon size={19} /></span>
            {#if m}
              <span class={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-bold ${m.pct >= 0 ? 'bg-emerald-500/12 text-emerald-600' : 'bg-red-500/12 text-red-600'}`}>
                {#if m.pct >= 0}<ArrowUpRight size={12} />{:else}<ArrowDownRight size={12} />{/if}{Math.abs(m.pct)}%
              </span>
            {/if}
          </div>
          <p class="mt-4 text-3xl font-bold text-ink"><Counter value={typeof c.value === 'number' ? c.value : 0} suffix={c.suffix} decimals={c.suffix === '%' ? 1 : 0} /></p>
          <div class="mt-1 flex items-end justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink/70">{c.label}</p>
              <p class="mt-0.5 truncate text-xs text-ink/50">{c.helper}</p>
            </div>
            {#if c.series.length}<span class="shrink-0 text-forest/70"><Sparkline data={c.series} color="#4A3728" /></span>{/if}
          </div>
        </CmsButton>
      {/each}
    </div>

    <!-- ══ Website Intelligence — deterministic health, behaviour & priorities (real-only) ══ -->
    <section id="sec-ux" class="scroll-mt-24 overflow-hidden rounded-none border border-ink/10 bg-surface shadow-card">
      <!-- header: neutral branding · connection summary · quick actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-deep-green to-forest p-5 text-white">
        <div class="flex items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/12 text-goldfinch-gold ring-1 ring-white/15"><ShieldCheck size={20} /></span>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-goldfinch-gold">Website Intelligence</p>
            <h3 class="font-serif text-xl font-light leading-tight">Health, behaviour &amp; what to fix next</h3>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15">
            <span class="h-2 w-2 rounded-full bg-emerald-400"></span> {connectedCount}/{hubSources.length} sources live
          </span>
          <CmsButton variant="ghost" type="button" onclick={() => loadUx(true)} disabled={uxLoading} class="inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/20 disabled:opacity-50" aria-label="Refresh website intelligence">
            <RefreshCw size={14} class={uxLoading ? 'animate-spin' : ''} /> Refresh
          </CmsButton>
          <CmsButton variant="ghost" type="button" onclick={exportCsv} class="inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Export CSV">
            <Download size={14} /> CSV
          </CmsButton>
          <CmsButton variant="ghost" type="button" onclick={copyLink} class="inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/20" aria-label="Copy dashboard link">
            {#if copied}<Check size={14} /> Copied{:else}<Link2 size={14} /> Copy link{/if}
          </CmsButton>
          <a class="inline-flex items-center gap-1.5 rounded-lg bg-goldfinch-gold px-3 py-1.5 text-xs font-bold text-deep-green transition hover:brightness-105" href={clarityUrl} target="_blank" rel="noopener noreferrer">
            Open Clarity <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div class="grid gap-5 p-5">
        <!-- connection panel -->
        <div class="grid gap-2.5 sm:grid-cols-3">
          {#each hubSources as s}
            <div class="flex items-center gap-2.5 rounded-xl border border-ink/[0.07] bg-sand/20 px-3.5 py-2.5">
              <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${s.connected ? 'bg-emerald-500 ring-4 ring-emerald-500/15' : 'bg-ink/20'}`}></span>
              <div class="min-w-0">
                <p class="truncate text-[13px] font-bold text-ink/80">{s.label}</p>
                <p class="truncate text-[11px] text-ink/45">{s.note}</p>
              </div>
            </div>
          {/each}
        </div>

        <!-- Website Health + category scores (derived from real analytics) -->
        <div class="grid gap-4 rounded-2xl border border-ink/10 bg-gradient-to-br from-sand/35 to-surface p-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <div class="flex items-center gap-4">
            <ScoreRing score={intel?.health.score ?? null} label={intel?.health.status ?? ''} size={128} />
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">Website Health</p>
              <p class={`text-2xl font-extrabold ${healthStatusColor}`}>{intel?.health.status ?? 'N/A'}</p>
              <p class={`mt-1 flex items-center gap-1.5 text-[12px] font-semibold ${intel && intel.health.criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {#if intel && intel.health.criticalCount > 0}<AlertTriangle size={13} /> {intel.health.criticalCount} critical issue{intel.health.criticalCount === 1 ? '' : 's'}{:else}<CheckCircle2 size={13} /> No critical issues{/if}
              </p>
              <p class="mt-1 text-[10px] uppercase tracking-wide text-ink/35">Derived from website analytics</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {#each intel?.categoryScores ?? [] as cat (cat.key)}
              <div class="flex flex-col items-center rounded-xl border border-ink/[0.07] bg-surface p-3 text-center">
                <ScoreRing score={cat.score} size={68} stroke={7} />
                <p class="mt-1.5 text-[12px] font-bold text-ink/75">{cat.label}</p>
                <p class="mt-0.5 line-clamp-2 text-[10px] leading-3 text-ink/40">{cat.reason}</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Executive summary — real KPIs + previous-period benchmarks -->
        <div>
          <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">Executive summary · {intel?.range.label ?? `${range}`} vs previous period</p>
            {#if lastUpdatedLabel}<span class="text-[11px] text-ink/40">{lastUpdatedLabel}</span>{/if}
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {#each execCards as x (x.cfg.key)}
              <MetricCard
                label={x.cfg.label} value={x.ref.value} format={x.cfg.format ?? 'number'} source={x.ref.source}
                available={x.ref.status !== 'na'} emptyText={x.ref.note ?? ''} changePct={x.ref.changePct}
                series={x.cfg.series ? x.cfg.series() : []} icon={x.cfg.icon} accent={x.cfg.accent} loading={uxLoading && !intel} />
            {/each}
          </div>
          {#if intel && (intel.executive.biggestDropOff || intel.executive.topIssue)}
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              {#if intel.executive.biggestDropOff}
                <div class="flex items-center gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50/40 px-4 py-3">
                  <ArrowDownRight size={18} class="shrink-0 text-amber-600" />
                  <div><p class="text-[10px] font-bold uppercase tracking-wide text-amber-700/80">Biggest drop-off</p><p class="text-[13px] font-bold text-ink/80">{intel.executive.biggestDropOff}</p></div>
                </div>
              {/if}
              {#if intel.executive.topIssue}
                <div class="flex items-center gap-2.5 rounded-xl border border-red-300/60 bg-red-50/40 px-4 py-3">
                  <AlertTriangle size={18} class="shrink-0 text-red-500" />
                  <div><p class="text-[10px] font-bold uppercase tracking-wide text-red-700/80">Most important issue</p><p class="text-[13px] font-bold text-ink/80">{intel.executive.topIssue}</p></div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Alerts — rule-based on real conditions -->
        {#if intel?.alerts.length}
          <div>
            <p class="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">Alerts · {intel.alerts.length}</p>
            <div class="grid gap-2">
              {#each intel.alerts as a (a.id)}
                {@const st = ALERT_STYLE[a.severity]}
                <div class={`flex items-start gap-3 rounded-xl border px-4 py-3 ${st.cls}`}>
                  <svelte:component this={st.icon} size={16} class={`mt-0.5 shrink-0 ${st.text}`} />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-[13px] font-bold text-ink/85">{a.title}</p>
                      <span class="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/50">{a.category}</span>
                      {#if a.metric}<span class={`text-[11px] font-bold ${st.text}`}>{a.metric}</span>{/if}
                    </div>
                    <p class="mt-0.5 text-[12px] leading-5 text-ink/60">{a.detail}</p>
                  </div>
                  {#if a.deepLink}<a class="shrink-0 text-[11px] font-bold text-forest hover:underline" href={clarityLink(a.deepLink)} target="_blank" rel="noopener noreferrer">View →</a>{/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Recommended action plan — deterministic, priority-ordered -->
        {#if intel?.actions.length}
          <div>
            <p class="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40"><ListChecks size={13} /> Recommended action plan · priority order</p>
            <div class="grid gap-2.5">
              {#each intel.actions as a, i (a.id)}
                {@const p = PRIO_STYLE[a.priority]}
                <div class="relative flex gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_1px_2px_rgba(28,26,22,0.04)]">
                  <span class={`absolute inset-y-0 left-0 w-1 ${p.bar}`} aria-hidden="true"></span>
                  <span class="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/[0.05] text-[13px] font-extrabold text-ink/60">{i + 1}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.cls}`}>{p.label}</span>
                      <span class="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/50">{a.category}</span>
                      <span class="text-[11px] font-bold text-ink/45">{a.supportingMetric}</span>
                    </div>
                    <p class="mt-1 text-[14px] font-bold text-heading">{a.issue}</p>
                    <p class="mt-0.5 text-[12px] leading-5 text-ink/60"><span class="font-semibold text-ink/70">Why:</span> {a.why}</p>
                    <p class="mt-0.5 text-[12px] leading-5 text-ink/60"><span class="font-semibold text-ink/70">Fix:</span> {a.fix}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/[0.08] px-2 py-1 text-[11px] font-bold text-emerald-700"><TrendingUp size={12} /> {a.expectedOutcome}</span>
                      <span class="inline-flex items-center gap-1 rounded-lg bg-sand/50 px-2 py-1 text-[11px] font-semibold text-ink/65">Effort: {a.effort}</span>
                      <span class="inline-flex items-center gap-1 rounded-lg bg-sand/50 px-2 py-1 text-[11px] font-semibold text-ink/65">Confidence: {a.confidence}</span>
                      {#if a.deepLink}<a class="ml-auto text-[11px] font-bold text-forest hover:underline" href={clarityLink(a.deepLink)} target="_blank" rel="noopener noreferrer">View supporting data →</a>{/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if intel}
          <div class="flex items-center gap-2.5 rounded-xl border border-emerald-300/50 bg-emerald-50/40 px-4 py-3">
            <CheckCircle2 size={18} class="shrink-0 text-emerald-600" />
            <p class="text-[13px] text-ink/70">No priority issues detected in this period. Keep an eye on the alerts above as traffic grows.</p>
          </div>
        {/if}

        <!-- AI analyst summary — supporting, grounded in real data (not a chatbot) -->
        <div class="rounded-2xl border border-goldfinch-gold/25 bg-gradient-to-br from-goldfinch-gold/[0.06] to-transparent p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 text-[13px] font-bold text-clay">
              <Sparkles size={15} /> AI analyst summary
              <span class="rounded bg-clay/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-clay/70">Supporting · grounded in real data</span>
            </p>
            {#if ux?.generatedAt}
              <span class="text-[11px] text-ink/40">Generated {new Date(ux.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {/if}
          </div>
          {#if uxLoading && !ux}
            <div class="mt-3 grid gap-2" aria-hidden="true">
              <div class="h-4 w-3/4 animate-pulse rounded bg-ink/[0.07]"></div>
              <div class="h-4 w-2/3 animate-pulse rounded bg-ink/[0.05]"></div>
            </div>
          {:else if ux?.available}
            {#if ux.summary}<p class="mt-2 text-sm leading-6 text-ink/70">{ux.summary}</p>{/if}
            {#if ux.insights.length}
              <div class="mt-3 grid gap-3 lg:grid-cols-2">
                {#each ux.insights as ins (ins.id)}<InsightCard insight={ins} />{/each}
              </div>
            {/if}
            {#if ux.dataSources.length}<p class="mt-3 text-[11px] text-ink/40">Grounded in: {ux.dataSources.join(' · ')}</p>{/if}
          {:else}
            <div class="mt-2 flex items-start gap-2.5 rounded-xl border border-dashed border-ink/12 bg-sand/20 p-3.5">
              <Lightbulb size={16} class="mt-0.5 shrink-0 text-clay/60" />
              <p class="text-[13px] leading-6 text-ink/55">{ux?.reason ?? 'The AI summary fills in once there is enough traffic — the deterministic metrics above are unaffected.'}</p>
            </div>
          {/if}
        </div>

        <!-- UX friction signals (Clarity) -->
        <div>
          <p class="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">UX friction signals · Microsoft Clarity</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {#each clarityMetrics as m (m.key)}
              <MetricCard
                label={m.label} value={m.value} format={m.format ?? 'number'} source={m.source}
                available={m.available} deepLink={m.deepLink} deepLinkLabel={m.deepLinkLabel ?? 'Open in Clarity'}
                emptyText={m.emptyText ?? ''} icon={m.icon} accent={m.accent ?? '#0F6CBD'} loading={uxLoading && !clarity} />
            {/each}
          </div>
        </div>

        <!-- breakdowns (GA4 preferred, Clarity fallback — each stays labeled) -->
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BreakdownBars title="Devices" source={deviceSource} rows={deviceRows} icon={Monitor} accent="#153733" emptyText="Device split appears once GA4 or Clarity export is live." />
          <BreakdownBars title="Top countries" source={countrySource} rows={countryRows} icon={Globe} accent="#4A3728" emptyText="Country data appears with GA4 or Clarity export." />
          <BreakdownBars title="Top pages" source={pageSource} rows={pageRows} icon={AppWindow} accent="#0F6CBD" emptyText="Top pages appear with GA4 or Clarity export." />
          <BreakdownBars title="Browsers" source="clarity" rows={browserRows} icon={AppWindow} accent="#0F6CBD" emptyText="Browser split comes from Clarity data export." />
        </div>

        <!-- Event timeline — real detected changes only -->
        {#if intel?.timeline.length}
          <div>
            <p class="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40"><History size={13} /> Event timeline · detected changes</p>
            <div class="ml-2 grid gap-4 border-l border-ink/10 pl-5">
              {#each intel.timeline as ev (ev.date + ev.label)}
                <div class="relative">
                  <span class={`absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-surface ${ev.direction === 'up' ? 'bg-emerald-500' : ev.direction === 'down' ? 'bg-red-500' : 'bg-ink/30'}`}>
                    <svelte:component this={ev.direction === 'up' ? ArrowUpRight : ev.direction === 'down' ? ArrowDownRight : ArrowRight} size={10} class="text-white" strokeWidth={3} />
                  </span>
                  <p class="text-[10px] font-bold uppercase tracking-wide text-ink/40">{ev.when}</p>
                  <p class="text-[13px] font-bold text-ink/80">{ev.label}</p>
                  <p class="text-[11px] text-ink/50">{ev.detail}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- deep-link launchers — recordings & heatmaps live in Clarity, never rebuilt -->
        <div>
          <p class="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
            Explore in Microsoft Clarity <span class="font-medium normal-case tracking-normal text-ink/30">— recordings &amp; heatmaps open in Clarity</span>
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DeepLinkCard title="Session recordings" desc="Watch real visitor sessions" href={clarityLink('impressions')} icon={PlayCircle} enabled={clarityConnected} />
            <DeepLinkCard title="Click & scroll heatmaps" desc="Where attention actually goes" href={clarityLink('heatmaps')} icon={Flame} enabled={clarityConnected} />
            <DeepLinkCard title="Rage & dead clicks" desc="Frustration & friction signals" href={clarityLink('impressions')} icon={Hand} enabled={clarityConnected} />
            <DeepLinkCard title="Clarity dashboard" desc="Full UX analytics workspace" href={clarityUrl} icon={Activity} enabled={clarityConnected} />
          </div>
        </div>

        {#if !clarityConnected}
          <AnalyticsEmpty icon={ScanEye} title="Connect Microsoft Clarity" minHeight={140}
            description="Set PUBLIC_CLARITY_PROJECT_ID on the site and CLARITY_API_TOKEN on the backend to unlock live recordings, heatmaps and real rage/dead-click metrics here — the panels above light up automatically."
            hint="Clarity masks all form inputs by default — keep dashboard masking on 'Mask' or 'Balanced' for privacy." />
        {/if}
      </div>
    </section>

    <!-- ── funnel (interactive: click a step; bottleneck auto-flagged) ───── -->
    {#if funnel}
      <div id="sec-funnel" class="scroll-mt-24 rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Conversion funnel</p>
            <h3 class="mt-1 text-xl font-bold text-ink">Visitor → Booked</h3>
          </div>
          {#if bottleneck}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-xs font-bold text-amber-600">
              <AlertTriangle size={13} /> Bottleneck: {bottleneck.label}
            </span>
          {/if}
        </div>
        {#if funnelCfg}<ChartCanvas {...funnelCfg} height={300} />{/if}
        <div class="mt-5 grid gap-3 sm:grid-cols-4">
          {#each funnelSteps as step, i}
            <CmsButton variant="ghost"
              type="button"
              class={`rounded-xl border p-3 text-center transition ${activeStep === i ? 'border-forest bg-forest/[0.06]' : step.key === bottleneck?.key ? 'border-amber-400/60 bg-amber-50/40' : 'border-ink/10 bg-sand/25 hover:border-goldfinch-gold/40'}`}
              onclick={() => (activeStep = activeStep === i ? -1 : i)}
            >
              <p class="text-2xl font-extrabold text-heading">{step.rate}%</p>
              <p class="mt-0.5 text-[11px] font-semibold text-ink/55">{step.label}</p>
            </CmsButton>
          {/each}
        </div>
        {#if activeStep >= 0 && funnelSteps[activeStep]}
          <div class="mt-3 flex gap-3 rounded-xl border border-ink/[0.07] bg-sand/25 p-4">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-goldfinch-gold/15 text-clay"><Lightbulb size={17} /></span>
            <div>
              <p class="text-sm font-bold text-ink">{funnelSteps[activeStep].dropoff}% drop off at “{funnelSteps[activeStep].label}”</p>
              <p class="mt-0.5 text-xs leading-5 text-ink/60">{funnelSteps[activeStep].tip}</p>
            </div>
          </div>
        {:else}
          <p class="mt-3 text-center text-xs text-ink/45">Tap a step to see its drop-off and how to improve it. Per-step device &amp; source splits need GA4 event scopes (backend).</p>
        {/if}
      </div>
    {/if}

    <!-- ── GA4 traffic quality ──────────────────────────────────────────── -->
    {#if ga4}
      <div id="sec-traffic" class="scroll-mt-24 rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Website traffic · GA4</p>
            <h3 class="mt-1 text-xl font-bold text-ink">Visitors, sources &amp; quality</h3>
          </div>
          {#if ga4.configured}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>{ga4.activeUsers} active now
            </span>
          {/if}
        </div>

        {#if !ga4.configured}
          <AnalyticsEmpty icon={Users} title="Connect GA4 for full traffic quality" minHeight={200}
            description="Add GA4_PROPERTY_ID, GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY on the backend to unlock visitors, sessions, page views, sources, countries, devices and most-viewed tours. Your lead & funnel analytics above already work without it."
            hint="Open Settings → Integrations to check the connection status." />
        {:else if ga4.error}
          <p class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">GA4 error: {ga4.error}</p>
        {:else}
          <div class="grid gap-4 sm:grid-cols-4">
            {#each [['Users', ga4.totalUsers], ['Sessions', ga4.sessions], ['Page views', ga4.pageViews], ['Active now', ga4.activeUsers]] as [label, value]}
              <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
                <p class="text-2xl font-extrabold text-ink"><Counter value={Number(value)} /></p>
                <p class="mt-0.5 text-xs font-semibold text-ink/55">{label}</p>
              </div>
            {/each}
          </div>
          {#if ga4ListBlocks.length}
            <div class="mt-4 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              {#each ga4ListBlocks as block}
                <div>
                  <p class="text-xs font-bold text-ink/70">{block.title}</p>
                  {#if block.list.rows.length}
                    <div class="mt-2 grid gap-2">
                      {#each block.list.rows as row}
                        <div>
                          <div class="flex items-center justify-between text-[11px]">
                            <span class="truncate font-semibold text-ink/70" title={row.label}>{row.label}</span>
                            <span class="font-bold text-ink/50">{row.value}</span>
                          </div>
                          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-sand/50">
                            <div class="h-full rounded-full bg-gradient-to-r from-forest to-goldfinch-gold" style={`width: ${(row.value / block.list.max) * 100}%`}></div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="mt-2 text-xs text-ink/45">No data.</p>
                  {/if}
                </div>
              {/each}
            </div>
            {#if topTourPages.rows.length || topDestPages.rows.length}
              <div class="mt-5 grid gap-5 md:grid-cols-2">
                {#each [{ t: 'Most viewed tours', d: topTourPages, i: Trophy }, { t: 'Most viewed destinations', d: topDestPages, i: MapPin }] as blk}
                  {@const BI = blk.i}
                  <div class="rounded-xl border border-ink/[0.07] bg-sand/20 p-4">
                    <p class="flex items-center gap-1.5 text-xs font-bold text-ink/70"><BI size={14} /> {blk.t}</p>
                    {#if blk.d.rows.length}
                      <div class="mt-2 grid gap-2">
                        {#each blk.d.rows as row}
                          <div class="flex items-center justify-between text-[11px]">
                            <span class="truncate font-semibold text-ink/70" title={row.label}>{row.label}</span>
                            <span class="font-bold text-ink/50">{row.value}</span>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <p class="mt-2 text-xs text-ink/45">No page views yet.</p>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        {/if}
      </div>
    {/if}

    <!-- ── leads over time + source ─────────────────────────────────────── -->
    <div id="sec-leads" class="grid scroll-mt-24 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Leads over time</p>
        <h3 class="mt-1 text-xl font-bold text-ink">Leads by day</h3>
        <div class="mt-3">
          {#if (leads?.leadsByDay ?? []).some((d) => d.value > 0)}<ChartCanvas {...leadsLineCfg} height={280} />
          {:else}<AnalyticsEmpty icon={ClipboardList} title="No leads in this range yet" minHeight={280}
            description="Every 'Plan my safari', 'Request this trip' and AI advisor enquiry appears here so you can see which days and campaigns drive demand."
            hint="Run a WhatsApp or Instagram campaign, then check back." />{/if}
        </div>
      </div>
      <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Where leads come from</p>
        <h3 class="mt-1 text-xl font-bold text-ink">Lead source</h3>
        <div class="mt-3">
          {#if (leads?.bySource ?? []).some((x) => x.value > 0)}<ChartCanvas {...sourceDonutCfg} height={280} />
          {:else}<AnalyticsEmpty icon={Compass} title="No source data yet" minHeight={280}
            description="Once enquiries come in, you'll see whether they start from the planner, a tour page or the AI advisor." />{/if}
        </div>
      </div>
    </div>

    <!-- ── lead status pipeline ─────────────────────────────────────────── -->
    {#if statusRows.rows.length}
      <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Pipeline</p>
        <h3 class="mt-1 text-xl font-bold text-ink">Lead status</h3>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {#each statusRows.rows as s}
            <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
              <p class="text-2xl font-extrabold text-heading">{s.value}</p>
              <p class="mt-0.5 text-xs font-semibold capitalize text-ink/60">{s.label.replace(/_/g, ' ')}</p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-sand/50">
                <div class="h-full rounded-full bg-gradient-to-r from-forest to-goldfinch-gold" style={`width: ${(s.value / statusRows.max) * 100}%`}></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── demand + budget ──────────────────────────────────────────────── -->
    <div class="grid gap-6 xl:grid-cols-2">
      <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Demand</p>
        <h3 class="mt-1 text-xl font-bold text-ink">Most requested destinations</h3>
        <div class="mt-3">
          {#if (leads?.byDestination ?? []).some((x) => x.label !== 'Not specified' && x.value > 0)}<ChartCanvas {...destBarCfg} height={280} />
          {:else}<AnalyticsEmpty icon={MapPin} title="No destination demand yet" minHeight={280}
            description="When enquiries name a destination, this ranks which parks and regions travellers want most — useful for planning offers and content." />{/if}
        </div>
      </div>
      <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Budget</p>
        <h3 class="mt-1 text-xl font-bold text-ink">Budget range mix</h3>
        <div class="mt-3">
          {#if (leads?.byBudget ?? []).some((x) => x.value > 0)}<ChartCanvas {...budgetDonutCfg} height={280} />
          {:else}<AnalyticsEmpty icon={Target} title="No budget data yet" minHeight={280}
            description="See how enquiries split across budget tiers so you can weight your itineraries and pricing accordingly." />{/if}
        </div>
      </div>
    </div>

    <!-- ── ranked lead breakdowns ───────────────────────────────────────── -->
    <div class="grid gap-6 lg:grid-cols-3">
      {#each breakdownBlocks as block}
        <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
          <h3 class="text-sm font-bold text-ink">{block.t}</h3>
          {#if block.rows.length}
            <div class="mt-3 grid gap-2.5">
              {#each block.rows as row}
                <div>
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-ink/75">{row.label}</span>
                    <span class="font-bold text-ink/55">{row.value}</span>
                  </div>
                  <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-sand/50">
                    <div class="h-full rounded-full bg-gradient-to-r from-forest to-goldfinch-gold" style={`width: ${(row.value / block.max) * 100}%`}></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="mt-3 text-sm text-ink/45">No {block.t.toLowerCase()} captured yet.</p>
          {/if}
        </div>
      {/each}
    </div>

    <!-- ── events (business/dev toggle) + devices ───────────────────────── -->
    {#if traffic}
      <div id="sec-events" class="grid scroll-mt-24 gap-6 lg:grid-cols-[0.55fr_0.45fr]">
        <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-ink">Top interactions</h3>
            <div class="inline-flex rounded-lg border border-ink/10 bg-sand/40 p-0.5 text-[11px] font-bold">
              <CmsButton variant="ghost" type="button" class={`rounded-md px-2.5 py-1 transition ${eventView === 'business' ? 'bg-forest text-white' : 'text-ink/55'}`} onclick={() => (eventView = 'business')}>Business</CmsButton>
              <CmsButton variant="ghost" type="button" class={`rounded-md px-2.5 py-1 transition ${eventView === 'dev' ? 'bg-forest text-white' : 'text-ink/55'}`} onclick={() => (eventView = 'dev')}>Developer</CmsButton>
            </div>
          </div>
          {#if topEventRows.rows.length}
            <div class="mt-3 grid gap-2.5">
              {#each topEventRows.rows as ev}
                <div>
                  <div class="flex items-center justify-between text-xs">
                    <span class={`font-semibold text-ink/75 ${eventView === 'dev' ? 'font-mono' : ''}`}>{eventView === 'dev' ? ev.label : prettyEvent(ev.label)}</span>
                    <span class="font-bold text-ink/55">{ev.value}</span>
                  </div>
                  <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-sand/50">
                    <div class="h-full rounded-full bg-gradient-to-r from-forest to-goldfinch-gold" style={`width: ${(ev.value / topEventRows.max) * 100}%`}></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <AnalyticsEmpty icon={MousePointerClick} title="No interactions captured yet" minHeight={200}
              description="Tour views, searches, CTA clicks and form opens appear here as visitors explore — switch to Developer view for the raw GA4 event names."
              hint="Interactions start recording the moment someone lands on the site." />
          {/if}
        </div>
        <div class="rounded-none border border-ink/10 bg-surface p-5 shadow-card">
          <h3 class="text-sm font-bold text-ink">Devices</h3>
          <div class="mt-3">
            {#if traffic.byDevice.some((x) => x.value > 0)}<ChartCanvas {...deviceDonutCfg} height={200} />
            {:else}<AnalyticsEmpty icon={Users} title="No device data yet" minHeight={200}
              description="See the mobile / tablet / desktop split so you know where to optimise the booking experience first." />{/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</section>
