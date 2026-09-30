<script lang="ts">
  import { Compass, ArrowUpRight, ChevronDown, Search } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Sheet from '$lib/components/ui/sheet';
  import { groups, activeNavigation } from '$lib/admin/navigation';
  import { page } from '$app/state';
  import { safeUrl } from '$lib/home-content';
  let { collapsed = false, currentPath = '/admin', mobileOpen = false, onCloseMobile = () => {}, onToggleDesktop = () => {} }: { collapsed?: boolean; currentPath?: string; mobileOpen?: boolean; onCloseMobile?: () => void; onToggleDesktop?: () => void } = $props();
  let search = $state('');
  // CMS emblem (Branding → favicon_url); the full logo is too wide to read at sidebar size.
  const emblem = $derived(safeUrl(page.data.branding?.favicon_url, ''));
  let expanded = $state(['Workspace', 'Safaris & destinations', 'Bookings & guests']);
  const active = $derived(activeNavigation(currentPath));
  const filtered = $derived(groups.map(group => ({ ...group, links: group.links.filter(link => `${group.label} ${link.label}`.toLowerCase().includes(search.toLowerCase())) })).filter(group => group.links.length));
  $effect(() => {
    const group = groups.find(group => group.links.some(link => link.href === active?.href));
    if (group && !expanded.includes(group.label)) expanded = [...expanded, group.label];
  });
</script>

{#snippet navigation(compact: boolean)}
  <a class="cms-brand" href="/admin" onclick={onCloseMobile} aria-label="Key2africa dashboard">
    {#if emblem}
      <span class="cms-brand-mark" style="background:#fff;box-shadow:inset 0 0 0 1px rgb(18 50 82 / .12)"><img src={emblem} alt="" class="size-8 object-contain" /></span>
    {:else}
      <span class="cms-brand-mark"><Compass size={25} strokeWidth={1.7} /></span>
    {/if}
    {#if !compact}<span><strong>Key2africa<span class="cms-brand-dot">.</span></strong><small>SAFARI WORKSPACE</small></span>{/if}
  </a>
  {#if !compact}
    <div class="cms-menu-search"><Search size={15}/><Input aria-label="Find a menu page" placeholder="Find a page…" bind:value={search} /></div>
  {/if}
  <nav class="cms-nav" aria-label="Main navigation">
    {#if compact}
      {#each groups as group}
        <div class="cms-compact-group">
          {#each group.links as link}
            <Button href={link.href} variant="ghost" size="icon" class={`cms-nav-link ${active?.href === link.href ? 'is-active' : ''}`} title={link.label} aria-label={link.label} aria-current={active?.href === link.href ? 'page' : undefined}><link.icon size={18}/></Button>
          {/each}
        </div>
      {/each}
    {:else if search}
      {#each filtered as group}
        <p class="cms-group-label">{group.label}</p>
        {#each group.links as link}
          <Button href={link.href} variant="ghost" class={`cms-nav-link ${active?.href === link.href ? 'is-active' : ''}`} onclick={onCloseMobile} aria-current={active?.href === link.href ? 'page' : undefined}><link.icon size={17}/><span>{link.label}</span></Button>
        {/each}
      {/each}
    {:else}
      <Accordion.Root type="multiple" bind:value={expanded}>
        {#each groups as group}
          <Accordion.Item value={group.label} class="border-0">
            <Accordion.Trigger class="cms-group-label hover:no-underline py-3">{group.label}</Accordion.Trigger>
            <Accordion.Content class="pb-2">
              {#each group.links as link}
                <Button href={link.href} variant="ghost" class={`cms-nav-link ${active?.href === link.href ? 'is-active' : ''}`} onclick={onCloseMobile} aria-current={active?.href === link.href ? 'page' : undefined}><link.icon size={17}/><span>{link.label}</span>{#if active?.href === link.href}<span class="cms-active-dot"></span>{/if}</Button>
              {/each}
            </Accordion.Content>
          </Accordion.Item>
        {/each}
      </Accordion.Root>
    {/if}
    {#if search && !filtered.length}<p class="px-3 py-8 text-xs text-muted-foreground">No pages found.</p>{/if}
  </nav>
  <div class="cms-sidebar-bottom">
    {#if !compact}<p>Made for remarkable journeys.</p>{/if}
    <Button href="/" target="_blank" rel="noopener noreferrer" variant="outline" class={compact ? 'size-10 p-0' : 'w-full justify-between'} aria-label="View website">{#if !compact}View website{/if}<ArrowUpRight size={16}/></Button>
  </div>
{/snippet}

<aside class={`cms-sidebar hidden lg:flex ${collapsed ? 'is-collapsed' : ''}`}>{@render navigation(collapsed)}</aside>
<Sheet.Root open={mobileOpen} onOpenChange={(open) => { if (!open) onCloseMobile(); }}>
  <Sheet.Content side="left" class="cms-mobile-sidebar w-[290px] p-0 gap-0">
    <Sheet.Title class="sr-only">Key2africa navigation</Sheet.Title>
    <Sheet.Description class="sr-only">Manage safaris, bookings, website content and settings.</Sheet.Description>
    {@render navigation(false)}
  </Sheet.Content>
</Sheet.Root>
