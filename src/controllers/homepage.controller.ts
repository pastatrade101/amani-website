import { supabase } from '../config/supabase';
import { localeOf, localizeRecords } from '../utils/translations';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { createRecord, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';
import { getQueryString } from '../utils/query';
import { looksLikeHtml, sanitizeRichText } from '../utils/rich-text';

type HomepageSectionInput = {
  section_key?: string;
  title?: string | null;
  subtitle?: string | null;
  content?: string | null;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  extra_data?: unknown;
  is_active?: boolean;
  sort_order?: number;
};

type PartnerLogo = {
  image_url: string;
  name?: string;
  url?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizePartnerLogos = (extraData: unknown) => {
  const extra = isRecord(extraData) ? { ...extraData } : {};
  const rawLogos = Array.isArray(extra.logos) ? extra.logos : [];
  const logos = rawLogos
    .filter(isRecord)
    .map((logo) => {
      const imageUrl = cleanString(logo.image_url);
      if (!imageUrl) return null;
      const name = cleanString(logo.name);
      const url = cleanString(logo.url);
      return {
        ...(name ? { name } : {}),
        image_url: imageUrl,
        ...(url ? { url } : {})
      };
    })
    .filter((logo): logo is PartnerLogo => Boolean(logo));

  return { ...extra, logos };
};

const normalizeHomepageSectionPayload = (section: HomepageSectionInput): HomepageSectionInput => {
  const sectionKey = cleanString(section.section_key);
  const extraData = section.extra_data;
  const hasPartnerLogos = isRecord(extraData) && Array.isArray(extraData.logos);
  const normalized: HomepageSectionInput = {
    ...section,
    ...(sectionKey ? { section_key: sectionKey } : {})
  };

  if (sectionKey === 'partners' || hasPartnerLogos) {
    normalized.extra_data = normalizePartnerLogos(extraData);
  }

  // Rich fields stored inside extra_data are invisible to sanitizeRichFields,
  // which only walks top-level columns. The Advisor's Note footnote is edited
  // as rich text, so it is sanitised here rather than trusted on the way in.
  const nextExtra = normalized.extra_data;
  if (isRecord(nextExtra) && typeof nextExtra.footnote === 'string' && looksLikeHtml(nextExtra.footnote)) {
    normalized.extra_data = { ...nextExtra, footnote: sanitizeRichText(nextExtra.footnote) };
  }

  return normalized;
};

export const getHomepage = asyncHandler(async (req, res) => {
  const includeInactive = getQueryString(req.query, 'all') === 'true';

  let query = supabase
    .from('homepage_sections')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new AppError('Unable to fetch homepage content.', 500, [error]);

  // The homepage is the highest-traffic page on the site; without this a
  // visitor on /de/ met an entirely English homepage. One batched merge.
  const sections = (data ?? []) as Array<Record<string, unknown>>;
  await localizeRecords('homepage_sections', sections, localeOf(req.query.locale));

  return sendSuccess(res, 'Homepage content fetched successfully.', sections);
});

export const updateHomepage = asyncHandler(async (req, res) => {
  const sections = Array.isArray(req.body.sections)
    ? (req.body.sections as HomepageSectionInput[]).map(normalizeHomepageSectionPayload)
    : [];

  if (sections.length === 0) {
    throw new AppError('At least one homepage section is required.', 422);
  }

  const payload = sections.map((section) => ({
    section_key: section.section_key,
    title: section.title ?? null,
    subtitle: section.subtitle ?? null,
    content: section.content ?? null,
    image_url: section.image_url ?? null,
    button_text: section.button_text ?? null,
    button_url: section.button_url ?? null,
    extra_data: section.extra_data ?? {},
    is_active: section.is_active ?? true,
    sort_order: section.sort_order ?? 0
  }));

  const { data, error } = await supabase
    .from('homepage_sections')
    .upsert(payload, { onConflict: 'section_key' })
    .select('*');

  if (error) throw new AppError('Unable to update homepage content.', 500, [error]);
  return sendSuccess(res, 'Homepage content updated successfully.', data);
});

export const createHomepageSection = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'homepage_sections', normalizeHomepageSectionPayload(req.body) as Record<string, unknown>);
});

export const updateHomepageSection = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'homepage_sections', req.params.id, normalizeHomepageSectionPayload(req.body) as Record<string, unknown>);
});

export const deleteHomepageSection = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'homepage_sections', req.params.id, req);
});
