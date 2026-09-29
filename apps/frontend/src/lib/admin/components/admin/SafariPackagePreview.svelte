<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { Monitor, Smartphone, RefreshCw } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { blocksForSaving, lines, routeTourSlugs, type Block } from '$lib/admin/safariPackageBlocks';
  import { attachedFaqQuery, generalFaqQuery, mergeFaqs } from '$lib/admin/faqEntities';
  import type { SafariPackage, Tour, Lodge, FAQ } from '$lib/admin/types';

  export let record: SafariPackage;
  export let blocks: Block[] = [];
  export let availableTours: Tour[] = [];
  let frame: HTMLIFrameElement;
  let width: 'desktop' | 'mobile' = 'desktop';
  let stage: HTMLDivElement;
  let previewScale = 1;
  let ready = false;
  let loading = true;
  let warning = '';
  let related: Tour[] = [];
  let relatedLodges: Lodge[] = [];
  let moduleFaqs: FAQ[] = [];
  let linked: Tour | null = null;
  let homeSections: Record<string, unknown> = {};
  let interests: Record<string, unknown>[] = [];
  let startPoints: Record<string, unknown>[] = [];
  $: sections = blocksForSaving(blocks);

  const read = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load linked content');
    return (await response.json()).data;
  };

  const load = async () => {
    loading = true;
    warning = '';
    const failures: string[] = [];
    async function safely<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
      try { return await run(); } catch { failures.push(label); return fallback; }
    };
    const linkedSlug = availableTours.find((tour) => tour.id === record.tour_id)?.slug;
    const slugs = new Set(sections.flatMap((block) => {
      if (block.type === 'tours') return lines(block.tour_slugs);
      if (block.type !== 'routes') return [];
      return (Array.isArray(block.routes) ? block.routes : []).flatMap((route) => routeTourSlugs(route));
    }).filter(Boolean));
    if (linkedSlug) slugs.add(linkedSlug);
    // Only public records are needed. Draft text stays in this browser and is never saved by preview.
    const [tourRows, lodges, homepage, categories, gateways, attached, general] = await Promise.all([
      Promise.all([...slugs].map((slug) => safely(`tour “${slug}”`, async () => (await api.tours.get(slug)).data as Tour, null))),
      safely('accommodation', async () => (await api.lodges.list({ status: 'published', limit: 200 })).data.items ?? [], [] as Lodge[]),
      safely('advisor note', () => read('/api/homepage'), []),
      safely('trip interests', () => read('/api/categories?status=published&limit=30'), { items: [] }),
      safely('starting points', () => read('/api/trip-points?status=published&limit=30'), { items: [] }),
      record.id ? safely('attached FAQs', () => read(`/api/faqs?${attachedFaqQuery('safari_packages', record.id, 8)}`), { items: [] }) : Promise.resolve({ items: [] }),
      safely('general FAQs', () => read(`/api/faqs?${generalFaqQuery(8)}`), { items: [] })
    ]);
    related = tourRows.filter((tour): tour is Tour => Boolean(tour));
    linked = related.find((tour) => tour.id === record.tour_id) ?? null;
    relatedLodges = lodges;
    homeSections = Object.fromEntries((Array.isArray(homepage) ? homepage : []).map((section) => [section.section_key, section]));
    interests = categories.items ?? [];
    startPoints = (gateways.items ?? []).filter((point: Record<string, unknown>) => ['start', 'both'].includes(String(point.role)));
    moduleFaqs = mergeFaqs(attached.items ?? [], general.items ?? [], 8);
    loading = false;
    if (failures.length) warning = `Some linked content could not be loaded: ${failures.join(', ')}. Your draft is unchanged. Retry to see the complete preview.`;
  };

  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame?.contentWindow || event.data?.type !== 'package-preview-ready') return;
      ready = true;
    };
    const observer = new ResizeObserver(() => { previewScale = Math.min(1, Math.max(0.1, (stage.clientWidth - 32) / 1200)); });
    observer.observe(stage);
    window.addEventListener('message', receive);
    void load();
    return () => { observer.disconnect(); window.removeEventListener('message', receive); };
  });

  $: if (ready && frame && !loading) frame.contentWindow?.postMessage({
    type: 'package-preview',
    payload: {
      record: { ...record, sections, tours: linked }, related, relatedLodges, moduleFaqs,
      homeSections, interests, startPoints
    }
  }, window.location.origin);
</script>

<div class="preview-toolbar">
  <div><strong>Preview your page</strong><p>Your unsaved content, using the website’s actual layout. Site navigation is omitted; enquiry submission is disabled.</p></div>
  <div class="preview-controls" role="group" aria-label="Preview width">
    <CmsButton variant="ghost" type="button" aria-pressed={width === 'desktop'} onclick={() => (width = 'desktop')}><Monitor size={16} /> Desktop</CmsButton>
    <CmsButton variant="ghost" type="button" aria-pressed={width === 'mobile'} onclick={() => (width = 'mobile')}><Smartphone size={16} /> Mobile</CmsButton>
    <CmsButton variant="ghost" type="button" disabled={loading} onclick={load} aria-label="Reload linked content"><RefreshCw size={16} /></CmsButton>
  </div>
</div>
{#if loading}<p class="mb-3 text-sm text-ink/60" role="status">Loading photos, prices and itineraries…</p>{/if}
{#if warning}<p class="mb-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900" role="status">{warning}</p>{/if}
<div class="preview-stage" bind:this={stage} style={`--preview-scale:${previewScale}`}>
  <div class="preview-viewport" class:mobile={width === 'mobile'}>
  <iframe bind:this={frame} src="/admin/safari-packages/preview" title="Unsaved safari package preview" ></iframe>
  </div>
</div>

<style>
:global {
 .key2africa-admin-surface {

  .preview-toolbar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px; margin-bottom:20px; }
  .preview-toolbar strong { font-size:15px; color:rgb(var(--c-heading)); }
  .preview-toolbar p { margin-top:5px; max-width:68ch; font-size:12px; line-height:1.6; color:rgb(var(--c-ink)/.6); }
  .preview-controls { display:flex; flex-wrap:wrap; gap:6px; }
  .preview-controls button { display:flex; align-items:center; gap:7px; min-height:40px; padding:8px 12px; border:1px solid rgb(var(--c-ink)/.12); border-radius:7px; font-size:12px; font-weight:600; }
  .preview-controls button[aria-pressed=true] { background:rgb(var(--c-forest)); color:white; }
  .preview-stage { padding:16px; background:#e9eae5; border-radius:12px; border:1px solid rgb(var(--c-ink)/.1); }
  .preview-viewport { width:calc(1200px * var(--preview-scale)); height:calc(820px * var(--preview-scale)); margin:0 auto; }
  iframe { display:block; width:1200px; max-width:none; height:820px; transform:scale(var(--preview-scale)); transform-origin:top left; background:white; border:0; border-radius:8px; box-shadow:0 4px 20px #00000012; }
  .preview-viewport.mobile { width:390px; max-width:100%; height:760px; }
  .preview-viewport.mobile iframe { width:100%; height:760px; transform:none; }


 }
}
</style>
