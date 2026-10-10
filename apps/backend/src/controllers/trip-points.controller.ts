import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  createRecord,
  getRecordBySlug,
  listRecords,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';

const select = '*, destinations(name,slug)';

export const listTripPoints = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'trip_points',
    select,
    searchColumns: ['name', 'description', 'transfer_info', 'airport_code'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['destination_id', 'role', 'gateway_type', 'is_featured']
  });
});

export const getTripPoint = asyncHandler(async (req, res) => {
  return getRecordBySlug(res, 'trip_points', req.params.slug, select);
});

export const createTripPoint = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'trip_points', req.body, { slugSource: 'name', userFields: true });
});

const ensureCompatibleWithTours = async (id: string, changes: Record<string, unknown>, deleting = false) => {
  const { data, error } = await supabase.from('tours').select('id,status,start_trip_point_id,end_trip_point_id')
    .is('deleted_at', null).or(`start_trip_point_id.eq.${id},end_trip_point_id.eq.${id}`);
  if (error) throw new AppError('Unable to check tours using this Trip Point.', 500, [error]);
  const blocked = (data ?? []).some((tour) => deleting || changes.status === 'archived'
    || (tour.status === 'published' && changes.status !== undefined && changes.status !== 'published')
    || (changes.role !== undefined && changes.role !== 'both' &&
      ((tour.start_trip_point_id === id && changes.role !== 'start') || (tour.end_trip_point_id === id && changes.role !== 'end'))));
  if (blocked) throw new AppError('This Trip Point is used by a tour. Reassign the tour endpoints before changing its role, unpublishing, archiving or deleting it.', 409);
};

export const updateTripPoint = asyncHandler(async (req, res) => {
  await ensureCompatibleWithTours(req.params.id, req.body);
  return updateRecord(req, res, 'trip_points', req.params.id, req.body, { slugSource: 'name', userFields: true });
});

export const deleteTripPoint = asyncHandler(async (req, res) => {
  await ensureCompatibleWithTours(req.params.id, {}, true);
  return softDeleteRecord(res, 'trip_points', req.params.id, req);
});
