import type { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { FAQ_PLACEMENTS, type FaqPlacement, type FaqPlacementsInput } from '../schemas/faqs.schema';
import { safeAudit } from '../services/audit.service';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { getPagination, getQueryString, paginationMeta } from '../utils/query';
import { sanitizeRichFields } from '../utils/rich-text';
import { isStaffRequest } from '../utils/staff';
import { listRecords, softDeleteRecord } from '../utils/supabase-helpers';
import { localeOf, localizeRecords } from '../utils/translations';

type Row = Record<string, unknown>;
type Target = { id: string; name: string; slug: string | null };

/** The faq_placements column that holds each placement's target. */
const TARGET_COLUMN: Record<Exclude<FaqPlacement, 'home'>, 'category_id' | 'tour_id' | 'destination_id'> = {
  category: 'category_id',
  tour: 'tour_id',
  destination: 'destination_id'
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPlacement = (value: string): value is FaqPlacement => (FAQ_PLACEMENTS as readonly string[]).includes(value);

// The single attachment FAQs used to have. Placements replaced it, so every
// write clears it rather than leave a second answer to "where does this show".
const LEGACY_CLEARED = { entity_type: null, entity_id: null, destination_id: null };

/**
 * The FAQ ids a `?placement=` filter selects: `home`, `none` (placed nowhere;
 * the CMS's "not shown anywhere" view) or a target type with `target_id`.
 * Null means no placement filter was asked for.
 */
const placementFilterIds = async (req: Request): Promise<string[] | null> => {
  const placement = getQueryString(req.query, 'placement');
  if (!placement || placement === 'all') return null;

  if (placement === 'none') {
    const [{ data: all, error }, { data: placed, error: placedError }] = await Promise.all([
      supabase.from('faqs').select('id').is('deleted_at', null),
      supabase.from('faq_placements').select('faq_id')
    ]);
    if (error || placedError) throw new AppError('Unable to fetch faqs.', 500, [error ?? placedError]);
    const shown = new Set((placed ?? []).map((row) => String(row.faq_id)));
    return (all ?? []).map((row) => String(row.id)).filter((id) => !shown.has(id));
  }

  if (!isPlacement(placement)) throw new AppError('Unknown FAQ placement.', 400);
  let query = supabase.from('faq_placements').select('faq_id').eq('placement', placement);
  if (placement !== 'home') {
    const targetId = getQueryString(req.query, 'target_id');
    if (!UUID.test(targetId)) throw new AppError(`Choose which ${placement} to list FAQs for.`, 400);
    query = query.eq(TARGET_COLUMN[placement], targetId);
  }
  const { data, error } = await query;
  if (error) throw new AppError('Unable to fetch faqs.', 500, [error]);
  return [...new Set((data ?? []).map((row) => String(row.faq_id)))];
};

/**
 * Every place each FAQ shows, with readable names, for the CMS. Targets that
 * have since been deleted are left out, so saving the FAQ again drops them.
 */
const attachPlacements = async (items: Row[]) => {
  const ids = items.map((item) => String(item.id));
  if (!ids.length) return;
  const { data, error } = await supabase
    .from('faq_placements')
    .select(
      'faq_id, placement, tour_categories(id, name, slug, deleted_at), tours(id, title, slug, deleted_at), destinations(id, name, slug, deleted_at)'
    )
    .in('faq_id', ids);
  if (error) throw new AppError('Unable to fetch where these FAQs show.', 500, [error]);

  const empty = () => ({ home: false, categories: [] as Target[], tours: [] as Target[], destinations: [] as Target[] });
  const byFaq = new Map(ids.map((id) => [id, empty()]));
  const target = (record: unknown, nameKey: 'name' | 'title'): Target | null => {
    const row = (Array.isArray(record) ? record[0] : record) as Row | null | undefined;
    if (!row || row.deleted_at) return null;
    return { id: String(row.id), name: String(row[nameKey] ?? ''), slug: typeof row.slug === 'string' ? row.slug : null };
  };

  for (const row of (data ?? []) as Row[]) {
    const entry = byFaq.get(String(row.faq_id));
    if (!entry) continue;
    if (row.placement === 'home') entry.home = true;
    const category = row.placement === 'category' ? target(row.tour_categories, 'name') : null;
    const tour = row.placement === 'tour' ? target(row.tours, 'title') : null;
    const destination = row.placement === 'destination' ? target(row.destinations, 'name') : null;
    if (category) entry.categories.push(category);
    if (tour) entry.tours.push(tour);
    if (destination) entry.destinations.push(destination);
  }
  for (const entry of byFaq.values()) {
    for (const list of [entry.categories, entry.tours, entry.destinations]) list.sort((a, b) => a.name.localeCompare(b.name));
  }
  for (const item of items) item.placements = byFaq.get(String(item.id)) ?? empty();
};

const writePlacements = async (faqId: string, placements: FaqPlacementsInput) => {
  const { error } = await supabase.rpc('set_faq_placements', {
    p_faq_id: faqId,
    p_home: placements.home,
    p_category_ids: placements.category_ids,
    p_tour_ids: placements.tour_ids,
    p_destination_ids: placements.destination_ids
  });
  if (error) throw new AppError(error.code === '23514' ? error.message : 'Unable to save where this FAQ shows.', error.code === '23514' ? 422 : 500, [error]);
};

/**
 * GET /faqs. Pages ask for their questions by placement:
 *   ?placement=home
 *   ?placement=category|tour|destination&target_id=<uuid>
 * The CMS also uses ?placement=none for questions that show nowhere yet.
 * Staff get each FAQ's placements with names.
 */
export const listFaqs = asyncHandler(async (req, res) => {
  const ids = await placementFilterIds(req);
  if (ids && !ids.length) {
    const { page, limit } = getPagination(req.query);
    return sendSuccess(res, 'Records fetched successfully.', { items: [], pagination: paginationMeta(page, limit, 0) });
  }
  const staff = isStaffRequest(req);
  return listRecords(req, res, {
    table: 'faqs',
    select: '*',
    ids: ids ?? undefined,
    searchColumns: ['question', 'answer', 'category'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['category'],
    orderBy: 'sort_order',
    ascending: true,
    afterFetch: async (items) => {
      if (staff) await attachPlacements(items);
      await localizeRecords('faqs', items, localeOf(req.query.locale));
    }
  });
});

/** One FAQ. Visitors only ever see a published one; staff also get its placements. */
export const getFaq = asyncHandler(async (req, res) => {
  const staff = isStaffRequest(req);
  let query = supabase.from('faqs').select('*').eq('id', req.params.id).is('deleted_at', null);
  if (!staff) query = query.eq('status', 'published');
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError('Unable to fetch faqs.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);
  const item = data as Row;
  if (staff) await attachPlacements([item]);
  return sendSuccess(res, 'Record fetched successfully.', item);
});

const withPlacements = async (id: string) => {
  const item = { id } as Row;
  await attachPlacements([item]);
  return item.placements;
};

export const createFaq = asyncHandler(async (req: Request, res: Response) => {
  const { placements, ...fields } = req.body as Row & { placements?: FaqPlacementsInput };
  const payload = sanitizeRichFields('faqs', { ...fields, ...LEGACY_CLEARED });
  const { data, error } = await supabase.from('faqs').insert(payload).select('*').single();
  if (error) throw new AppError('Unable to create faqs.', 500, [error]);
  if (placements) {
    try {
      await writePlacements(String(data.id), placements);
    } catch (placementError) {
      // A question that saved but cannot be placed would sit in the library
      // showing nowhere while the editor reports a failure; undo it instead.
      await supabase.from('faqs').delete().eq('id', data.id);
      throw placementError;
    }
  }
  await safeAudit({ action: 'create', entityId: data.id, entityType: 'faqs', newData: { ...data, placements }, req });
  return sendSuccess(res, 'Record created successfully.', { ...data, placements: await withPlacements(String(data.id)) }, 201);
});

export const updateFaq = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const { placements, ...fields } = req.body as Row & { placements?: FaqPlacementsInput };
  const { data: previous } = await supabase.from('faqs').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!previous) throw new AppError('Record not found.', 404);
  // Placements first: if they cannot be saved, nothing else has changed either.
  if (placements) await writePlacements(id, placements);
  const payload = sanitizeRichFields('faqs', { ...fields, ...LEGACY_CLEARED });
  const { data, error } = await supabase.from('faqs').update(payload).eq('id', id).select('*').single();
  if (error) throw new AppError('Unable to update faqs.', 500, [error]);
  await safeAudit({ action: 'update', entityId: id, entityType: 'faqs', newData: { ...data, placements }, oldData: previous, req });
  return sendSuccess(res, 'Record updated successfully.', { ...data, placements: await withPlacements(id) });
});

export const deleteFaq = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'faqs', req.params.id, req);
});
