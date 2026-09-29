import { browser } from '$app/environment';

// ----------------------------------------------------------------------------
// Microsoft Clarity — UX analytics companion to GA4 (session recordings,
// heatmaps, rage/dead clicks, scroll behaviour). It does NOT replace GA4.
//
// Design (mirrors how GA4/gtag is loaded, so there is no extra npm dependency):
//   • Browser-only, never during SSR.
//   • Loads at most once per page lifecycle (`loaded` flag + DOM guard).
//   • The caller (layout) only invokes this after consent === 'granted', on a
//     production host, with PUBLIC_CLARITY_PROJECT_ID set.
//   • Clarity masks every input value by default and auto-tracks SPA route
//     changes, so no per-navigation call and no manual page tracking is needed
//     (that keeps it from double-counting alongside GA4's page_view).
// ----------------------------------------------------------------------------

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

let loaded = false;

/** Inject the official Clarity async snippet once. Safe to call repeatedly. */
export function loadClarity(projectId?: string): void {
  if (!browser || loaded || !projectId) return;
  if (document.getElementById('clarity-src')) {
    loaded = true;
    return;
  }
  loaded = true;
  try {
    const w = window as unknown as { clarity?: ClarityFn };
    if (typeof w.clarity !== 'function') {
      const fn = ((...args: unknown[]) => {
        (fn.q = fn.q || []).push(args);
      }) as ClarityFn;
      w.clarity = fn;
    }
    const s = document.createElement('script');
    s.async = true;
    s.id = 'clarity-src';
    s.src = `https://www.clarity.ms/tag/${projectId}`;
    const first = document.getElementsByTagName('script')[0];
    (first?.parentNode ?? document.head).insertBefore(s, first ?? null);
  } catch {
    loaded = false; // allow a later retry if injection somehow threw
  }
}

/** True once the Clarity runtime is available on the page. */
export function clarityReady(): boolean {
  return browser && typeof (window as unknown as { clarity?: unknown }).clarity === 'function';
}

/**
 * The console URL for a Clarity project — used by the admin "Open Microsoft
 * Clarity" launch button. Falls back to the Clarity home when no id is known.
 */
export function clarityDashboardUrl(projectId?: string): string {
  return projectId
    ? `https://clarity.microsoft.com/projects/view/${projectId}/dashboard`
    : 'https://clarity.microsoft.com/';
}
