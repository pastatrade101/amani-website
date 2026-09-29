<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';

  /**
   * Connecting the business's own WhatsApp Business account.
   *
   * Until now the sending number came from the server's environment, so it was
   * whoever built the site. This lets the business connect their own account
   * and become the sender.
   *
   * The access token only ever travels one way. It is written here and never
   * read back — no endpoint returns it, so there is nothing to render, and the
   * field is cleared the moment a connection succeeds.
   */
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { AlertTriangle, CheckCircle2, Link2, Loader2, MessageCircle, Unlink } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from './AdminButton.svelte';
  import ConfirmModal from './ConfirmModal.svelte';

  export let connection: Record<string, any> | null = null;

  let busy = '';
  let error = '';
  let notice = '';
  let showManual = false;
  let confirmDisconnect = false;
  let manual = { waba_id: '', phone_number_id: '', access_token: '' };

  /** Meta posts Embedded Signup progress here; anything else is ignored. */
  const SIGNUP_ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];
  let signupListener: ((event: MessageEvent) => void) | null = null;

  const detachListener = () => {
    if (signupListener && browser) window.removeEventListener('message', signupListener);
    signupListener = null;
  };
  onDestroy(detachListener);

  const refresh = async () => {
    try {
      connection = (await api.whatsapp.connection()).data;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to read the connection.';
    }
  };

  const fail = (e: unknown, fallback: string) => {
    error = e instanceof Error && e.message ? e.message : fallback;
    notice = '';
  };

  // Loaded on demand, never at page load: an admin who never connects WhatsApp
  // should not be made to fetch Meta's SDK, and it must not run during SSR.
  const loadFacebookSdk = (appId: string): Promise<any> =>
    new Promise((resolve, reject) => {
      const w = window as any;
      if (w.FB) return resolve(w.FB);
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        w.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: connection?.graph_version ?? 'v21.0' });
        w.FB ? resolve(w.FB) : reject(new Error('Facebook SDK loaded but did not initialise.'));
      };
      script.onerror = () => reject(new Error('Could not load Meta’s sign-up script. A blocker or content policy may be stopping it.'));
      document.head.appendChild(script);
    });

  const connectWithMeta = async () => {
    error = '';
    notice = '';
    const appId = connection?.embedded_signup?.app_id;
    const configId = connection?.embedded_signup?.config_id;
    if (!appId || !configId) return;

    busy = 'signup';
    // The popup tells us which account was chosen; FB.login returns the code
    // that proves it. Neither alone is enough, so both are collected before the
    // server is called.
    let chosen: { waba_id?: string; phone_number_id?: string } = {};

    try {
      const FB = await loadFacebookSdk(appId);

      detachListener();
      signupListener = (event: MessageEvent) => {
        if (!SIGNUP_ORIGINS.includes(event.origin)) return;
        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (payload?.type === 'WA_EMBEDDED_SIGNUP' && payload.event === 'FINISH') chosen = payload.data ?? {};
        } catch {
          // Meta also posts unrelated, non-JSON messages on this channel.
        }
      };
      window.addEventListener('message', signupListener);

      const code: string = await new Promise((resolve, reject) => {
        FB.login(
          (response: any) => {
            const value = response?.authResponse?.code;
            value ? resolve(value) : reject(new Error('Sign-up was cancelled before it finished.'));
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
          }
        );
      });

      if (!chosen.waba_id || !chosen.phone_number_id) {
        throw new Error('Meta did not say which WhatsApp account was chosen. Please run the sign-up again.');
      }

      await api.whatsapp.connect({ code, waba_id: chosen.waba_id, phone_number_id: chosen.phone_number_id });
      notice = 'Connected. This site now sends from your WhatsApp number.';
      await refresh();
    } catch (e) {
      fail(e, 'Could not complete the WhatsApp sign-up.');
    } finally {
      detachListener();
      busy = '';
    }
  };

  const connectManually = async () => {
    error = '';
    notice = '';
    busy = 'manual';
    try {
      await api.whatsapp.connectManual({
        waba_id: manual.waba_id.trim(),
        phone_number_id: manual.phone_number_id.trim(),
        access_token: manual.access_token.trim()
      });
      // Written, never read back. Clearing it means a shoulder-surfer or a
      // screenshot cannot pick it up off an idle screen.
      manual = { waba_id: '', phone_number_id: '', access_token: '' };
      showManual = false;
      notice = 'Connected. This site now sends from your WhatsApp number.';
      await refresh();
    } catch (e) {
      fail(e, 'Those credentials were not accepted.');
    } finally {
      busy = '';
    }
  };

  const test = async () => {
    error = '';
    notice = '';
    busy = 'test';
    try {
      const res = await api.whatsapp.testConnection();
      const account = (res.data as any)?.account;
      notice = account?.display_phone_number
        ? `Meta confirms ${account.display_phone_number}${account.verified_name ? ` — ${account.verified_name}` : ''}.`
        : 'Connection checked.';
      await refresh();
    } catch (e) {
      fail(e, 'The connection could not be verified.');
    } finally {
      busy = '';
    }
  };

  const disconnect = async () => {
    confirmDisconnect = false;
    error = '';
    notice = '';
    busy = 'disconnect';
    try {
      await api.whatsapp.disconnect();
      notice = 'Disconnected.';
      await refresh();
    } catch (e) {
      fail(e, 'Could not disconnect.');
    } finally {
      busy = '';
    }
  };

  $: account = connection?.account ?? null;
  $: signupReady = Boolean(connection?.embedded_signup?.ready);
  $: canStore = connection?.can_store_secrets !== false;
  $: onEnvFallback = connection?.using_env_fallback === true;
  $: when = (value: unknown) =>
    value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value))) : '';
</script>

