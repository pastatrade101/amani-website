import type { Request } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { rolePermissions, type PermissionKey } from '../config/permissions';
import {
  cleanTranslationFields,
  fieldsFor,
  completenessFor,
  ENTITY_PERMISSIONS,
  getDefaultLanguage,
  isTranslatableEntity,
  missingRequiredFields,
  sourceFieldsFor,
  sourceHashFor,
  type TranslationFields
} from '../utils/translations';
import { getTranslationProvider } from '../services/translation-provider';

const STATUSES = ['not_started', 'draft', 'translated', 'needs_review', 'published'] as const;
type TranslationStatus = (typeof STATUSES)[number];

/**
 * The routes are generic (/:entityType/...), so the permission key is resolved
 * per request from the same role->permissions table the static middleware
 * uses: translating a tour requires exactly what editing a tour requires.
 */
const assertEntityPermission = (req: Request, entityType: string) => {
  if (!isTranslatableEntity(entityType)) throw new AppError('Unknown translatable entity type.', 404);
  if (!req.user) throw new AppError('Authentication is required.', 401);
  if (req.user.role === 'super_admin') return;
  const permission = ENTITY_PERMISSIONS[entityType] as PermissionKey;
  if (!rolePermissions[req.user.role]?.includes(permission)) {
    throw new AppError('You do not have permission to manage translations for this content.', 403);
  }
};

const loadEntity = async (entityType: string, entityId: string) => {
  const { data, error } = await supabase.from(entityType).select('*').eq('id', entityId).maybeSingle();
  if (error) throw new AppError('Unable to load the source record.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);
  return data as Record<string, unknown>;
};

const loadTranslation = async (entityType: string, entityId: string, code: string) => {
  const { data, error } = await supabase
    .from('content_translations')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('language_code', code)
    .maybeSingle();
  if (error) throw new AppError('Unable to load the translation.', 500, [error]);
  return data as Record<string, unknown> | null;
};

const languageOrThrow = async (code: string) => {
  const { data } = await supabase.from('languages').select('*').eq('code', code).maybeSingle();
  if (!data) throw new AppError('Unknown language.', 404);
  if (!data.enabled) throw new AppError('This language is currently disabled.', 409);
  return data as { code: string; is_default: boolean };
};

// ── Languages ────────────────────────────────────────────────────────────────

export const listLanguages = asyncHandler(async (req, res) => {
  let query = supabase.from('languages').select('*').order('sort_order', { ascending: true });
  // The public list only carries enabled languages; the admin asks for all.
  if (!(req.query.all === '1' && req.user)) query = query.eq('enabled', true);
  const { data, error } = await query;
  if (error) throw new AppError('Unable to load languages.', 500, [error]);
  return sendSuccess(res, 'Languages fetched successfully.', data ?? []);
});

export const updateLanguage = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const patch: Record<string, unknown> = {};
  if (typeof req.body.enabled === 'boolean') patch.enabled = req.body.enabled;
  if (typeof req.body.sort_order === 'number') patch.sort_order = req.body.sort_order;
  if (!Object.keys(patch).length && req.body.is_default !== true) {
    throw new AppError('Nothing to update.', 422);
  }

  // Default language changes are a two-step swap so the partial unique index
  // (one default, ever) can never be violated mid-flight.
  if (req.body.is_default === true) {
    const { error: clearError } = await supabase.from('languages').update({ is_default: false }).eq('is_default', true);
    if (clearError) throw new AppError('Unable to change the default language.', 500, [clearError]);
    patch.is_default = true;
    patch.enabled = true;
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('languages').update(patch).eq('code', code).select('*').single();
  if (error) throw new AppError('Unable to update the language.', 500, [error]);
  await safeAudit({ action: 'update', entityId: code, entityType: 'languages', newData: data, req });
  return sendSuccess(res, 'Language updated successfully.', data);
});

// ── Translations ─────────────────────────────────────────────────────────────

const decorate = (
  entityType: string,
  row: Record<string, unknown> | null,
  currentHash: string,
  source: TranslationFields
): Record<string, unknown> => {
  const fields = (row?.fields ?? {}) as TranslationFields;
  return {
    ...(row ?? { translation_status: 'not_started', fields: {} }),
    completeness: completenessFor(entityType, fields, source),
    missing_required: missingRequiredFields(entityType, fields, source),
    // A translation saved against an older source hash may no longer match
    // what the default language now says.
    outdated: Boolean(row?.source_hash && row.source_hash !== currentHash)
  };
};

export const listEntityTranslations = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  assertEntityPermission(req, entityType);
  const entity = await loadEntity(entityType, entityId);
  const currentHash = sourceHashFor(entityType, entity);
  const defaultLanguage = await getDefaultLanguage();

  const [{ data: languages }, { data: rows }] = await Promise.all([
    supabase.from('languages').select('*').order('sort_order', { ascending: true }),
    supabase.from('content_translations').select('*').eq('entity_type', entityType).eq('entity_id', entityId)
  ]);

  const byCode = new Map((rows ?? []).map((row) => [String(row.language_code), row as Record<string, unknown>]));
  const source = sourceFieldsFor(entityType, entity);
  const translations: Record<string, unknown> = {};
  for (const language of languages ?? []) {
    translations[language.code] = decorate(entityType, byCode.get(language.code) ?? null, currentHash, source);
  }

  return sendSuccess(res, 'Translations fetched successfully.', {
    default_language: defaultLanguage,
    languages: languages ?? [],
    // The record's own list: for a safari package that includes every block.
    fields: fieldsFor(entityType, entity),
    source,
    source_hash: currentHash,
    translations
  });
});

