import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/api-response';
import {
  bulkSoftDeleteRecords,
  bulkUpdateRecords,
  createRecord,
  getRecordBySlug,
  listRecords,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';

const select = '*, destinations(name,slug)';

export const listLodges = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'lodges',
    select,
    searchColumns: ['name', 'description', 'why_we_recommend'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['destination_id', 'accommodation_level', 'lodge_type', 'is_featured']
  });
});

export const getLodge = asyncHandler(async (req, res) => {
  return getRecordBySlug(res, 'lodges', req.params.slug, select);
});

export const createLodge = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'lodges', req.body, { slugSource: 'name', userFields: true });
});

export const updateLodge = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'lodges', req.params.id, req.body, { slugSource: 'name', userFields: true });
});

export const deleteLodge = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'lodges', req.params.id, req);
});

// Bulk actions for the admin list. Capped so one request cannot rewrite the
// whole table, and the status value is checked against the publish_status enum
// rather than trusted from the client.
const BULK_LIMIT = 200;
const STATUSES = ['draft', 'published', 'archived'] as const;

const idsFrom = (body: unknown): string[] => {
  const raw = Array.isArray((body as { ids?: unknown[] })?.ids) ? (body as { ids: unknown[] }).ids : [];
  const unique = [...new Set(raw.map(String).filter(Boolean))];
  if (!unique.length) throw new AppError('Provide at least one lodge id.', 400);
  if (unique.length > BULK_LIMIT) throw new AppError(`Cannot process more than ${BULK_LIMIT} lodges at once.`, 400);
  return unique;
};

export const bulkDeleteLodges = asyncHandler(async (req, res) => {
  return bulkSoftDeleteRecords(res, 'lodges', idsFrom(req.body), req);
});

export const bulkUpdateLodgeStatus = asyncHandler(async (req, res) => {
  const status = String((req.body as { status?: unknown })?.status ?? '');
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new AppError(`Status must be one of: ${STATUSES.join(', ')}.`, 400);
  }
  return bulkUpdateRecords(res, 'lodges', idsFrom(req.body), { status }, req);
});
