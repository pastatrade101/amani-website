import { asyncHandler } from '../utils/async-handler';
import { createRecord, getRecordBySlug, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';
import { localeOf, localizeRecords } from '../utils/translations';

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

export const getCategory = asyncHandler(async (req, res) =>
  getRecordBySlug(res, 'tour_categories', req.params.slug, '*', { locale: localeOf(req.query.locale) })
);

export const createCategory = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'tour_categories', req.body, { slugSource: 'name' });
});

export const updateCategory = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'tour_categories', req.params.id, req.body, { slugSource: 'name' });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'tour_categories', req.params.id, req);
});
