import { supabase } from '../config/supabase';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { getQueryString } from '../utils/query';
import { createRecord, deleteRecord, getRecordById, listRecords, updateRecord } from '../utils/supabase-helpers';

export const listRedirects = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'slug_redirects',
    searchColumns: ['from_path', 'to_path'],
    softDelete: false,
    orderBy: 'created_at',
    ascending: false
  });
});

export const getRedirect = asyncHandler(async (req, res) => {
  return getRecordById(res, 'slug_redirects', req.params.id);
});

export const createRedirect = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'slug_redirects', req.body);
});

export const updateRedirect = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'slug_redirects', req.params.id, req.body);
});

export const deleteRedirect = asyncHandler(async (req, res) => {
  return deleteRecord(res, 'slug_redirects', req.params.id, req);
});

export const resolveRedirect = asyncHandler(async (req, res) => {
  const path = getQueryString(req.query, 'path');

  if (!path) return sendSuccess(res, 'ok', { match: false });

  const { data, error } = await supabase
    .from('slug_redirects')
    .select('to_path, status_code')
    .eq('is_active', true)
    .eq('from_path', path)
    .maybeSingle();

  if (error) throw new AppError('Unable to resolve redirect.', 500, [error]);
  if (!data) return sendSuccess(res, 'ok', { match: false });

  return sendSuccess(res, 'ok', { match: true, to_path: data.to_path, status_code: data.status_code });
});
