// Bulk itinerary (tour) importer — one CSV row = one full itinerary, including
// its type/category, day-by-day plan, inclusions, exclusions and pricing tiers.
//
// The import is idempotent: rows are matched to existing tours by `slug`
// (derived from the title when omitted). Matching tours are UPDATED and their
// child rows (days / inclusions / exclusions / price options) are REPLACED;
// new slugs are INSERTED. Category and destination are resolved by slug or name
// and created on the fly if they don't exist yet.
import { supabase } from '../config/supabase';
import { sanitizeRichFields } from '../utils/rich-text';

export type ImportRowResult = {
  line: number;
  status: 'ok' | 'error';
  action?: 'created' | 'updated';
  title?: string;
  slug?: string;
  days?: number;
  inclusions?: number;
  exclusions?: number;
  price_options?: number;
  warnings?: string[];
  error?: string;
};

export type ImportResult = {
  summary: { total: number; created: number; updated: number; failed: number };
  results: ImportRowResult[];
};

// ── small helpers ───────────────────────────────────────────────────────────
const slugify = (value: string): string =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const toInt = (value: string | undefined, fallback: number | null = null): number | null => {
  const n = parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

const toNum = (value: string | undefined, fallback = 0): number => {
  const n = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (value: string | undefined): boolean => /^(1|true|yes|y)$/i.test(String(value ?? '').trim());

const splitList = (value: string | undefined, sep = '|'): string[] =>
  String(value ?? '')
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

export const splitTourItemList = (value: string | undefined, label: string, warnings?: string[]): string[] => {
  const raw = String(value ?? '').trim();
  if (!raw) return [];

  if (raw.includes('|')) return splitList(raw);

  const semicolonItems = raw
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (semicolonItems.length > 1) {
    warnings?.push(`${label} used semicolons; split into ${semicolonItems.length} items. Use | in CSV files to avoid ambiguity.`);
    return semicolonItems;
  }

  return splitList(raw);
};

const normalizeStatus = (value: string | undefined): 'draft' | 'published' | 'archived' => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'published' || v === 'archived' ? v : 'draft';
};

/** A blank (or absent) cell means "leave whatever is already there" rather than
 *  "clear it" — the same rule the generic entity importer follows. Without this,
 *  re-running a file that omits images, pricing tiers, group sizes or a status
 *  would silently wipe work done in the admin since the previous import. */
const has = (value: string | undefined): boolean => String(value ?? '').trim() !== '';

/** Assign `value` to `key` only when the CSV actually supplied `raw`. */
const put = (target: Record<string, unknown>, key: string, raw: string | undefined, value: unknown): void => {
  if (has(raw)) target[key] = value;
};

/** Parse the `days` cell: days separated by `||`, fields by `~` in the fixed
 *  order  title ~ accommodation ~ description ~ image_url. Day number = order. */
const parseDays = (value: string | undefined) =>
  String(value ?? '')
    .split('||')
    .map((chunk) => chunk.split('~').map((f) => f.trim()))
    .map((f) => ({ title: f[0] ?? '', accommodation: f[1] ?? '', description: f[2] ?? '', image_url: f[3] ?? '' }))
    .filter((d) => d.title);

/** Parse the `price_options` cell: options separated by `||`, fields by `~` in
 *  the order  label ~ price ~ price_type ~ description. */
const PRICE_TYPES = new Set(['per_person', 'per_group', 'per_child', 'single_supplement', 'upgrade', 'discount']);
const parsePriceOptions = (value: string | undefined) =>
  String(value ?? '')
    .split('||')
    .map((chunk) => chunk.split('~').map((f) => f.trim()))
    .map((f) => {
      const type = (f[2] || 'per_person').toLowerCase();
      return {
        label: f[0] ?? '',
        price: toNum(f[1], 0),
        price_type: PRICE_TYPES.has(type) ? type : 'per_person',
        description: f[3] ?? ''
      };
    })
    .filter((p) => p.label);

// ── CSV parsing (RFC-4180-ish: quotes, escaped quotes, embedded commas) ──────
export const parseCsv = (text: string): Record<string, string>[] => {
  const s = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n') {
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    rows.push(record);
  }
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    });
};

// ── resolve / create category + destination ─────────────────────────────────
const resolveCategory = async (input: string, warnings: string[]): Promise<string | null> => {
  const name = input.trim();
  if (!name) return null;
  const slug = slugify(name);

  const bySlug = await supabase.from('tour_categories').select('id').eq('slug', slug).is('deleted_at', null).maybeSingle();
  if (bySlug.data) return bySlug.data.id;
  const byName = await supabase.from('tour_categories').select('id').ilike('name', name).is('deleted_at', null).limit(1).maybeSingle();
  if (byName.data) return byName.data.id;

  const created = await supabase.from('tour_categories').insert({ name, slug, status: 'published' }).select('id').single();
  if (created.error) {
    warnings.push(`Category "${name}" not found and could not be created (${created.error.message}); left unset.`);
    return null;
  }
  warnings.push(`Created new safari type/category "${name}".`);
  return created.data.id;
};

