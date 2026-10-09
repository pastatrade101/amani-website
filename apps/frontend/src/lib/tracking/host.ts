/**
 * Only the live site records analytics or loads Google tags. The local dev
 * server and previews talk to the production database, so their visits would
 * otherwise be counted as real traffic and leads.
 */
const NOT_TRAFFIC_HOST = /^(localhost|0\.0\.0\.0|\[[0-9a-f:.]+\]|\d{1,3}(\.\d{1,3}){3})$|\.(localhost|local|test|internal|lan)$/i;

/** A real domain on the standard port: not localhost and its kin, a raw IP, or any explicit port. */
export const isProdHostname = (hostname: string, port = '') => !port && Boolean(hostname) && !NOT_TRAFFIC_HOST.test(hostname);

export const isProdHost = () => typeof window !== 'undefined' && isProdHostname(window.location.hostname, window.location.port);

/** Staff in the CMS are not visitors. */
export const isAdminPath = (path: string) => /^\/admin(\/|$)/.test(path);

/**
 * `localStorage.k2a_analytics_debug = '1'` prints every event to the console
 * on any host. A non-production host still sends nothing.
 */
export const debugOn = () => {
	try {
		return typeof window !== 'undefined' && localStorage.getItem('k2a_analytics_debug') === '1';
	} catch {
		return false;
	}
};
