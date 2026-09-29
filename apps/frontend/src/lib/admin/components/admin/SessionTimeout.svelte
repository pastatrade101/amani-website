<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { Clock } from '@lucide/svelte';

  // Auto sign-out after inactivity, with a warning countdown first.
  export let timeoutMs = 20 * 60 * 1000; // total inactivity before logout (20 min)
  export let warningMs = 2 * 60 * 1000; //  show the warning this long before (2 min)
  export let onTimeout: () => void; //      called when the countdown reaches zero

  let warning = false;
  let remaining = 0; // seconds left, shown in the modal
  let idleTimer: ReturnType<typeof setTimeout>;
  let warnTimer: ReturnType<typeof setTimeout>;
  let countdown: ReturnType<typeof setInterval>;
  let lastActivity = 0;

  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  const clearAll = () => {
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);
    clearInterval(countdown);
  };

  const start = () => {
    clearAll();
    warning = false;
    warnTimer = setTimeout(showWarning, Math.max(0, timeoutMs - warningMs));
    idleTimer = setTimeout(() => onTimeout(), timeoutMs);
  };

  const showWarning = () => {
    warning = true;
    remaining = Math.round(warningMs / 1000);
    countdown = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) clearInterval(countdown);
    }, 1000);
  };

  // Any activity resets the timer — but once the warning is up the admin must
  // explicitly choose, so a stray mouse nudge can't silently keep the session.
  const onActivity = () => {
    if (warning) return;
    const now = Date.now();
    if (now - lastActivity < 1000) return; // throttle
    lastActivity = now;
    start();
  };

  const stay = () => start();

  onMount(() => {
    if (!browser) return;
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    start();
  });
  onDestroy(() => {
    if (!browser) return; // onDestroy can run during SSR — guard window access
    EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    clearAll();
  });

  // Render on <body> so the admin shell's layout/transforms can't clip the modal.
  const portal = (node: HTMLElement) => {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  };

  $: mins = Math.floor(Math.max(0, remaining) / 60);
  $: secs = String(Math.max(0, remaining) % 60).padStart(2, '0');
</script>

<AlertDialog.Root open={warning}>
  <AlertDialog.Content>
    <div class="flex size-12 items-center justify-center rounded-xl bg-sun/20 text-primary"><Clock size={22}/></div>
    <AlertDialog.Header><AlertDialog.Title>Are you still there?</AlertDialog.Title><AlertDialog.Description>For your security, your session will end after inactivity.</AlertDialog.Description></AlertDialog.Header>
    <p class="text-4xl font-semibold tabular-nums text-primary" role="timer">{mins}:{secs}</p>
    <AlertDialog.Footer><CmsButton variant="outline" onclick={onTimeout}>Sign out</CmsButton><CmsButton onclick={stay}>Stay signed in</CmsButton></AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
