import { env } from '$env/dynamic/private';

type ApiResponse<T> = { success: boolean; message: string; data: T };
export class ApiError extends Error {
	constructor(public status: number) { super(`API request failed (${status}).`); }
}

/** Private API address and credentials never become browser environment variables. */
export async function apiRequest<T>(path: string, fetcher: typeof fetch, init: RequestInit = {}): Promise<T> {
	const baseUrl = (env.API_BASE_URL || 'http://127.0.0.1:5000/api').replace(/\/+$/, '');
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	// GETs wait up to 6s: an uncached tour or stay page makes several database
	// round trips, and at 3s those pages fell over into the error page.
	const response = await fetcher(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
		...init, headers, signal: AbortSignal.timeout(init.method === 'POST' ? 10000 : 6000), cache: 'no-store'
	});
	if (!response.ok) throw new ApiError(response.status);
	const payload: ApiResponse<T> = await response.json();
	if (!payload.success || payload.data == null) throw new Error('Unexpected API response.');
	return payload.data;
}
export const apiGet = <T>(path: string, fetcher: typeof fetch) => apiRequest<T>(path, fetcher);
