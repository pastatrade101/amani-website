import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { createUniqueSlug } from '../services/slug.service';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { sanitizeRichFields } from '../utils/rich-text';
import { isStaffRequest } from '../utils/staff';
import { getRecordBySlug, listRecords, softDeleteRecord } from '../utils/supabase-helpers';

/**
 * Activities link to destinations (activity_destinations, one primary) and to
 * tours (tour_activities), mirroring how tours link to destinations. The list
 * stays light but carries the links, so the CMS can show "Serengeti +2 · 3
 * tours"; the detail read carries names for the editor and the public pages.
 */
const listSelect = '*, destinations!activities_destination_id_fkey(name,slug), activity_destinations(destination_id,is_primary,sort_order), tour_activities(tour_id)';
const detailSelect =
  '*, destinations!activities_destination_id_fkey(name,slug), activity_destinations(destination_id,sort_order,is_primary,destinations(id,name,slug,region,status)), tour_activities(tour_id,sort_order,tours(id,title,slug,status,deleted_at))';
// The primary destination needs the FK hint: with activity_destinations in place,
// a bare `destinations(...)` embed is ambiguous (PGRST201) and fails the query.
// Before the links migration the link embeds don't resolve; fall back rather than fail.
const legacySelect = '*, destinations!activities_destination_id_fkey(name,slug)';

const isMissingLink = (error: unknown) => {
  const text = JSON.stringify(error ?? '').toLowerCase();
  return text.includes('activity_destinations') || text.includes('tour_activities') || text.includes('pgrst200') || text.includes('42p01') || text.includes('schema cache');
};

const uniqueIds = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))] : [];

/** Split link arrays off the row payload; keep destination_id equal to the primary. */
const preparePayload = (body: Record<string, unknown>) => {
  const payload: Record<string, unknown> = { ...body };
  const hasDestinationIds = Object.prototype.hasOwnProperty.call(body, 'destination_ids');
  const hasTourIds = Object.prototype.hasOwnProperty.call(body, 'tour_ids');
  delete payload.destination_ids;
  delete payload.tour_ids;
  delete payload.activity_destinations;
  delete payload.tour_activities;
  delete payload.destinations;

  const explicit = typeof body.destination_id === 'string' ? body.destination_id.trim() : '';
  const destinationIds = uniqueIds(body.destination_ids);
  if (!hasDestinationIds && explicit) destinationIds.push(explicit);
  if (hasDestinationIds) payload.destination_id = destinationIds[0] ?? null;
  else if (payload.destination_id === '') payload.destination_id = null;

  // One SEO title field in the CMS; both columns stay in step for older readers.
  if (Object.prototype.hasOwnProperty.call(body, 'meta_title') && !Object.prototype.hasOwnProperty.call(body, 'seo_title')) {
    payload.seo_title = body.meta_title ?? null;
  }

  return {
    payload,
    destinationIds,
    tourIds: uniqueIds(body.tour_ids),
    syncDestinations: hasDestinationIds || Object.prototype.hasOwnProperty.call(body, 'destination_id'),
    syncTours: hasTourIds
  };
};

const syncDestinations = async (activityId: string, destinationIds: string[]) => {
  const { error: clearError } = await supabase.from('activity_destinations').delete().eq('activity_id', activityId);
  if (clearError) {
    if (isMissingLink(clearError) && destinationIds.length <= 1) return;
    throw new AppError('Unable to update where this activity happens. Run the activity links migration first.', 500, [clearError]);
  }
  if (!destinationIds.length) return;
  const { error } = await supabase
    .from('activity_destinations')
    .insert(destinationIds.map((destinationId, index) => ({ activity_id: activityId, destination_id: destinationId, sort_order: index, is_primary: index === 0 })));
  if (error) throw new AppError('Unable to link this activity to its destinations.', 500, [error]);
};

