<script lang="ts">
  import { onMount } from 'svelte';
  import SafariPackageContent from '$lib/admin/components/public/SafariPackageContent.svelte';
  import type { ComponentProps } from 'svelte';
  let content: ComponentProps<SafariPackageContent> | null = null;

  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'package-preview') return;
      if (event.data.payload?.record && Array.isArray(event.data.payload.record.sections)) content = event.data.payload;
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'package-preview-ready' }, location.origin);
    return () => window.removeEventListener('message', receive);
  });

  // Capture before form handlers run. Visitors can inspect tabs and itineraries,
  // but cannot send an enquiry or leave the draft through a link.
  const previewOnly = (node: HTMLElement) => {
    const prevent = (event: Event) => {
      const target = event.target as HTMLElement;
      if (event.type === 'submit' || target.closest('a, button[type="submit"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const href = target.closest('a')?.getAttribute('href');
        if (href?.startsWith('#')) document.getElementById(href.slice(1))?.scrollIntoView();
      }
    };
    node.addEventListener('click', prevent, true);
    node.addEventListener('submit', prevent, true);
    return { destroy() { node.removeEventListener('click', prevent, true); node.removeEventListener('submit', prevent, true); } };
  };
</script>

<svelte:head><title>Package preview · Key2africa CMS</title><meta name="robots" content="noindex, nofollow" /></svelte:head>
<div use:previewOnly style="--nav-h: 0px">
  {#if content}<SafariPackageContent {...content} preview />{:else}<p class="p-8 text-sm text-ink/55">Open Preview from the safari package editor to see your draft.</p>{/if}
</div>
