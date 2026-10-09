import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { cleanSearch, getPagination, getQueryString, paginationMeta } from '../utils/query';
import { getRecordById, softDeleteRecord } from '../utils/supabase-helpers';
import { notifyContactMessage } from '../services/notification.service';

type ContactSource = 'contact_form' | 'plan_my_trip';

/**
 * Splits the request into the row to insert and the fields that only steer the
 * emails. contact_messages has no columns for source, reference or the
 * captcha token, so leaving any of them in would fail the insert.
 */
export const splitContactBody = (body: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source, reference, captcha_token, ...row } = body;
  return {
    row,
    source: (source === 'plan_my_trip' ? 'plan_my_trip' : 'contact_form') as ContactSource,
    reference: typeof reference === 'string' ? reference : ''
  };
};

/** How long a resent trip plan counts as the same request. */
export const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

const likeEscape = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/**
 * A trip plan already saved under this reference. The planner sends one
 * reference per page load, so a second send (a double tap, a retry after a
 * slow network) finds the first row instead of emailing everyone twice. Not
 * race-proof — there is no unique column to lean on — but it catches the
 * retries that actually happen.
 */
export const findRecentPlan = async (email: string, reference: string, now = Date.now(), client = supabase) => {
  if (!email || !reference) return null;
  const { data } = await client
    .from('contact_messages')
    .select('id')
    .ilike('email', likeEscape(email))
    .ilike('subject', `%${likeEscape(reference)}%`)
    .gte('created_at', new Date(now - DUPLICATE_WINDOW_MS).toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
};

export const createContactMessage = asyncHandler(async (req, res) => {
  const { row, source, reference } = splitContactBody(req.body as Record<string, unknown>);

  if (reference) {
    const existing = await findRecentPlan(String(row.email ?? ''), reference);
    // Only the id and reference: anyone holding an email and a reference could
    // resend them, and must not get the stored enquiry back.
    if (existing) return sendSuccess(res, 'Contact message already received.', { id: existing.id, reference }, 201);
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .insert({ ...row, status: 'new' })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to submit contact message.', 500, [error]);
  // Fire-and-forget: the message is saved, and email must never fail the form.
  void notifyContactMessage(data as Record<string, unknown>, { source, reference });
  return sendSuccess(res, 'Contact message submitted successfully.', data, 201);
});

export const listContactMessages = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const search = cleanSearch(getQueryString(req.query, 'search'));
  const status = getQueryString(req.query, 'status');

  let query = supabase
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(
      ['full_name', 'email', 'phone', 'subject', 'message']
        .map((column) => `${column}.ilike.%${search}%`)
        .join(',')
    );
  }
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new AppError('Unable to fetch contact messages.', 500, [error]);

  return sendSuccess(res, 'Contact messages fetched successfully.', {
    items: data ?? [],
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

export const getContactMessage = asyncHandler(async (req, res) => {
  return getRecordById(res, 'contact_messages', req.params.id);
});

export const updateContactMessageStatus = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('contact_messages')
    .update(req.body)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) throw new AppError('Unable to update contact message status.', 500, [error]);
  return sendSuccess(res, 'Contact message status updated successfully.', data);
});

export const assignContactMessage = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('contact_messages')
    .update({ assigned_to: req.body.assigned_to || null })
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) throw new AppError('Unable to assign contact message.', 500, [error]);
  return sendSuccess(res, 'Contact message assigned successfully.', data);
});

export const updateContactMessageNotes = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('contact_messages')
    .update({ admin_notes: req.body.admin_notes ?? null })
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) throw new AppError('Unable to update contact message notes.', 500, [error]);
  return sendSuccess(res, 'Contact message notes updated successfully.', data);
});

export const deleteContactMessage = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'contact_messages', req.params.id, req);
});