const saveTranslation = async (
  req: Request,
  entityType: string,
  entityId: string,
  code: string,
  fields: TranslationFields,
  status: TranslationStatus
) => {
  const entity = await loadEntity(entityType, entityId);
  const existing = await loadTranslation(entityType, entityId, code);

  const source = sourceFieldsFor(entityType, entity);
  if (status === 'published') {
    const missing = missingRequiredFields(entityType, fields, source);
    if (missing.length) {
      throw new AppError(`Cannot publish: required fields are missing (${missing.join(', ')}).`, 422);
    }
  }

  const now = new Date().toISOString();
  const userId = req.user?.sub ?? null;
  const payload: Record<string, unknown> = {
    entity_type: entityType,
    entity_id: entityId,
    language_code: code,
    fields,
    translated_slug: typeof req.body.translated_slug === 'string' && req.body.translated_slug.trim()
      ? req.body.translated_slug.trim()
      : null,
    translation_status: status,
    source_hash: sourceHashFor(entityType, entity),
    updated_by: userId,
    updated_at: now,
    translated_at: now,
    translated_by: existing?.translated_by ?? userId
  };
  if (!existing) payload.created_by = userId;
  if (status === 'needs_review') {
    payload.reviewed_at = null;
  }
  if (status === 'published') {
    payload.published_at = now;
    payload.published_by = userId;
    payload.reviewed_at = existing?.reviewed_at ?? now;
    payload.reviewed_by = existing?.reviewed_by ?? userId;
  }

  const { data, error } = await supabase
    .from('content_translations')
    .upsert(payload, { onConflict: 'entity_type,entity_id,language_code' })
    .select('*')
    .single();
  if (error) throw new AppError('Unable to save the translation.', 500, [error]);
  await safeAudit({ action: existing ? 'update' : 'create', entityId: String(data.id), entityType: 'content_translations', newData: data, oldData: existing ?? undefined, req });
  return decorate(entityType, data as Record<string, unknown>, String(payload.source_hash), source);
};

export const upsertTranslation = asyncHandler(async (req, res) => {
  const { entityType, entityId, code } = req.params;
  assertEntityPermission(req, entityType);
  await languageOrThrow(code);

  const status = String(req.body.translation_status ?? 'draft') as TranslationStatus;
  if (!STATUSES.includes(status)) throw new AppError('Unknown translation status.', 422);

  // The record decides which keys are real — a package's block fields exist
  // only on the package that has those blocks.
  const entity = await loadEntity(entityType, entityId);
  const fields = cleanTranslationFields(entityType, req.body.fields, entity);
  const saved = await saveTranslation(req, entityType, entityId, code, fields, status);
  return sendSuccess(res, 'Translation saved successfully.', saved);
});

export const copyFromDefault = asyncHandler(async (req, res) => {
  const { entityType, entityId, code } = req.params;
  assertEntityPermission(req, entityType);
  await languageOrThrow(code);
  const defaultLanguage = await getDefaultLanguage();
  if (code === defaultLanguage) throw new AppError('This already is the default language.', 422);

  const entity = await loadEntity(entityType, entityId);
  const source = sourceFieldsFor(entityType, entity);
  const existing = await loadTranslation(entityType, entityId, code);
  const current = (existing?.fields ?? {}) as TranslationFields;

  // Fill EMPTY fields only — never overwrite work that exists.
  const merged: TranslationFields = { ...current };
  for (const [key, value] of Object.entries(source)) {
    const held = current[key];
    const empty = Array.isArray(held) ? !held.length : !String(held ?? '').trim();
    if (empty) merged[key] = value;
  }

  const status = (existing?.translation_status as TranslationStatus | undefined) ?? 'draft';
  const saved = await saveTranslation(req, entityType, entityId, code, cleanTranslationFields(entityType, merged, entity), status === 'not_started' ? 'draft' : status);
  return sendSuccess(res, 'Empty fields copied from the default language.', saved);
});

export const aiTranslate = asyncHandler(async (req, res) => {
  const { entityType, entityId, code } = req.params;
  assertEntityPermission(req, entityType);
  const language = await languageOrThrow(code);
  if (language.is_default) throw new AppError('Cannot machine-translate into the default language.', 422);

  const entity = await loadEntity(entityType, entityId);
  const source = sourceFieldsFor(entityType, entity);
  const existing = await loadTranslation(entityType, entityId, code);
  const current = (existing?.fields ?? {}) as TranslationFields;
  const overwrite = req.body.overwrite === true;

  // Translate only what is missing unless overwrite was explicitly requested.
  const toTranslate: TranslationFields = {};
  for (const [key, value] of Object.entries(source)) {
    const held = current[key];
    const empty = Array.isArray(held) ? !held.length : !String(held ?? '').trim();
    if (empty || overwrite) toTranslate[key] = value;
  }
  if (!Object.keys(toTranslate).length) {
    return sendSuccess(res, 'Nothing to translate — every field already has content.', null);
  }

  const labels = Object.fromEntries(fieldsFor(entityType, entity).map((field) => [field.key, field.label]));
  const translated = await getTranslationProvider().translate(toTranslate, {
    entityType,
    entityName: String(entity.name ?? entity.title ?? ''),
    sourceLanguage: await getDefaultLanguage(),
    targetLanguage: code,
    fieldLabels: labels
  });

  // Machine output is sanitised like any other input and always lands as
  // needs_review — publishing stays a human decision.
  const merged = cleanTranslationFields(entityType, { ...current, ...translated }, entity);
  const saved = await saveTranslation(req, entityType, entityId, code, merged, 'needs_review');
  return sendSuccess(res, 'AI translation saved for review.', saved);
});