const resolveDestination = async (input: string, country: string, warnings: string[]): Promise<string | null> => {
  const name = input.trim();
  if (!name) return null;
  const slug = slugify(name);

  const bySlug = await supabase.from('destinations').select('id').eq('slug', slug).is('deleted_at', null).maybeSingle();
  if (bySlug.data) return bySlug.data.id;
  const byName = await supabase.from('destinations').select('id').ilike('name', name).is('deleted_at', null).limit(1).maybeSingle();
  if (byName.data) return byName.data.id;

  const created = await supabase
    .from('destinations')
    .insert({ name, slug, country: country || 'Tanzania', status: 'published' })
    .select('id')
    .single();
  if (created.error) {
    warnings.push(`Destination "${name}" not found and could not be created (${created.error.message}); left unset.`);
    return null;
  }
  warnings.push(`Created new destination "${name}".`);
  return created.data.id;
};

// ── replace a tour's child rows ─────────────────────────────────────────────
// Each collection is replaced ONLY when its column carried a value. A blank
// `price_options` cell leaves existing pricing tiers alone instead of deleting
// them; the same goes for days, inclusions and exclusions. To empty a
// collection deliberately, clear it in the admin.
const replaceChildren = async (
  tourId: string,
  supplied: { days: boolean; inclusions: boolean; exclusions: boolean; priceOptions: boolean },
  days: ReturnType<typeof parseDays>,
  inclusions: string[],
  exclusions: string[],
  priceOptions: ReturnType<typeof parsePriceOptions>,
  currency: string
) => {
  const wipes = [];
  if (supplied.days) wipes.push(supabase.from('itinerary_days').delete().eq('tour_id', tourId));
  if (supplied.inclusions) wipes.push(supabase.from('tour_inclusions').delete().eq('tour_id', tourId));
  if (supplied.exclusions) wipes.push(supabase.from('tour_exclusions').delete().eq('tour_id', tourId));
  if (supplied.priceOptions) wipes.push(supabase.from('tour_price_options').delete().eq('tour_id', tourId));
  await Promise.all(wipes);

  if (days.length) {
    // A CSV cell can carry markup just as an editor can, and this importer
    // writes straight to the table rather than through createRecord.
    const rows = days.map((d, idx) =>
      sanitizeRichFields('itinerary_days', {
        tour_id: tourId,
        day_number: idx + 1,
        title: d.title,
        description: d.description || null,
        accommodation: d.accommodation || null,
        image_url: d.image_url || null
      })
    );
    const { error } = await supabase.from('itinerary_days').insert(rows);
    if (error) throw new Error(`itinerary days: ${error.message}`);
  }
  if (inclusions.length) {
    const { error } = await supabase.from('tour_inclusions').insert(inclusions.map((title, idx) => ({ tour_id: tourId, title, sort_order: idx })));
    if (error) throw new Error(`inclusions: ${error.message}`);
  }
  if (exclusions.length) {
    const { error } = await supabase.from('tour_exclusions').insert(exclusions.map((title, idx) => ({ tour_id: tourId, title, sort_order: idx })));
    if (error) throw new Error(`exclusions: ${error.message}`);
  }
  if (priceOptions.length) {
    const rows = priceOptions.map((p, idx) => ({
      tour_id: tourId,
      title: p.label,
      label: p.label,
      price: p.price,
      currency,
      price_type: p.price_type,
      description: p.description || null,
      sort_order: idx
    }));
    const { error } = await supabase.from('tour_price_options').insert(rows);
    if (error) throw new Error(`price options: ${error.message}`);
  }
};

