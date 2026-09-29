<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Search, PanelLeft, Menu, ChevronDown, ChevronRight, LogOut, Settings, ShieldCheck, Plus, ArrowUpRight, Map, FileText, Image, Mail } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Dialog from '$lib/components/ui/dialog';
  import { navigationLinks } from '$lib/admin/navigation';
  type AdminUser = { avatar_url?: string; email?: string; full_name?: string; name?: string; role?: string };
  let { collapsed = false, onLogout = () => {}, onOpenMobile = () => {}, onToggleDesktop = () => {}, title = 'Dashboard', user = null }: {collapsed?: boolean; onLogout?: () => void; onOpenMobile?: () => void; onToggleDesktop?: () => void; title?: string; user?: AdminUser | null} = $props();
  let searchOpen = $state(false);
  let query = $state('');
  const results = $derived(navigationLinks.filter(link => link.label.toLowerCase().includes(query.trim().toLowerCase())));
  const displayName = $derived(user?.full_name || user?.name || 'Key2africa');
  const role = $derived((user?.role || 'Administrator').replaceAll('_', ' '));
  const initials = $derived(displayName.split(/\s+/).map(part => part[0]).slice(0,2).join(''));
  onMount(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); searchOpen = !searchOpen; } };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
</script>
<header class="cms-topbar">
  <div class="flex min-w-0 items-center gap-3">
    <Button variant="ghost" size="icon" class="lg:hidden" aria-label="Open navigation" onclick={onOpenMobile}><Menu/></Button>
    <Button variant="ghost" size="icon" class="hidden lg:inline-flex" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onclick={onToggleDesktop}><PanelLeft/></Button>
    <span class="h-5 w-px bg-border hidden sm:block"></span>
    <a href="/admin" class="hidden text-xs text-muted-foreground sm:block">Workspace</a><ChevronRight size={13} class="hidden text-muted-foreground sm:block"/>
    <span class="truncate text-xs font-medium">{title}</span>
  </div>
  <div class="flex items-center gap-2 sm:gap-3">
    <Button variant="outline" class="cms-global-search" onclick={() => searchOpen = true} aria-label="Search workspace"><Search size={15}/><span class="hidden md:block">Search workspace</span><kbd class="hidden lg:block">⌘ K</kbd></Button>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="cms-create-trigger" aria-label="Create new"><Plus size={16}/><span class="hidden sm:inline">Create</span><ChevronDown size={13}/></DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-52">
        <DropdownMenu.Label>Create something new</DropdownMenu.Label>
        <DropdownMenu.Item onclick={() => goto('/admin/tours/new')}><Map/>Safari itinerary</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => goto('/admin/quotations')}><FileText/>Quotation</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => goto('/admin/media')}><Image/>Media upload</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    <div class="hidden h-6 w-px bg-border sm:block"></div>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="cms-profile-trigger" aria-label="Account menu"><span class="cms-avatar">{initials}</span><ChevronDown size={13} class="hidden sm:block"/></DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-64 p-2">
        <div class="px-2 py-3"><p class="text-sm font-semibold">{displayName}</p><p class="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p><p class="mt-2 flex items-center gap-1 text-xs capitalize text-muted-foreground"><ShieldCheck size={12}/>{role}</p></div>
        <DropdownMenu.Separator/>
        <DropdownMenu.Item onclick={() => goto('/admin/settings')}><Settings/>Workspace settings</DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => goto('/admin/messages')}><Mail/>Messages</DropdownMenu.Item>
        <DropdownMenu.Separator/>
        <DropdownMenu.Item class="text-destructive focus:text-destructive" onclick={onLogout}><LogOut/>Sign out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>
<Dialog.Root bind:open={searchOpen}>
  <Dialog.Content class="sm:max-w-xl p-0 gap-0 overflow-hidden">
    <Dialog.Header class="px-6 pt-6"><Dialog.Title>Find your way</Dialog.Title><Dialog.Description>Jump to any page in your workspace.</Dialog.Description></Dialog.Header>
    <div class="relative m-5"><Search class="absolute left-3 top-3 text-muted-foreground" size={17}/><Input class="pl-10 h-11" aria-label="Search pages" placeholder="Tours, bookings, settings…" bind:value={query}/></div>
    <div class="max-h-[45vh] overflow-y-auto px-3 pb-4" aria-label="Search results">
      {#each results as link}<Button variant="ghost" class="w-full justify-start gap-3 h-11" onclick={() => { searchOpen = false; query = ''; goto(link.href); }}><link.icon size={17}/>{link.label}<ArrowUpRight size={14} class="ml-auto text-muted-foreground"/></Button>{:else}<p class="p-6 text-center text-sm text-muted-foreground">No pages match “{query}”.</p>{/each}
    </div>
  </Dialog.Content>
</Dialog.Root>