/** Keep existing tour positions; new links go to the end of each tour's list. */
const syncTours = async (activityId: string, tourIds: string[]) => {
  const { data: current, error: readError } = await supabase.from('tour_activities').select('tour_id').eq('activity_id', activityId);
  if (readError) {
    if (isMissingLink(readError) && !tourIds.length) return;
    throw new AppError('Unable to update the tours for this activity. Run the activity links migration first.', 500, [readError]);
  }
  const existing = new Set((current ?? []).map((row) => String(row.tour_id)));
  const removed = [...existing].filter((id) => !tourIds.includes(id));
  const added = tourIds.filter((id) => !existing.has(id));

  if (removed.length) {
    const { error } = await supabase.from('tour_activities').delete().eq('activity_id', activityId).in('tour_id', removed);
    if (error) throw new AppError('Unable to remove this activity from a tour.', 500, [error]);
  }
  if (added.length) {
    const { error } = await supabase.from('tour_activities').insert(added.map((tourId) => ({ tour_id: tourId, activity_id: activityId, sort_order: 1000 })));
    if (error) throw new AppError('Unable to add this activity to a tour.', 500, [error]);
  }
};

const fetchActivity = async (id: string) => {
  let { data, error } = await supabase.from('activities').select(detailSelect).eq('id', id).maybeSingle();
  if (error && isMissingLink(error)) ({ data, error } = await supabase.from('activities').select(legacySelect).eq('id', id).maybeSingle());
  if (error) throw new AppError('Unable to load the activity.', 500, [error]);
  return data;
};

export const listActivities = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'activities',
    select: listSelect,
    searchColumns: ['name', 'description', 'why_we_recommend', 'location_label'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['destination_id', 'category', 'difficulty', 'is_featured']
  });
});

/** Public readers only see links to published tours and destinations. */
const hideUnpublishedLinks = (record: Record<string, unknown>) => {
  if (Array.isArray(record.tour_activities)) {
    record.tour_activities = (record.tour_activities as Array<Record<string, any>>).filter((link) => link.tours?.status === 'published' && !link.tours?.deleted_at);
  }
  if (Array.isArray(record.activity_destinations)) {
    record.activity_destinations = (record.activity_destinations as Array<Record<string, any>>).filter(
      (link) => link.destinations?.status === 'published'
    );
  }
};

export const getActivity = asyncHandler(async (req, res) => {
  // A draft activity does not exist for the public; the CMS reads any status.
  if (isStaffRequest(req)) return getRecordBySlug(res, 'activities', req.params.slug, detailSelect);
  return getRecordBySlug(res, 'activities', req.params.slug, detailSelect, {
    status: 'published',
    afterFetch: hideUnpublishedLinks
  });
});

export const createActivity = asyncHandler(async (req, res) => {
  const { payload, destinationIds, tourIds, syncDestinations: linkDestinations, syncTours: linkTours } = preparePayload(req.body);
  const row = sanitizeRichFields('activities', payload);
  row.slug = await createUniqueSlug('activities', String(row.slug || row.name));
  if (req.user) {
    row.created_by = req.user.sub;
    row.updated_by = req.user.sub;
  }

  const { data, error } = await supabase.from('activities').insert(row).select('id').single();
  if (error) throw new AppError('Unable to create the activity.', 500, [error]);
  if (linkDestinations) await syncDestinations(data.id, destinationIds);
  if (linkTours) await syncTours(data.id, tourIds);

  const saved = await fetchActivity(data.id);
  await safeAudit({ action: 'create', entityId: data.id, entityType: 'activities', newData: saved, req });
  return sendSuccess(res, 'Activity created successfully.', saved, 201);
});

export const updateActivity = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { payload, destinationIds, tourIds, syncDestinations: linkDestinations, syncTours: linkTours } = preparePayload(req.body);
  const row = sanitizeRichFields('activities', payload);
  if (row.slug) row.slug = await createUniqueSlug('activities', String(row.slug), id);
  if (req.user) row.updated_by = req.user.sub;

  const previous = await fetchActivity(id);
  if (!previous) throw new AppError('Activity not found.', 404);
  if (Object.keys(row).length) {
    const { error } = await supabase.from('activities').update(row).eq('id', id);
    if (error) throw new AppError('Unable to update the activity.', 500, [error]);
  }
  if (linkDestinations) await syncDestinations(id, destinationIds);
  if (linkTours) await syncTours(id, tourIds);

  const saved = await fetchActivity(id);
  await safeAudit({ action: 'update', entityId: id, entityType: 'activities', oldData: previous, newData: saved, req });
  return sendSuccess(res, 'Activity updated successfully.', saved);
});

export const deleteActivity = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'activities', req.params.id, req);
});
