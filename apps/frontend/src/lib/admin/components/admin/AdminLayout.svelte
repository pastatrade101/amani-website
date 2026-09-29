<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { api } from '$lib/admin/api/client';
  import AdminSidebar from './AdminSidebar.svelte';
  import AdminTopbar from './AdminTopbar.svelte';
  import SessionTimeout from './SessionTimeout.svelte';

  export let currentPath = '/admin';
  export let title = 'Dashboard';

  let sidebarCollapsed = false;
  let mobileSidebarOpen = false;
  let user: { email?: string; name?: string; role?: string } | null = null;

  const loadUser = () => {
    if (!browser) return;
    try {
      user = JSON.parse(localStorage.getItem('admin_user') ?? 'null');
    } catch {
      user = null;
    }
  };

  const logout = async (reason?: string) => {
    try {
      await api.auth.logout();
    } catch {
      // Local logout should still complete if the API is unavailable.
    }

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_permissions');
    await goto(reason ? `/admin/login?reason=${reason}` : '/admin/login');
  };

  onMount(loadUser);
</script>

<!-- --admin-aside: current sidebar width, so fixed overlays (modals) can offset
     themselves and center within the CONTENT area instead of the full viewport. -->
<div class="admin-shell h-dvh overflow-hidden font-admin text-ink" style={`--admin-aside:${sidebarCollapsed ? '76px' : '256px'}`}>
  <div class="flex h-full min-w-0">
    <AdminSidebar
      collapsed={sidebarCollapsed}
      {currentPath}
      mobileOpen={mobileSidebarOpen}
      onCloseMobile={() => (mobileSidebarOpen = false)}
      onToggleDesktop={() => (sidebarCollapsed = !sidebarCollapsed)}
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <AdminTopbar
        collapsed={sidebarCollapsed}
        {title}
        {user}
        onLogout={logout}
        onOpenMobile={() => (mobileSidebarOpen = true)}
        onToggleDesktop={() => (sidebarCollapsed = !sidebarCollapsed)}
      />

      <main
        class="cms-main min-h-0 flex-1 overflow-y-auto"
        data-lenis-prevent
      >
        <div class="cms-content"><slot /></div>
      </main>
    </div>
  </div>
</div>

<SessionTimeout onTimeout={() => logout('timeout')} />
