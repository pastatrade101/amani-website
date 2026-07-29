import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { deleteRecord, listRecords, updateRecord } from '../utils/supabase-helpers';

const table = 'error_logs';

// Public, custom ingest: aggregate broken-URL hits by (url, error_type). The
// first hit inserts a row; each later hit bumps the count and refreshes
// last_seen_at (and the error message) instead of creating a duplicate.
export const ingestError = asyncHandler(async (req, res) => {
  const { url, error_type = '404', referrer, error_message } = req.body;

  const { data: existing, error: findError } = await supabase
    .from(table)
    .select('*')
    .eq('url', url)
    .eq('error_type', error_type)
    .maybeSingle();

  if (findError) throw new AppError('Unable to record error log.', 500, [findError]);

  if (existing) {
    const { data, error } = await supabase
      .from(table)
      .update({
        count: existing.count + 1,
        last_seen_at: new Date().toISOString(),
        error_message: error_message ?? existing.error_message
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new AppError('Unable to record error log.', 500, [error]);
    return sendSuccess(res, 'Error log recorded successfully.', data);
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ url, error_type, referrer, error_message })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to record error log.', 500, [error]);
  return sendSuccess(res, 'Error log recorded successfully.', data, 201);
});

export const listErrorLogs = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table,
    searchColumns: ['url'],
    filters: ['error_type', 'is_resolved'],
    softDelete: false,
    orderBy: 'last_seen_at',
    ascending: false
  });
});

export const updateErrorLog = asyncHandler(async (req, res) => {
  return updateRecord(req, res, table, req.params.id, req.body);
});

export const deleteErrorLog = asyncHandler(async (req, res) => {
  return deleteRecord(res, table, req.params.id, req);
});
