<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  import { onMount, tick } from 'svelte';
  import { ArrowRight } from '@lucide/svelte';

  export let packageName: string;
  export let formHref: string;

  let navigation: HTMLElement;
  let links: { id: string; label: string }[] = [];
  let activeId = '';
  let planningVisible = false;

  onMount(() => {
    let disposed = false;
    let frame = 0;
    let sections: HTMLElement[] = [];
    let observer: IntersectionObserver | undefined;

    const updateActive = () => {
      frame = 0;
      const threshold = navigation.getBoundingClientRect().bottom + 32;
      const reached = sections.filter((section) => section.getBoundingClientRect().top <= threshold);
      activeId = (reached.at(-1) ?? sections[0])?.id ?? '';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateActive);
    };

    void tick().then(() => {
      if (disposed) return;
      const root = navigation.closest('.safari-package-page');
      const seen = new Set<string>();
      sections = Array.from(root?.querySelectorAll<HTMLElement>('[data-package-label]') ?? []).filter((section) => {
        const label = section.dataset.packageLabel;
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
      });
      links = sections.map((section) => ({ id: section.id, label: section.dataset.packageLabel! }));
      updateActive();
      const planners = Array.from(root?.querySelectorAll<HTMLElement>('[data-package-enquiry]') ?? []);
      const visible = new Set<Element>();
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
        planningVisible = visible.size > 0;
      }, { threshold: 0.15 });
      planners.forEach((planner) => observer?.observe(planner));
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  });
</script>

<nav bind:this={navigation} class="package-navigation" class:empty={links.length < 2} aria-label={$t('ui.explore_this_safari')}>
  <div class="package-navigation-track">
    {#each links as link (link.id)}
      <a href={`#${link.id}`} aria-current={activeId === link.id ? 'location' : undefined}>{link.label}</a>
    {/each}
  </div>
</nav>

<aside class="package-dock" class:concealed={planningVisible} aria-label={$t('ui.plan_this_safari')}>
  <div class="package-dock-copy">
    <span>{$t('ui.your_next_adventure')}</span>
    <strong>{packageName}</strong>
  </div>
  <a href={formHref}>{$t('ui.plan_this_trip_2')}<ArrowRight size={17} /></a>
</aside>

<style>
  .package-dock { display:none; }
  .package-navigation { position:sticky; top:var(--nav-h,70px); z-index:30; border-bottom:1px solid rgb(var(--c-ink)/.1); background:rgb(var(--c-surface)/.97); }
  .package-navigation.empty { display:none; }
  .package-navigation-track { display:flex; gap:28px; overflow-x:auto; max-width:1200px; margin-inline:auto; padding:0 32px; }
  .package-navigation a { flex-shrink:0; display:flex; align-items:center; min-height:54px; border-bottom:2px solid transparent; font-size:13px; font-weight:600; color:rgb(var(--c-ink)/.6); }
  .package-navigation a[aria-current] { color:rgb(var(--c-forest)); border-bottom-color:rgb(var(--c-clay)); }

  @media (max-width: 767px) {
    .package-navigation {
      position: sticky;
      top: var(--nav-h, 70px);
      z-index: 30;
      display: block;
      border-bottom: 1px solid rgb(var(--c-ink) / 0.1);
      /* The page is white now; a cream bar read as a stripe across it. */
      background: rgb(var(--c-surface) / 0.95);
      backdrop-filter: blur(8px);
    }
    .package-navigation.empty { display: none; }
    .package-navigation-track {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 0 16px;
      scroll-padding-inline: 16px;
      scroll-snap-type: x proximity;
    }
    .package-navigation-track::-webkit-scrollbar { display: none; }
    .package-navigation a {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      min-height: 44px;
      padding: 0.7rem 0 calc(0.7rem + 4px);
      color: rgb(var(--c-ink) / 0.6);
      font-size: 13px;
      line-height: 1.5;
      font-weight: 600;
      white-space: nowrap;
      scroll-snap-align: start;
    }
    .package-navigation a:hover,
    .package-navigation a[aria-current] { color: rgb(var(--c-heading)); }
    .package-navigation a[aria-current]::after {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 2px;
      background: rgb(var(--c-clay));
    }
    .package-dock {
      position: fixed;
      inset: auto 0 0;
      z-index: 45;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      border-top: 1px solid rgb(var(--c-ink) / 0.1);
      background: rgb(var(--c-surface) / 0.97);
      box-shadow: 0 -6px 24px rgb(0 0 0 / 0.06);
      backdrop-filter: blur(16px);
    }
    .package-dock.concealed, :global(body:has(.package-dock.concealed) .package-aware-fab) { display: none; }
    .package-dock-copy { flex: 1; min-width: 0; }
    .package-dock-copy span { display: block; color: rgb(var(--c-clay)); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .package-dock-copy strong { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; margin-top: 4px; font-size: 12px; line-height: 1.4; color: rgb(var(--c-heading)); }
    .package-dock > a { display: inline-flex; min-height: 48px; flex-shrink: 0; align-items: center; gap: 8px; border-radius: 12px; padding: 0 16px; background: rgb(var(--c-goldfinch-gold)); color: rgb(var(--c-forest)); font-size: 13px; font-weight: 700; }
    a:focus-visible { outline: 2px solid rgb(var(--c-clay)); outline-offset: 2px; }
    :global(html:has(.package-dock)) { --package-dock-space: 80px; }
    :global(body:has(.package-dock) footer) { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
    :global(body:has(.safari-package-page input:focus) .package-dock),
    :global(body:has(.safari-package-page select:focus) .package-dock),
    :global(body:has(.safari-package-page textarea:focus) .package-dock) { display: none; }
  }
</style>