// ── main entry ───────────────────────────────────────────────────────────────
export const importItineraries = async (csvText: string, userId?: string): Promise<ImportResult> => {
  const rows = parseCsv(csvText);
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // account for the header row
    try {
      const title = (r.title || '').trim();
      if (!title) {
        results.push({ line, status: 'error', error: 'Missing required "title".' });
        continue;
      }
      const warnings: string[] = [];
      const slug = slugify(r.slug || title);
      const durationDays = toInt(r.duration_days, 1) || 1;

      const categoryId = r.category ? await resolveCategory(r.category, warnings) : null;
      const destinationId = r.destination ? await resolveDestination(r.destination, r.destination_country || 'Tanzania', warnings) : null;

      const existing = await supabase.from('tours').select('id, currency').eq('slug', slug).is('deleted_at', null).maybeSingle();

      // Price tiers need a currency even when the CSV omits the column; fall
      // back to the currency already on the tour before defaulting to USD.
      const currency = has(r.currency)
        ? r.currency.toUpperCase().slice(0, 3)
        : (existing.data?.currency as string | undefined) || 'USD';

      // Only columns the CSV actually supplied are written. Anything left blank
      // keeps its current value on an update, and falls back to the column
      // default on an insert.
      const payload: Record<string, unknown> = {
        title,
        slug,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString()
      };
      put(payload, 'short_description', r.short_description, r.short_description);
      put(payload, 'full_description', r.full_description, r.full_description);
      put(payload, 'experience_type', r.experience_type, r.experience_type);
      put(payload, 'budget_tier', r.budget_tier, r.budget_tier);
      put(payload, 'persona_tags', r.persona_tags, splitList(r.persona_tags));
      put(payload, 'duration_days', r.duration_days, durationDays);
      put(payload, 'price_from', r.price_from, toNum(r.price_from, 0));
      put(payload, 'group_size_min', r.group_size_min, toInt(r.group_size_min));
      put(payload, 'group_size_max', r.group_size_max, toInt(r.group_size_max));
      put(payload, 'minimum_age', r.minimum_age, toInt(r.minimum_age));
      put(payload, 'difficulty_level', r.difficulty_level, r.difficulty_level);
      put(payload, 'start_location', r.start_location, r.start_location);
      put(payload, 'end_location', r.end_location, r.end_location);
      put(payload, 'highlights', r.highlights, splitList(r.highlights));
      put(payload, 'main_image_url', r.main_image_url, r.main_image_url);
      put(payload, 'banner_image_url', r.banner_image_url, r.banner_image_url);
      put(payload, 'status', r.status, normalizeStatus(r.status));
      put(payload, 'is_featured', r.is_featured, toBool(r.is_featured));
      put(payload, 'is_popular', r.is_popular, toBool(r.is_popular));
      put(payload, 'seo_title', r.seo_title, r.seo_title);
      put(payload, 'meta_title', r.meta_title, r.meta_title);
      put(payload, 'meta_description', r.meta_description, r.meta_description);
      if (has(r.currency)) payload.currency = currency;
      // A resolved link only; an unresolvable name already raised a warning and
      // must not blank out a link that is already correct in the CMS.
      if (categoryId) payload.category_id = categoryId;
      if (destinationId) payload.destination_id = destinationId;
      // Nights stay consistent with days: derive them whenever days changed and
      // the nights column was left blank.
      if (has(r.duration_nights)) {
        payload.duration_nights = toInt(r.duration_nights, Math.max(0, durationDays - 1));
      } else if (has(r.duration_days)) {
        payload.duration_nights = Math.max(0, durationDays - 1);
      }

      let tourId: string;
      let action: 'created' | 'updated';
      if (existing.data) {
        tourId = existing.data.id;
        const { error } = await supabase.from('tours').update(sanitizeRichFields('tours', payload)).eq('id', tourId);
        if (error) throw new Error(error.message);
        action = 'updated';
      } else {
        const { data, error } = await supabase
          .from('tours')
          .insert({ ...sanitizeRichFields('tours', payload), created_by: userId ?? null })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        tourId = data.id;
        action = 'created';
      }

      const days = parseDays(r.days);
      const inclusions = splitTourItemList(r.inclusions, 'inclusions', warnings);
      const exclusions = splitTourItemList(r.exclusions, 'exclusions', warnings);
      const priceOptions = parsePriceOptions(r.price_options);
      const supplied = {
        days: has(r.days),
        inclusions: has(r.inclusions),
        exclusions: has(r.exclusions),
        priceOptions: has(r.price_options)
      };
      await replaceChildren(tourId, supplied, days, inclusions, exclusions, priceOptions, currency);

      // Tell the operator what was deliberately left alone, so a re-import that
      // preserves images or pricing does not look like it silently skipped them.
      if (action === 'updated') {
        const kept = Object.entries(supplied)
          .filter(([, wasSupplied]) => !wasSupplied)
          .map(([name]) => (name === 'priceOptions' ? 'price options' : name));
        if (kept.length) warnings.push(`Column blank — kept existing ${kept.join(', ')}.`);
      }

      results.push({
        line,
        status: 'ok',
        action,
        title,
        slug,
        days: days.length,
        inclusions: inclusions.length,
        exclusions: exclusions.length,
        price_options: priceOptions.length,
        warnings: warnings.length ? warnings : undefined
      });
    } catch (err) {
      results.push({ line, status: 'error', title: r.title, slug: r.slug, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    summary: {
      total: results.length,
      created: results.filter((x) => x.action === 'created').length,
      updated: results.filter((x) => x.action === 'updated').length,
      failed: results.filter((x) => x.status === 'error').length
    },
    results
  };
};
