import { supabase } from '../config/supabase';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { getQueryString } from '../utils/query';
import { createRecord, deleteRecord, getRecordById, listRecords, updateRecord } from '../utils/supabase-helpers';

const table = 'page_seo';

export const listPageSeo = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table,
    searchColumns: ['path', 'title', 'meta_description'],
    softDelete: false,
    orderBy: 'path',
    ascending: true
  });
});

export const getPageSeo = asyncHandler(async (req, res) => {
  return getRecordById(res, table, req.params.id);
});

export const createPageSeo = asyncHandler(async (req, res) => {
  return createRecord(req, res, table, req.body);
});

export const updatePageSeo = asyncHandler(async (req, res) => {
  return updateRecord(req, res, table, req.params.id, req.body);
});

export const deletePageSeo = asyncHandler(async (req, res) => {
  return deleteRecord(res, table, req.params.id, req);
});

// Public: fetch the active SEO override for a path. Absence returns match:false
// so the frontend simply keeps its default tags (never an error state).
export const resolvePageSeo = asyncHandler(async (req, res) => {
  const path = getQueryString(req.query, 'path');
  if (!path) return sendSuccess(res, 'ok', { match: false });

  const { data, error } = await supabase
    .from(table)
    .select('path, title, meta_description, og_title, og_description, og_image_url, canonical_url, robots, structured_data')
    .eq('is_active', true)
    .eq('path', path)
    .maybeSingle();

  if (error) throw new AppError('Unable to resolve page SEO.', 500, [error]);
  if (!data) return sendSuccess(res, 'ok', { match: false });

  return sendSuccess(res, 'ok', { match: true, seo: data });
});