<article class="rounded-xl border border-ink/10 bg-surface p-5 shadow-card">
  <div class="flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest/10 text-forest ring-1 ring-ink/5 dark:text-goldfinch-gold">
      <MessageCircle size={19} />
    </span>
    <div class="min-w-0 flex-1">
      <p class="font-bold text-ink">Your WhatsApp Business account</p>
      <p class="mt-0.5 text-sm text-ink/55">
        Connect your own account and messages to travellers will come from your number instead of ours.
      </p>

      {#if connection?.connected && account}
        <div class="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <p class="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={16} /> {account.display_phone_number ?? 'Connected'}
          </p>
          <dl class="mt-2 grid gap-1 text-xs text-ink/60">
            {#if account.verified_name}<div class="flex gap-2"><dt class="shrink-0">Business</dt><dd class="min-w-0 break-words font-semibold text-ink">{account.verified_name}</dd></div>{/if}
            <div class="flex gap-2"><dt class="shrink-0">Connected</dt><dd class="font-semibold text-ink">{when(account.connected_at)} · {account.token_source === 'embedded_signup' ? 'via Meta' : 'entered manually'}</dd></div>
            {#if account.last_verified_at}<div class="flex gap-2"><dt class="shrink-0">Last checked</dt><dd class="font-semibold text-ink">{when(account.last_verified_at)}</dd></div>{/if}
          </dl>
          <div class="mt-3 flex flex-wrap gap-2">
            <AdminButton variant="secondary" size="sm" type="button" disabled={Boolean(busy)} on:click={test}>
              {busy === 'test' ? 'Checking…' : 'Test connection'}
            </AdminButton>
            <AdminButton variant="ghost" size="sm" type="button" disabled={Boolean(busy)} on:click={() => (confirmDisconnect = true)}>
              <Unlink size={14} /> Disconnect
            </AdminButton>
          </div>
        </div>
      {:else}
        {#if onEnvFallback}
          <p class="mt-3 rounded-xl border border-goldfinch-gold/35 bg-goldfinch-gold/[0.08] px-3 py-2 text-xs leading-5 text-ink/70">
            Currently sending from the number configured on the server. Connecting your own account replaces it.
          </p>
        {/if}

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <span class="inline-flex" title={signupReady ? undefined : 'Meta sign-up is not configured on this server yet.'}>
            <AdminButton type="button" disabled={!signupReady || !canStore || Boolean(busy)} on:click={connectWithMeta}>
              {#if busy === 'signup'}<Loader2 size={15} class="animate-spin" /> Waiting for Meta…{:else}<Link2 size={15} /> Connect WhatsApp{/if}
            </AdminButton>
          </span>
          <CmsButton variant="ghost"
            type="button"
            class="text-xs font-semibold text-ink/50 underline underline-offset-4 transition hover:text-ink"
            onclick={() => (showManual = !showManual)}
          >
            {showManual ? 'Hide manual entry' : 'Enter credentials manually'}
          </CmsButton>
        </div>

        {#if !signupReady}
          <p class="mt-2 text-xs leading-5 text-ink/50">
            Meta’s one-click sign-up needs Tech Provider status and App Review, which are not granted yet. Until then,
            manual entry is the way to connect an account — it stores exactly the same thing.
          </p>
        {/if}

        {#if showManual}
          <form class="mt-4 grid gap-3 rounded-xl border border-ink/10 bg-black/[0.02] p-4" on:submit|preventDefault={connectManually}>
            <CmsLabel class="grid gap-1">
              <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">WhatsApp Business Account ID</span>
              <CmsInput class="h-10 rounded-md border border-ink/15 bg-surface px-3 text-sm outline-none focus:border-forest" bind:value={manual.waba_id} autocomplete="off" required />
            </CmsLabel>
            <CmsLabel class="grid gap-1">
              <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">Phone number ID</span>
              <CmsInput class="h-10 rounded-md border border-ink/15 bg-surface px-3 text-sm outline-none focus:border-forest" bind:value={manual.phone_number_id} autocomplete="off" required />
            </CmsLabel>
            <CmsLabel class="grid gap-1">
              <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">Permanent access token</span>
              <CmsInput type="password" class="h-10 rounded-md border border-ink/15 bg-surface px-3 text-sm outline-none focus:border-forest" bind:value={manual.access_token} autocomplete="off" required />
              <span class="text-[11px] text-ink/45">Verified with Meta before it is stored, then encrypted. It is never shown again.</span>
            </CmsLabel>
            <div>
              <AdminButton type="submit" size="sm" disabled={!canStore || Boolean(busy)}>
                {busy === 'manual' ? 'Verifying with Meta…' : 'Connect'}
              </AdminButton>
            </div>
          </form>
        {/if}
      {/if}

      {#if !canStore}
        <p class="mt-3 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/[0.08] px-3 py-2 text-xs leading-5 text-clay">
          <AlertTriangle size={14} class="mt-0.5 shrink-0" />
          <span>Credentials cannot be stored until <code class="font-semibold">CREDENTIALS_ENCRYPTION_KEY</code> is set on the server. Nothing will be saved unencrypted.</span>
        </p>
      {/if}

      {#if error}
        <p class="mt-3 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/[0.08] px-3 py-2 text-xs leading-5 text-clay" role="alert">
          <AlertTriangle size={14} class="mt-0.5 shrink-0" /><span>{error}</span>
        </p>
      {:else if notice}
        <p class="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-xs leading-5 text-emerald-700">{notice}</p>
      {/if}
    </div>
  </div>
</article>

<ConfirmModal
  open={confirmDisconnect}
  title="Disconnect WhatsApp?"
  message="Messages will stop sending from this number. Travellers already in a conversation will not hear back until an account is connected again."
  on:confirm={disconnect}
  on:cancel={() => (confirmDisconnect = false)}
/>
