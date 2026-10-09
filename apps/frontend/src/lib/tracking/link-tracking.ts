import { trackEvent } from '$lib/admin/analytics';
import { rememberCta } from './attribution';
import { isAdminPath } from './host';
import { PLANNER_PATH } from '$lib/planner/plan-href';

const WHATSAPP = /^(https?:\/\/(wa\.me|[a-z]+\.whatsapp\.com)\/|whatsapp:)/i;

/** Where a link sits: its data-cta-location, else the page landmark it is in. */
const placeOf = (link: HTMLAnchorElement) =>
	link.closest<HTMLElement>('[data-cta-location]')?.dataset.ctaLocation ||
	(link.closest('header') ? 'header' : link.closest('footer') ? 'footer' : link.closest('nav') ? 'navigation' : 'page_content');

/**
 * One delegated listener for every tracked link on the public site, so new
 * buttons and links in CMS content are counted without code of their own:
 *  - calls to action: [data-cta], and every link to the planner (its `from` is the location);
 *  - WhatsApp (wa.me, *.whatsapp.com, whatsapp:), tel: and mailto: links.
 * Only names, places and paths are sent; never the number or address itself.
 * Capture phase, so a handler that stops the click cannot hide it.
 */
export function installLinkTracking(): () => void {
	if (typeof document === 'undefined') return () => {};
	const onClick = (event: MouseEvent) => {
		// A middle-click opens the link in a new tab and arrives as auxclick; other buttons open nothing.
		if (event.type === 'auxclick' && event.button !== 1) return;
		if (isAdminPath(window.location.pathname)) return;
		const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
		if (!link) return;
		const href = link.getAttribute('href') ?? '';
		if (WHATSAPP.test(href)) {
			trackEvent('whatsapp_click', { lead_type: 'whatsapp', cta_type: 'whatsapp', cta_location: placeOf(link), method: /^whatsapp:/i.test(href) ? 'app' : new URL(href, window.location.href).hostname.replace(/^www\./, '') });
			return;
		}
		if (/^tel:/i.test(href)) return trackEvent('phone_click', { cta_type: 'phone', cta_location: placeOf(link), method: 'tel' });
		if (/^mailto:/i.test(href)) return trackEvent('email_click', { cta_type: 'email', cta_location: placeOf(link), method: 'mailto' });
		let url: URL;
		try {
			url = new URL(href, window.location.href);
		} catch {
			return;
		}
		const toPlanner = url.origin === window.location.origin && url.pathname === PLANNER_PATH;
		const name = link.dataset.cta || (toPlanner ? 'plan_my_trip' : '');
		if (!name) return;
		const location = (link.dataset.ctaLocation || (toPlanner ? url.searchParams.get('from') : '') || placeOf(link)).replace(/[^\w-]/g, '').slice(0, 40);
		rememberCta(`${location}:${name}`);
		trackEvent('cta_click', { cta_name: name, cta_location: location, cta_type: link.dataset.slot === 'button' ? 'button' : 'link', link_url: url.origin === window.location.origin ? url.pathname : url.hostname });
	};
	document.addEventListener('click', onClick, true);
	document.addEventListener('auxclick', onClick, true);
	return () => {
		document.removeEventListener('click', onClick, true);
		document.removeEventListener('auxclick', onClick, true);
	};
}
