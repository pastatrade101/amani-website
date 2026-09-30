import { browser } from '$app/environment';
import { API_URL } from '$lib/admin/config/env';
import type { EntityTranslations, Language, TranslationRecord } from '$lib/admin/types';
import type { LegalDefaults } from '$lib/admin/legal';
import type { Activity, AdvisorDonePayload, AdvisorMeta, AdvisorPageContext, AdvisorRecommendation, AiChatResponse, ApiResponse, BlogPost, Comparison, CurrencyApiState, Destination, FAQ, Lodge, MigrationEntry, PageSeo, Paginated, Review, ReviewSummary, SafariPackage, SafetyTopic, Specialist, Testimonial, Tour, TourCategory, TourContentBody, TravelStyle, TripPoint } from '$lib/admin/types';

type QueryValue = string | number | boolean | undefined | null;
type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown>;
};

export type ApiFieldError = { path?: Array<string | number>; message?: string; code?: string };
export class ApiRequestError extends Error {
  status: number;
  errors: ApiFieldError[];
  constructor(message: string, status: number, errors: unknown[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = errors.filter((item): item is ApiFieldError => Boolean(item && typeof item === 'object'));
  }
}

const authToken = () => {
  if (!browser) return null;
  return localStorage.getItem('admin_token');
};

const queryString = (params: Record<string, QueryValue> = {}) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
};

// Client-only, short-lived cache for ANONYMOUS GETs so repeat / back-forward
// navigation renders instantly from memory instead of re-fetching the DB. It
// never caches authenticated (admin) requests, and any write clears it, so a
// visitor never sees stale content beyond the TTL and admin stays always-fresh.
type CacheEntry = { at: number; result: unknown };
const getCache = new Map<string, CacheEntry>();
const GET_TTL = 5 * 60 * 1000; // 5 minutes

export const apiRequest = async <T>(path: string, options: RequestOptions = {}) => {
  const token = authToken();
  const method = (options.method ?? 'GET').toUpperCase();
  const cacheable = browser && !token && method === 'GET' && path !== '/currencies';

  if (cacheable) {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.at < GET_TTL) return hit.result as ApiResponse<T>;
  }

  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (!isFormData) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const requestBody: BodyInit | undefined = isFormData
    ? (options.body as BodyInit)
    : options.body
      ? JSON.stringify(options.body)
      : undefined;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: requestBody,
    credentials: 'include' // carry the AI advisor session cookie (§6)
  });

  const result = (await response.json().catch(() => ({
    success: false,
    message: 'Unexpected API response.',
    data: null
  }))) as ApiResponse<T>;

  if (!response.ok || !result.success) {
    throw new ApiRequestError(result.message || 'API request failed.', response.status, result.errors ?? []);
  }

  if (cacheable) getCache.set(path, { at: Date.now(), result });
  // A write may have changed listings — drop the anonymous cache so the next read is fresh.
  if (browser && method !== 'GET') getCache.clear();

  return result;
};

// ── Key2africa Travel Advisor — SSE streaming (§3.5) ───────────────────────
export type AdvisorStreamBody = {
  conversationId?: string;
  message: string;
  lead?: Record<string, unknown>;
  page_context?: AdvisorPageContext;
  shortlist?: string[];
  turnstile_token?: string;
  idempotency_key?: string;
};

export type AdvisorStreamHandlers = {
  onMeta?: (meta: AdvisorMeta) => void;
  onRecommendations?: (recs: AdvisorRecommendation[]) => void;
  onDelta?: (text: string) => void;
  onDone?: (payload: AdvisorDonePayload) => void;
  onError?: (message: string) => void;
};

/**
 * Stream a chat reply over SSE. Falls back to a friendly error via onError if
 * the endpoint is unavailable (budget/rate/AI failure) — never throws to the UI.
 */
export const streamAdvisorChat = async (body: AdvisorStreamBody, handlers: AdvisorStreamHandlers): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
  } catch {
    handlers.onError?.('I could not reach the planning engine. Please try again, or continue on WhatsApp.');
    return;
  }

  if (!response.ok || !response.body) {
    let message = 'The assistant is unavailable right now.';
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // keep default
    }
    handlers.onError?.(message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (rawEvent: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'meta') handlers.onMeta?.(payload as AdvisorMeta);
    else if (event === 'recommendations') handlers.onRecommendations?.(payload as AdvisorRecommendation[]);
    else if (event === 'delta') handlers.onDelta?.((payload as { text: string }).text ?? '');
    else if (event === 'done') handlers.onDone?.(payload as AdvisorDonePayload);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) if (block.trim()) dispatch(block);
  }
  if (buffer.trim()) dispatch(buffer);
};

