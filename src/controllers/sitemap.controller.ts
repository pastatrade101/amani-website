import { supabase } from '../config/supabase';
import { LEGAL_PAGE_IDS } from '../data/legal-pages';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { readAllPages } from '../utils/read-all-pages';

// Only content that has a real public page. Activities and guides currently
// have no corresponding public detail implementation and are not advertised.
const tables = ['tours', 'destinations', 'tour_categories', 'lodges', 'blog_posts', 'comparisons', 'travel_styles', 'safari_packages'] as const;
type ContentRow = { id: string; slug: string };
type TranslationRow = { id: string; entity_type: string; entity_id: string; language_code: string };

export const getSitemapCatalog = asyncHandler(async (_req, res) => {
  try {
    const [collections, languages, translations, overrides] = await Promise.all([
      Promise.all(tables.map(async (table) => {
        const records = await readAllPages<ContentRow>((from, to) => {
          let query = supabase.from(table).select('id,slug', { count: 'exact' })
            .eq('status', 'published').is('deleted_at', null).order('id');
          if (table === 'lodges') query = query.eq('show_property_publicly', true).or('indexable.is.null,indexable.eq.true');
          if (table === 'safari_packages') query = query.eq('indexable', true);
          return query.range(from, to);
        });
        return [table, records] as const;
      })),
      readAllPages<{ code: string }>((from, to) => supabase.from('languages')
        .select('code', { count: 'exact' }).eq('enabled', true).order('code').range(from, to)),
      readAllPages<TranslationRow>((from, to) => supabase.from('content_translations')
        .select('id,entity_type,entity_id,language_code', { count: 'exact' })
        .eq('translation_status', 'published').in('entity_type', [...tables, 'legal_pages'])
        .order('id').range(from, to)),
      readAllPages<{ path: string; robots: string | null; canonical_url: string | null }>((from, to) => supabase.from('page_seo')
        .select('path,robots,canonical_url', { count: 'exact' }).eq('is_active', true)
        .order('path').range(from, to))
    ]);

    const enabled = new Set(languages.map((row) => row.code));
    const byEntity = new Map<string, string[]>();
    for (const row of translations) {
      if (!enabled.has(row.language_code)) continue;
      const key = `${row.entity_type}:${row.entity_id}`;
      byEntity.set(key, [...(byEntity.get(key) ?? []), row.language_code]);
    }
    const locales = (table: string, id: string) => [...new Set(['en', ...(byEntity.get(`${table}:${id}`) ?? [])])];

    return sendSuccess(res, 'Public sitemap inventory fetched successfully.', {
      collections: Object.fromEntries(collections.map(([table, rows]) => [table,
        rows.map((row) => ({ slug: row.slug, locales: locales(table, row.id) }))
      ])),
      languages: [...enabled],
      legalLocales: Object.fromEntries(Object.entries(LEGAL_PAGE_IDS).map(([doc, id]) => [doc, locales('legal_pages', id)])),
      overrides
    });
  } catch (cause) {
    // A successful partial sitemap would quietly remove real pages. Let the
    // crawler retry instead; the public cache never stores error responses.
    throw new AppError('Sitemap inventory is temporarily unavailable.', 503, [cause instanceof Error ? cause.message : String(cause)]);
  }
});
