import { apiGet } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

export type Branding = { logo_url?: string | null; favicon_url?: string | null };

/** CMS branding (Settings → branding). An empty or unreachable API keeps the built-in mark and favicon. */
export const load: LayoutServerLoad = async ({ fetch }) => {
	const branding = await apiGet<Branding>('branding', fetch).catch(() => ({}) as Branding);
	return { branding };
};