export const api = {
  health: () => apiRequest('/health'),
  currencies: {
    get: () => apiRequest<CurrencyApiState>('/currencies')
  },
  auth: {
    login: (body: { email: string; password: string }) =>
      apiRequest<{ token: string; user: { name: string; email: string; role: string }; expiresIn: string }>('/auth/login', {
        method: 'POST',
        body
      }),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    me: () => apiRequest('/auth/me')
  },
  users: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/users${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/users/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/users', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/users/${id}`, { method: 'PUT', body }),
    updateStatus: (id: string, body: Record<string, unknown>) => apiRequest(`/users/${id}/status`, { method: 'PUT', body }),
    updatePassword: (id: string, body: Record<string, unknown>) => apiRequest(`/users/${id}/password`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/users/${id}`, { method: 'DELETE' })
  },
  roles: {
    list: () => apiRequest<Array<{ role: string; permissions: string[] }>>('/roles'),
    permissions: () => apiRequest<string[]>('/roles/permissions'),
    updatePermissions: (role: string, permissions: string[]) =>
      apiRequest(`/roles/${role}/permissions`, { method: 'PUT', body: { permissions } })
  },
  tours: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Tour>>(`/tours${queryString(params)}`),
    get: (slug: string, params?: Record<string, QueryValue>) => apiRequest<Tour>(`/tours/${slug}${queryString(params)}`),
    create: (body: Record<string, unknown>) => apiRequest<Tour>('/tours', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Tour>(`/tours/${id}`, { method: 'PUT', body }),
    /**
     * Days, inclusions, exclusions, gallery and activities in one request; each
     * key sent replaces that collection. Returns the full staff record, so the
     * editor picks up the ids of anything new.
     */
    saveContent: (id: string, body: TourContentBody) =>
      apiRequest<Tour>(`/tours/${id}/content`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/tours/${id}`, { method: 'DELETE' }),
    bulkRemove: (ids: string[]) =>
      apiRequest<{ deleted: number; ids: string[] }>('/tours/bulk-delete', { method: 'POST', body: { ids } }),
    importCsv: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest<{
        summary: { total: number; created: number; updated: number; failed: number };
        results: Array<{
          line: number;
          status: 'ok' | 'error';
          action?: 'created' | 'updated';
          title?: string;
          slug?: string;
          days?: number;
          inclusions?: number;
          exclusions?: number;
          price_options?: number;
          warnings?: string[];
          error?: string;
        }>;
      }>('/itinerary-import', { method: 'POST', body: formData });
    }
  },
  departures: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>[]>(`/departures${queryString(params)}`)
  },
  itineraries: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/itineraries${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/itineraries`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/itineraries/${id}`),
    create: (body: Record<string, unknown>) => apiRequest<Record<string, unknown>>('/itineraries', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/itineraries/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/itineraries/${id}`, { method: 'DELETE' })
  },
  availableDates: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/available-dates${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/available-dates`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/available-dates/${id}`),
    create: (body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>('/available-dates', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/available-dates/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/available-dates/${id}`, { method: 'DELETE' })
  },
  pricingOptions: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/pricing-options${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/pricing-options`),
    seasons: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/pricing-options/seasons/${tourId}`),
    saveSeasons: (tourId: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>[]>(`/pricing-options/seasons/${tourId}`, { method: 'PUT', body }),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/pricing-options/${id}`),
    create: (body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>('/pricing-options', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/pricing-options/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/pricing-options/${id}`, { method: 'DELETE' })
  },
  tourInclusions: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/tour-inclusions${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/inclusions`),
    create: (body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>('/tour-inclusions', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/tour-inclusions/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/tour-inclusions/${id}`, { method: 'DELETE' })
  },
  tourExclusions: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/tour-exclusions${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/exclusions`),
    create: (body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>('/tour-exclusions', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/tour-exclusions/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/tour-exclusions/${id}`, { method: 'DELETE' })
  },
  tourImages: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/tour-images${queryString(params)}`),
    byTour: (tourId: string) => apiRequest<Record<string, unknown>[]>(`/tours/${tourId}/images`),
    create: (body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>('/tour-images', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/tour-images/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/tour-images/${id}`, { method: 'DELETE' })
  },
  destinations: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Destination>>(`/destinations${queryString(params)}`),
    get: (slug: string, params?: Record<string, QueryValue>) => apiRequest<Destination>(`/destinations/${slug}${queryString(params)}`),
    create: (body: Record<string, unknown>) => apiRequest<Destination>('/destinations', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Destination>(`/destinations/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/destinations/${id}`, { method: 'DELETE' })
  },
  lodges: {
    accommodationMeta: () => apiRequest<{ experiences: Record<string, unknown>[]; suppliers: Record<string, unknown>[] }>('/lodges/meta/accommodation'),
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Lodge>>(`/lodges${queryString(params)}`),
    get: (slug: string) => apiRequest<Lodge>(`/lodges/${slug}`),
    gallery: (id: string) => apiRequest<{ images: Record<string, unknown>[] }>(`/lodges/${id}/gallery`),
    bulkRemove: (ids: string[]) =>
      apiRequest<{ deleted: number; ids: string[] }>('/lodges/bulk-delete', { method: 'POST', body: { ids } }),
    bulkStatus: (ids: string[], status: string) =>
      apiRequest<{ updated: number; ids: string[] }>('/lodges/bulk-status', { method: 'POST', body: { ids, status } }),
    create: (body: Record<string, unknown>) => apiRequest<Lodge>('/lodges', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Lodge>(`/lodges/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/lodges/${id}`, { method: 'DELETE' }),
    // Gallery and amenities are saved as whole sets, so one call each covers
    // upload, reorder, cover, edit and delete without a half-saved state.
    media: (id: string) =>
      apiRequest<{ images: Record<string, unknown>[]; amenity_ids: string[]; amenities: Record<string, unknown>[] }>(
        `/lodges/${id}/media`
      ),
    details: (id: string) => apiRequest<Record<string, unknown>>(`/lodges/${id}/details`),
    saveDetails: (id: string, details: Record<string, unknown>) =>
      apiRequest<{ id: string }>(`/lodges/${id}/details`, { method: 'PUT', body: details }),
    saveImages: (id: string, images: Record<string, unknown>[]) =>
      apiRequest<{ count: number }>(`/lodges/${id}/images`, { method: 'PUT', body: { images } }),
    saveAmenities: (id: string, amenityIds: string[]) =>
      apiRequest<{ count: number }>(`/lodges/${id}/amenities`, { method: 'PUT', body: { amenity_ids: amenityIds } })
  },
  activities: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Activity>>(`/activities${queryString(params)}`),
    get: (slug: string) => apiRequest<Activity>(`/activities/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<Activity>('/activities', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Activity>(`/activities/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/activities/${id}`, { method: 'DELETE' })
  },
  tripPoints: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<TripPoint>>(`/trip-points${queryString(params)}`),
    get: (slug: string) => apiRequest<TripPoint>(`/trip-points/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<TripPoint>('/trip-points', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<TripPoint>(`/trip-points/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/trip-points/${id}`, { method: 'DELETE' })
  },
  safetyTopics: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<SafetyTopic>>(`/safety-topics${queryString(params)}`),
    get: (slug: string) => apiRequest<SafetyTopic>(`/safety-topics/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<SafetyTopic>('/safety-topics', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<SafetyTopic>(`/safety-topics/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/safety-topics/${id}`, { method: 'DELETE' })
  },
  travelStyles: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<TravelStyle>>(`/travel-styles${queryString(params)}`),
    get: (slug: string) => apiRequest<TravelStyle>(`/travel-styles/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<TravelStyle>('/travel-styles', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<TravelStyle>(`/travel-styles/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/travel-styles/${id}`, { method: 'DELETE' })
  },
  safariPackages: {
    list: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<SafariPackage>>(`/safari-packages${queryString(params)}`),
    /**
     * The FULL record, with the linked tour and its days. The edit form must
     * load through this and never from `list` — the list projection omits
     * `sections`, and a form seeded from it would save the page back empty.
     */
    get: (slug: string) => apiRequest<SafariPackage>(`/safari-packages/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<SafariPackage>('/safari-packages', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      apiRequest<SafariPackage>(`/safari-packages/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/safari-packages/${id}`, { method: 'DELETE' })
  },
  comparisons: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Comparison>>(`/comparisons${queryString(params)}`),
    get: (slug: string) => apiRequest<Comparison>(`/comparisons/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<Comparison>('/comparisons', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Comparison>(`/comparisons/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/comparisons/${id}`, { method: 'DELETE' })
  },
  quotations: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>[]>(`/quotations${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/quotations/${id}`),
    create: (body: Record<string, unknown>) => apiRequest<Record<string, unknown>>('/quotations', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<Record<string, unknown>>(`/quotations/${id}`, { method: 'PUT', body }),
    send: (id: string, body: Record<string, unknown> = {}) => apiRequest<Record<string, unknown>>(`/quotations/${id}/send`, { method: 'POST', body }),
    /** Produce the next version. Archives the current one first. */
    revise: (id: string, body: Record<string, unknown> = {}) =>
      apiRequest<Record<string, unknown>>(`/quotations/${id}/revise`, { method: 'POST', body }),
    // A reason is required by the API, not optional here: forcing a status puts
    // words in the traveller's mouth, and the record has to say who did it.
    setStatus: (id: string, status: string, reason: string) =>
      apiRequest<Record<string, unknown>>(`/quotations/${id}/status`, { method: 'PATCH', body: { status, reason } }),
    thread: (id: string) =>
      apiRequest<{ revision: number; comments: Record<string, unknown>[]; revisions: Record<string, unknown>[] }>(
        `/quotations/${id}/thread`
      ),
    comment: (id: string, body: string) =>
      apiRequest<Record<string, unknown>>(`/quotations/${id}/comments`, { method: 'POST', body: { body } }),
    resolveComment: (id: string, commentId: string) =>
      apiRequest<Record<string, unknown>>(`/quotations/${id}/comments/${commentId}/resolve`, { method: 'PATCH' }),
    remove: (id: string) => apiRequest(`/quotations/${id}`, { method: 'DELETE' })
  },
  whatsapp: {
    status: () => apiRequest<Record<string, unknown>>('/whatsapp/status'),
    /** Approved templates only — the registry decides, so a new one needs no deploy. */
    templates: () => apiRequest<Record<string, unknown>[]>('/whatsapp/templates'),
    conversations: (params?: Record<string, QueryValue>) =>
      apiRequest<Record<string, unknown>[]>(`/whatsapp/conversations${queryString(params)}`),
    conversation: (id: string) => apiRequest<Record<string, unknown>>(`/whatsapp/conversations/${id}`),
    send: (body: Record<string, unknown>) => apiRequest<Record<string, unknown>>('/whatsapp/send', { method: 'POST', body }),
    markRead: (id: string) => apiRequest(`/whatsapp/conversations/${id}/read`, { method: 'POST', body: {} }),
    updateState: (id: string, body: Record<string, unknown>) =>
      apiRequest<Record<string, unknown>>(`/whatsapp/conversations/${id}`, { method: 'PATCH', body }),
    addNote: (id: string, body: string) =>
      apiRequest<Record<string, unknown>>(`/whatsapp/conversations/${id}/notes`, { method: 'POST', body: { body } }),
    agents: () => apiRequest<Array<{ id: string; full_name: string; email: string }>>('/whatsapp/agents'),

    /**
     * Which WhatsApp account this site sends from. The access token is never in
     * any of these responses — the server holds it sealed and only ever sends
     * back what a human needs to recognise the connection.
     */
    connection: () => apiRequest<Record<string, any>>('/whatsapp/connection'),
    connect: (body: { code: string; waba_id: string; phone_number_id: string }) =>
      apiRequest<Record<string, any>>('/whatsapp/connect', { method: 'POST', body }),
    connectManual: (body: { waba_id: string; phone_number_id: string; access_token: string }) =>
      apiRequest<Record<string, any>>('/whatsapp/connect/manual', { method: 'POST', body }),
    disconnect: () => apiRequest<Record<string, any>>('/whatsapp/disconnect', { method: 'POST', body: {} }),
    testConnection: () => apiRequest<Record<string, any>>('/whatsapp/connection/test', { method: 'POST', body: {} })
  },
  translations: {
    languages: (params?: Record<string, QueryValue>) => apiRequest<Language[]>(`/translations/languages${queryString(params)}`),
    updateLanguage: (code: string, body: Record<string, unknown>) =>
      apiRequest<Language>(`/translations/languages/${code}`, { method: 'PATCH', body }),
    forEntity: (entityType: string, entityId: string) =>
      apiRequest<EntityTranslations>(`/translations/${entityType}/${entityId}`),
    save: (entityType: string, entityId: string, code: string, body: Record<string, unknown>) =>
      apiRequest<TranslationRecord>(`/translations/${entityType}/${entityId}/${code}`, { method: 'PUT', body }),
    copyFromDefault: (entityType: string, entityId: string, code: string) =>
      apiRequest<TranslationRecord>(`/translations/${entityType}/${entityId}/${code}/copy-from-default`, { method: 'POST', body: {} }),
    aiTranslate: (entityType: string, entityId: string, code: string, body: Record<string, unknown> = {}) =>
      apiRequest<TranslationRecord | null>(`/translations/${entityType}/${entityId}/${code}/ai`, { method: 'POST', body })
  },
  categories: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<TourCategory>>(`/categories${queryString(params)}`),
    get: (slug: string) => apiRequest<TourCategory>(`/categories/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest('/categories', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/categories/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/categories/${id}`, { method: 'DELETE' })
  },
  bookings: {
    create: (body: Record<string, unknown>) => apiRequest<Record<string, unknown>>('/bookings', { method: 'POST', body }),
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/bookings${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/bookings/${id}`),
    getByCode: (code: string) => apiRequest<Record<string, unknown>>(`/bookings/code/${code}`),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/bookings/${id}`, { method: 'PUT', body }),
    updateStatus: (id: string, body: Record<string, unknown>) =>
      apiRequest(`/bookings/${id}/status`, { method: 'PUT', body }),
    assign: (id: string, body: Record<string, unknown>) => apiRequest(`/bookings/${id}/assign`, { method: 'PUT', body }),
    updateNotes: (id: string, body: Record<string, unknown>) => apiRequest(`/bookings/${id}/notes`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/bookings/${id}`, { method: 'DELETE' }),

    /** What is owed, what has been asked for, and asking for more. */
    payment: {
      position: (bookingId: string) =>
        apiRequest<{
          currency: string;
          total: number | null;
          paid: number;
          outstanding: number | null;
          suggested_deposit: number | null;
          terms: string | null;
          requests: Record<string, unknown>[];
        }>(`/bookings/${bookingId}/payment-position`),
      request: (bookingId: string, body: Record<string, unknown>) =>
        apiRequest<Record<string, unknown>>(`/bookings/${bookingId}/payment-requests`, { method: 'POST', body }),
      cancelRequest: (bookingId: string, requestId: string) =>
        apiRequest<Record<string, unknown>>(`/bookings/${bookingId}/payment-requests/${requestId}/cancel`, {
          method: 'PATCH'
        })
    },

    /** Changes agreed after the quotation was accepted and frozen. */
    amendments: {
      list: (bookingId: string) =>
        apiRequest<{
          amendments: Record<string, unknown>[];
          currency: string;
          original_amount: number | null;
          applied_delta: number;
          revised_amount: number | null;
          open_count: number;
        }>(`/bookings/${bookingId}/amendments`),
      create: (bookingId: string, body: Record<string, unknown>) =>
        apiRequest<Record<string, unknown>>(`/bookings/${bookingId}/amendments`, { method: 'POST', body }),
      update: (bookingId: string, amendmentId: string, body: Record<string, unknown>) =>
        apiRequest<Record<string, unknown>>(`/bookings/${bookingId}/amendments/${amendmentId}`, { method: 'PATCH', body }),
      remove: (bookingId: string, amendmentId: string) =>
        apiRequest(`/bookings/${bookingId}/amendments/${amendmentId}`, { method: 'DELETE' })
    }
  },
  trip: {
    // Public magic-link portal (cookie session; apiRequest already sends credentials).
    session: (token: string) => apiRequest<Record<string, unknown>>('/trip/session', { method: 'POST', body: { token } }),
    me: () => apiRequest<Record<string, unknown>>('/trip/me'),
    message: (message: string) => apiRequest('/trip/message', { method: 'POST', body: { message } }),
    logout: () => apiRequest('/trip/logout', { method: 'POST' }),
    requestAccess: (email: string) => apiRequest('/trip/request-access', { method: 'POST', body: { email } }),
    // Admin: generate a secure link to share. send_email=true also emails it to the traveller.
    adminCreateLink: (booking_id: string, send_email = false) =>
      apiRequest<{ url: string; expiresAt: string; emailed?: boolean }>('/trip/admin/links', { method: 'POST', body: { booking_id, send_email } })
  },
  analytics: {
    overview: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/overview${queryString(params)}`),
    leads: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/leads${queryString(params)}`),
    funnel: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/funnel${queryString(params)}`),
    timeseries: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/timeseries${queryString(params)}`),
    traffic: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/traffic${queryString(params)}`),
    clarity: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/clarity${queryString(params)}`),
    intelligence: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/website-intelligence${queryString(params)}`),
    uxInsights: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/ux-insights${queryString(params)}`),
    sessions: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>>(`/analytics/sessions${queryString(params)}`),
    integrations: () => apiRequest<Record<string, unknown>>('/analytics/integrations')
  },
  imports: {
    entities: () =>
      apiRequest<{
        entities: Array<{ key: string; label: string; description: string; keys: string[]; headers: string[]; example: string[] }>;
      }>('/import/entities'),
    run: (entity: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest<{
        summary: { total: number; created: number; updated: number; failed: number };
        results: Array<{ line: number; status: 'ok' | 'error'; action?: 'created' | 'updated'; title?: string; slug?: string; warnings?: string[]; error?: string }>;
      }>(`/import/${entity}`, { method: 'POST', body: formData });
    },
    resetInfo: () => apiRequest<{ tables: string[] }>('/import/reset'),
    reset: (confirm: string) =>
      apiRequest<{ total: number; results: Array<{ table: string; deleted: number; error?: string }> }>('/import/reset', {
        method: 'POST',
        body: { confirm }
      })
  },
  payments: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/payments${queryString(params)}`),
    create: (body: Record<string, unknown>) => apiRequest('/payments', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/payments/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/payments/${id}`, { method: 'DELETE' })
  },
  blog: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<BlogPost>>(`/blog${queryString(params)}`),
    get: (slug: string) => apiRequest<BlogPost>(`/blog/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest<BlogPost>('/blog', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest<BlogPost>(`/blog/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/blog/${id}`, { method: 'DELETE' })
  },
  blogCategories: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/blog-categories${queryString(params)}`),
    get: (slug: string) => apiRequest<Record<string, unknown>>(`/blog-categories/${slug}`),
    create: (body: Record<string, unknown>) => apiRequest('/blog-categories', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/blog-categories/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/blog-categories/${id}`, { method: 'DELETE' })
  },
  gallery: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/gallery${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/gallery/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/gallery', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/gallery/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/gallery/${id}`, { method: 'DELETE' })
  },
  media: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/media${queryString(params)}`),
    create: (body: Record<string, unknown>) => apiRequest('/media', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/media/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/media/${id}`, { method: 'DELETE' })
  },
  // Homepage "When should you go?" — the month strip and season cards.
  seasons: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/seasons${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/seasons/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/seasons', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/seasons/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/seasons/${id}`, { method: 'DELETE' })
  },
  testimonials: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Testimonial>>(`/testimonials${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/testimonials/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/testimonials', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/testimonials/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/testimonials/${id}`, { method: 'DELETE' })
  },
  specialists: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Specialist>>(`/specialists${queryString(params)}`),
    get: (id: string) => apiRequest<Specialist>(`/specialists/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/specialists', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/specialists/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/specialists/${id}`, { method: 'DELETE' })
  },
  faqs: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<FAQ>>(`/faqs${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/faqs/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/faqs', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/faqs/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/faqs/${id}`, { method: 'DELETE' })
  },
  reviews: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Review>>(`/reviews${queryString(params)}`),
    summary: (params?: Record<string, QueryValue>) => apiRequest<ReviewSummary>(`/reviews/summary${queryString(params)}`),
    get: (id: string) => apiRequest<Review>(`/reviews/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/reviews', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/reviews/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/reviews/${id}`, { method: 'DELETE' })
  },
  migrationCalendar: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<MigrationEntry>>(`/migration-calendar${queryString(params)}`),
    get: (id: string) => apiRequest<MigrationEntry>(`/migration-calendar/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/migration-calendar', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/migration-calendar/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/migration-calendar/${id}`, { method: 'DELETE' })
  },
  redirects: {
    // Public resolver used by hooks.server.ts to turn a 404 into a 301/302.
    resolve: (path: string) => apiRequest<{ match: boolean; to_path?: string; status_code?: number }>(`/redirects/resolve${queryString({ path })}`),
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/redirects${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/redirects/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/redirects', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/redirects/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/redirects/${id}`, { method: 'DELETE' })
  },
  errors: {
    // Public ingest — a broken URL / 404 reported from the browser (aggregated server-side).
    report: (body: { url: string; error_type?: string; referrer?: string | null; error_message?: string | null }) =>
      apiRequest('/errors', { method: 'POST', body }),
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/errors${queryString(params)}`),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/errors/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/errors/${id}`, { method: 'DELETE' })
  },
  pageSeo: {
    // Public resolver used by the site to fetch a path's SEO override (or match:false).
    resolve: (path: string) => apiRequest<{ match: boolean; seo?: Record<string, unknown> }>(`/page-seo/resolve${queryString({ path })}`),
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<PageSeo>>(`/page-seo${queryString(params)}`),
    get: (id: string) => apiRequest<PageSeo>(`/page-seo/${id}`),
    create: (body: Record<string, unknown>) => apiRequest('/page-seo', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) => apiRequest(`/page-seo/${id}`, { method: 'PUT', body }),
    remove: (id: string) => apiRequest(`/page-seo/${id}`, { method: 'DELETE' })
  },
  homepage: {
    get: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>[]>(`/homepage${queryString(params)}`),
    update: (sections: Record<string, unknown>[]) => apiRequest('/homepage', { method: 'PUT', body: { sections } }),
    createSection: (body: Record<string, unknown>) => apiRequest('/homepage/sections', { method: 'POST', body }),
    updateSection: (id: string, body: Record<string, unknown>) => apiRequest(`/homepage/sections/${id}`, { method: 'PUT', body }),
    removeSection: (id: string) => apiRequest(`/homepage/sections/${id}`, { method: 'DELETE' })
  },
  contact: {
    create: (body: Record<string, unknown>) => apiRequest('/contact', { method: 'POST', body }),
    messages: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/contact/messages${queryString(params)}`),
    message: (id: string) => apiRequest<Record<string, unknown>>(`/contact/messages/${id}`),
    updateMessageStatus: (id: string, body: Record<string, unknown>) => apiRequest(`/contact/messages/${id}/status`, { method: 'PUT', body }),
    assignMessage: (id: string, body: Record<string, unknown>) => apiRequest(`/contact/messages/${id}/assign`, { method: 'PUT', body }),
    updateNotes: (id: string, body: Record<string, unknown>) => apiRequest(`/contact/messages/${id}/notes`, { method: 'PUT', body }),
    removeMessage: (id: string) => apiRequest(`/contact/messages/${id}`, { method: 'DELETE' })
  },
  upload: {
    image: (file: File, folder = 'uploads', metadata: { alt_text?: string; caption?: string } = {}) => {
      const formData = new FormData();
      formData.set('image', file);
      formData.set('folder', folder);
      if (metadata.alt_text !== undefined) formData.set('alt_text', metadata.alt_text);
      if (metadata.caption !== undefined) formData.set('caption', metadata.caption);
      return apiRequest<{ url: string; path: string }>('/upload/image', { method: 'POST', body: formData });
    },
    lottie: (file: File, folder = 'lottie') => {
      const formData = new FormData();
      formData.set('lottie', file);
      formData.set('folder', folder);
      return apiRequest<{ url: string; path: string }>('/upload/lottie', { method: 'POST', body: formData });
    }
  },
  dashboard: {
    stats: () => apiRequest<Record<string, unknown>>('/dashboard/stats')
  },
  settings: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Record<string, unknown>[]>(`/settings${queryString(params)}`),
    get: (key: string) => apiRequest<Record<string, unknown>>(`/settings/${key}`),
    byGroup: (group: string) => apiRequest<Record<string, unknown>[]>(`/settings/group/${group}`),
    create: (body: Record<string, unknown>) => apiRequest('/settings', { method: 'POST', body }),
    update: (key: string, body: Record<string, unknown>) => apiRequest(`/settings/${key}`, { method: 'PUT', body }),
    remove: (key: string) => apiRequest(`/settings/${key}`, { method: 'DELETE' }),
    public: () => apiRequest<Record<string, unknown>>('/public/settings'),
    /** Built-in wording and fixed id of each legal page (Settings → legal sections). */
    legalDefaults: () => apiRequest<LegalDefaults>('/settings/legal-defaults')
  },
  exchangeRates: {
    status: () => apiRequest<CurrencyApiState & Record<string, unknown>>('/internal/exchange-rates'),
    refresh: () => apiRequest<CurrencyApiState & Record<string, unknown>>('/internal/exchange-rates/refresh', { method: 'POST' })
  },
  branding: {
    get: () => apiRequest<Record<string, unknown>>('/branding'),
    update: (body: Record<string, unknown>) => apiRequest<Record<string, unknown>>('/branding', { method: 'PUT', body })
  },
  auditLogs: {
    list: (params?: Record<string, QueryValue>) => apiRequest<Paginated<Record<string, unknown>>>(`/audit-logs${queryString(params)}`),
    get: (id: string) => apiRequest<Record<string, unknown>>(`/audit-logs/${id}`),
    facets: () => apiRequest<{ entityTypes: string[]; actors: Array<{ id: string; name: string }> }>('/audit-logs/facets')
  },
  aiTravelAdvisor: {
    chat: (body: {
      conversationId?: string;
      message: string;
      lead?: Record<string, unknown>;
      page_context?: AdvisorPageContext;
      shortlist?: string[];
      turnstile_token?: string;
      idempotency_key?: string;
    }) => apiRequest<AiChatResponse>('/ai/chat', { method: 'POST', body }),
    createBookingRequest: (conversationId: string, body: { confirmed_by_user: true; idempotency_key: string }) =>
      apiRequest<{ booking_request_id?: string; status?: string; error?: string; missing?: string[] }>(
        `/ai/conversations/${conversationId}/create-booking-request`,
        { method: 'POST', body }
      ),
    conversations: (params?: Record<string, QueryValue>) =>
      apiRequest<Paginated<Record<string, unknown>>>(`/ai/conversations${queryString(params)}`),
    conversation: (id: string) => apiRequest<Record<string, unknown>>(`/ai/conversations/${id}`),
    handoff: (id: string, body: Record<string, unknown> = {}) =>
      apiRequest(`/ai/conversations/${id}/handoff`, { method: 'POST', body }),
    tourMatches: (conversationId: string) =>
      apiRequest<Array<Record<string, unknown>>>(`/ai/tour-matches/${conversationId}`),
    updateStatus: (id: string, body: { status?: string; lead_status?: string }) =>
      apiRequest<Record<string, unknown>>(`/ai/conversations/${id}/status`, { method: 'PUT', body }),
    adminCreateBooking: (id: string, body: { idempotency_key?: string } = {}) =>
      apiRequest<{ booking_request_id?: string; status?: string; error?: string; missing?: string[] }>(
        `/ai/conversations/${id}/create-booking`,
        { method: 'POST', body }
      ),
    usage: () => apiRequest<Record<string, unknown>>('/ai/usage'),
    evals: () => apiRequest<Array<Record<string, unknown>>>('/ai/evals'),
    runEvals: () => apiRequest<{ total: number; passed: number; failed: number }>('/ai/evals/run', { method: 'POST' }),
    purgeRetention: () => apiRequest<{ purged: number; cutoff: string; retentionDays: number }>('/ai/retention/purge', { method: 'POST' }),
    refreshEmbeddings: () => apiRequest<{ started: boolean; alreadyRunning: boolean }>('/ai/embeddings/refresh', { method: 'POST' }),
    assist: (body: { task: string; text?: string; language?: string; context?: Record<string, unknown> }) =>
      apiRequest<{ task: string; text?: string; items?: string[]; seo_title?: string; meta_description?: string; itinerary?: Array<Record<string, unknown>> }>(
        '/ai/assist',
        { method: 'POST', body }
      )
  },
  hubspot: {
    syncLead: (body: Record<string, unknown>) => apiRequest('/hubspot/sync-lead', { method: 'POST', body }),
    syncBooking: (body: Record<string, unknown>) => apiRequest('/hubspot/sync-booking', { method: 'POST', body })
  }
};
