import { asyncHandler } from '../utils/async-handler';
import { createRecord, getRecordById, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';

const table = 'serengeti_migration_calendar';

export const listMigrationCalendar = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table,
    searchColumns: ['month', 'location', 'note'],
    filters: ['is_published'],
    orderBy: 'display_order',
    ascending: true
  });
});

export const getMigrationEntry = asyncHandler(async (req, res) => {
  return getRecordById(res, table, req.params.id);
});

export const createMigrationEntry = asyncHandler(async (req, res) => {
  return createRecord(req, res, table, req.body);
});

export const updateMigrationEntry = asyncHandler(async (req, res) => {
  return updateRecord(req, res, table, req.params.id, req.body);
});

export const deleteMigrationEntry = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, table, req.params.id, req);
});
