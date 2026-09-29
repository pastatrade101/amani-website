<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/admin/api/client';
  import AdminLayout from '$lib/admin/components/admin/AdminLayout.svelte';

  onMount(() => { document.body.classList.add('key2africa-admin-surface'); return () => document.body.classList.remove('key2africa-admin-surface'); });

  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/analytics': 'Analytics',
    '/admin/tours': 'Tours',
    '/admin/safari-packages': 'Safari Packages',
    '/admin/tours/new': 'New Tour',
    '/admin/itineraries': 'Itineraries',
    '/admin/available-dates': 'Available Dates',
    '/admin/pricing-options': 'Pricing Options',
    '/admin/exchange-rates': 'Exchange Rates',
    '/admin/categories': 'Tour Categories',
    '/admin/destinations': 'Destinations',
    '/admin/bookings': 'Bookings',
    '/admin/payments': 'Payments',
    '/admin/blog': 'Blog',
    '/admin/blog/categories': 'Blog Categories',
    '/admin/gallery': 'Gallery',
    '/admin/media': 'Media Library',
    '/admin/testimonials': 'Testimonials',
    '/admin/faqs': 'FAQs',
    '/admin/homepage': 'Homepage',
    '/admin/messages': 'Messages',
    '/admin/branding': 'Branding',
    '/admin/settings': 'Settings',
    '/admin/settings/integrations': 'Integrations',
    '/admin/users': 'Admin Users',
    '/admin/roles': 'Roles and Permissions',
    '/admin/audit-logs': 'Audit Logs',
    '/admin/ai-conversations': 'AI Conversations',
    '/admin/whatsapp': 'WhatsApp Inbox'
  };

  $: path = $page.url.pathname;
  $: isLogin = path === '/admin/login';
  $: isPackagePreview = path === '/admin/safari-packages/preview';
  $: title = titles[path] ?? path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) ?? 'Workspace';
  let authenticated = false;
  let verifying = false;
  let sessionError = '';
  let activeToken: string | null = null;
  async function verifySession() {
    if (verifying) return;
    const token = localStorage.getItem('admin_token');
    if (!token) { authenticated = false; await goto('/admin/login'); return; }
    if (token === activeToken && authenticated) return;
    verifying = true;
    sessionError = '';
    try {
      const response = await api.auth.me();
      localStorage.setItem('admin_user', JSON.stringify(response.data));
      activeToken = token;
      authenticated = true;
    } catch (error) {
      authenticated = false;
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_permissions');
        await goto('/admin/login');
      } else sessionError = 'We could not verify your session. Check the backend connection and try again.';
    } finally { verifying = false; }
  }
  $: if (browser && path) {
    if (isLogin) { authenticated = false; activeToken = null; }
    else void verifySession();
  }
</script>

<svelte:head>
  <title>{title} | Key2africa CMS</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="key2africa-admin">
  {#if isLogin}
    <slot />
  {:else if authenticated}
    {#if isPackagePreview}<slot />{:else}<AdminLayout {title} currentPath={path}><slot /></AdminLayout>{/if}
  {:else}
    <div class="grid min-h-screen place-items-center p-6">
      <div class="max-w-sm text-center">
        <p class="text-sm text-ink/70" role="status">{sessionError || 'Checking your session…'}</p>
        {#if sessionError}<CmsButton variant="ghost" class="mt-5 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white" onclick={verifySession}>Try again</CmsButton>{/if}
      </div>
    </div>
  {/if}
</div>
