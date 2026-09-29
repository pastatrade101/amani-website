import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { cleanSearch, getQueryString } from '../utils/query';
import { isForbiddenKey } from '../schemas/settings.schema';
import { CURRENCY_SETTINGS_KEY, validateCurrencyConfigList } from '../config/currencies';
import { sanitizeRichText } from '../utils/rich-text';

// Keys managed by dedicated modules — not editable/deletable via generic settings.
const RESERVED_KEYS = ['branding'];

// Legal page text edited in Settings (data/legal-pages.ts). Private settings:
// the website reads one page at a time from /api/public/legal/:doc instead of
// shipping four long documents inside the settings every page loads.
const LEGAL_BODY_KEY = /^legal_(privacy|terms|cancellation|data_retention)_body$/;

/** Page text is CMS HTML like any other rich field: it goes through the same sanitiser. */
export const cleanSettingValue = (key: string, value: unknown): unknown =>
  LEGAL_BODY_KEY.test(key) && typeof value === 'string' ? sanitizeRichText(value) : value;

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validates a setting value against its declared type (empty values always allowed). */
const validateValueByType = (type: string | undefined, value: unknown) => {
  if (value === null || value === undefined || value === '') return;

  switch (type) {
    case 'url':
      if (typeof value !== 'string' || !/^https?:\/\/.+/.test(value)) {
        throw new AppError('Value must be a valid URL (https://...).', 422);
      }
      break;
    case 'email':
      if (typeof value !== 'string' || !EMAIL.test(value)) throw new AppError('Value must be a valid email address.', 422);
      break;
    case 'color':
      if (typeof value !== 'string' || !HEX.test(value)) throw new AppError('Value must be a valid hex color (e.g. #1f4d3a).', 422);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') throw new AppError('Value must be a boolean.', 422);
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) throw new AppError('Value must be a number.', 422);
      break;
    default:
      break; // text, textarea, phone, image, json, select — accept as-is
  }
};

const validateSettingValue = (key: string, type: string | undefined, value: unknown) => {
  validateValueByType(type, value);
  if (key === CURRENCY_SETTINGS_KEY) {
    try {
      validateCurrencyConfigList(value);
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Supported currencies are invalid.', 422);
    }
  }
};

const auditAction = (key: string, base: string) => {
  if (key.endsWith('_enabled') || key.startsWith('hubspot') || key.startsWith('ai_')) return `${base}_integration_toggle`;
  return base;
};

export const listSettings = asyncHandler(async (req, res) => {
  const group = getQueryString(req.query, 'group');
  const publicOnly = getQueryString(req.query, 'public_only') === 'true';
  const search = cleanSearch(getQueryString(req.query, 'search'));

  let query = supabase
    .from('website_settings')
    .select('*')
    .is('deleted_at', null)
    .order('setting_group', { ascending: true })
    .order('setting_key', { ascending: true });

  if (group && group !== 'all') query = query.eq('setting_group', group);
  if (publicOnly) query = query.eq('is_public', true);
  if (search) query = query.or(`setting_key.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw new AppError('Unable to fetch website settings.', 500, [error]);

  return sendSuccess(res, 'Website settings fetched successfully.', data ?? []);
});

export const getSettingsByGroup = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('website_settings')
    .select('*')
    .eq('setting_group', req.params.group)
    .is('deleted_at', null)
    .order('setting_key', { ascending: true });

  if (error) throw new AppError('Unable to fetch settings group.', 500, [error]);
  return sendSuccess(res, 'Settings group fetched successfully.', data ?? []);
});

export const getSetting = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('website_settings')
    .select('*')
    .eq('setting_key', req.params.key)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch setting.', 500, [error]);
  if (!data) throw new AppError('Setting not found.', 404);

  return sendSuccess(res, 'Setting fetched successfully.', data);
});

export const createSetting = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const key = String(body.setting_key);

  if (isForbiddenKey(key)) throw new AppError('Secret-like keys cannot be stored in website settings.', 403);
  if (RESERVED_KEYS.includes(key)) throw new AppError('This key is reserved and managed by a dedicated module.', 409);

  const { data: existing } = await supabase.from('website_settings').select('id,deleted_at').eq('setting_key', key).maybeSingle();
  if (existing && !existing.deleted_at) throw new AppError('A setting with that key already exists.', 409);

  validateSettingValue(key, body.setting_type as string, body.setting_value);

  const payload = {
    ...body,
    setting_value: cleanSettingValue(key, body.setting_value) ?? null,
    updated_by: req.user?.sub ?? null,
    deleted_at: null
  };

  const { data, error } = await supabase
    .from('website_settings')
    .upsert(payload, { onConflict: 'setting_key' })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to create setting.', 500, [error]);

  await safeAudit({ action: auditAction(key, 'create'), entityId: data.id, entityType: 'website_settings', newData: data, req });

  return sendSuccess(res, 'Setting created successfully.', data, 201);
});

export const updateSetting = asyncHandler(async (req, res) => {
  const key = req.params.key;

  if (isForbiddenKey(key)) throw new AppError('Secret-like keys cannot be stored in website settings.', 403);
  if (RESERVED_KEYS.includes(key)) throw new AppError('This key is reserved and managed by a dedicated module.', 409);

  const { data: previous } = await supabase
    .from('website_settings')
    .select('*')
    .eq('setting_key', key)
    .maybeSingle();

  const body = req.body as Record<string, unknown>;
  const effectiveType = (body.setting_type as string | undefined) ?? previous?.setting_type ?? 'text';
  validateSettingValue(key, effectiveType, body.setting_value);

  const payload = {
    setting_key: key,
    ...body,
    ...('setting_value' in body ? { setting_value: cleanSettingValue(key, body.setting_value) } : {}),
    updated_by: req.user?.sub ?? null,
    deleted_at: null
  };

  const { data, error } = await supabase
    .from('website_settings')
    .upsert(payload, { onConflict: 'setting_key' })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to update website setting.', 500, [error]);

  await safeAudit({ action: auditAction(key, 'update'), entityId: data.id, entityType: 'website_settings', oldData: previous, newData: data, req });

  return sendSuccess(res, 'Website setting updated successfully.', data);
});

export const deleteSetting = asyncHandler(async (req, res) => {
  const key = req.params.key;

  if (req.user?.role !== 'super_admin') throw new AppError('Only a super admin can delete settings.', 403);
  if (RESERVED_KEYS.includes(key)) throw new AppError('This key is reserved and cannot be deleted.', 409);

  const { data: previous } = await supabase.from('website_settings').select('*').eq('setting_key', key).maybeSingle();
  if (!previous) throw new AppError('Setting not found.', 404);

  const { error } = await supabase
    .from('website_settings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('setting_key', key);

  if (error) throw new AppError('Unable to delete setting.', 500, [error]);

  await safeAudit({ action: 'delete', entityId: previous.id, entityType: 'website_settings', oldData: previous, req });

  return sendSuccess(res, 'Setting deleted successfully.');
});

/** Public, unauthenticated — returns only is_public settings as a flat key→value map. */
export const getPublicSettings = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from('website_settings')
    .select('setting_key,setting_value')
    .eq('is_public', true)
    .is('deleted_at', null);

  if (error) throw new AppError('Unable to fetch public settings.', 500, [error]);

  const map: Record<string, unknown> = {};
  for (const row of data ?? []) map[String(row.setting_key)] = row.setting_value;

  return sendSuccess(res, 'Public settings fetched successfully.', map);
});
