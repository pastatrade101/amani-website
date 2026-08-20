import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { attachThumbnails, createRecord, getRecordBySlug, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';
import { localizeRecords } from '../utils/translations';

const localeOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(value) ? value.toLowerCase().slice(0, 2) : undefined;

export const listCategories = asyncHandler(async (req, res) => {
  const locale = localeOf(req.query.locale);
  return listRecords(req, res, {
    table: 'tour_categories',
    searchColumns: ['name', 'description'],
    statusColumn: 'status',
    defaultStatus: 'published',
    orderBy: 'sort_order',
    ascending: true,
    // Published translations for the requested locale are merged over the
    // batch in a single query — never one per row. Untranslated fields keep
    // their default-language values (per-field fallback).
    afterFetch: locale ? (items) => localizeRecords('tour_categories', items, locale) : undefined
  });
});

export const getCategory = asyncHandler(async (req, res) => {
  const locale = localeOf(req.query.locale);
  if (!locale) return getRecordBySlug(res, 'tour_categories', req.params.slug);

  const { data, error } = await supabase
    .from('tour_categories')
    .select('*')
    .eq('slug', req.params.slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new AppError('Unable to fetch tour_categories.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);

  const record = data as Record<string, unknown>;
  await attachThumbnails('tour_categories', [record]);
  await localizeRecords('tour_categories', [record], locale);
  return sendSuccess(res, 'Record fetched successfully.', record);
});

export const createCategory = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'tour_categories', req.body, { slugSource: 'name' });
});

export const updateCategory = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'tour_categories', req.params.id, req.body, { slugSource: 'name' });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'tour_categories', req.params.id, req);
});
