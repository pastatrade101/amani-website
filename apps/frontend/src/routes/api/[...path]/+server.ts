import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = async ({ request, params, url, getClientAddress }) => {
  const base = new URL((env.API_BASE_URL || 'http://127.0.0.1:5000/api').replace(/\/+$/, '') + '/');
  const target = new URL(`${params.path || ''}${url.search}`, base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
    return new Response('Invalid API path.', { status: 400 });
  }
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'authorization']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-for', getClientAddress());
  const init: RequestInit = { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(60000) };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();
  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(request.method === 'HEAD' || upstream.status === 204 ? null : upstream.body, {
      status: upstream.status, headers: responseHeaders
    });
  } catch {
    return Response.json({ success: false, message: 'The backend is unavailable. Please try again.' }, { status: 502 });
  }
};
export const fallback = proxy;
