import { asyncHandler } from '../utils/async-handler';
import { createRecord, getRecordById, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';

const select = '*';

export const listSeasons = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'seasons',
    select,
    searchColumns: ['name', 'description', 'best_for'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['tone', 'icon'],
    orderBy: 'sort_order',
    ascending: true
  });
});

export const getSeason = asyncHandler(async (req, res) => {
  return getRecordById(res, 'seasons', req.params.id, select);
});

export const createSeason = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'seasons', req.body);
});

export const updateSeason = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'seasons', req.params.id, req.body);
});

export const deleteSeason = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'seasons', req.params.id, req);
});
