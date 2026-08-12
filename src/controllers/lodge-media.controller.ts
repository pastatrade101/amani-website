import type { Response } from 'express';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

/**
 * Gallery and amenities for an accommodation.
 *
 * Every read here is fail-soft. The tables arrive in a migration the operator
 * runs by hand, so between deploying this code and running that SQL the site
 * must carry on exactly as before rather than 500 — an empty gallery simply
 * falls back to the lodge's existing image fields.
 */

type Row = Record<string, unknown>;

const softly = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run();
  } catch {
    return fallback;
  }
};

/** Ordered gallery for one property. Empty when the table is not there yet. */
export const imagesForLodge = async (lodgeId: string): Promise<Row[]> =>
  softly(async () => {
    const { data, error } = await supabase
      .from('lodge_images')
      .select('id,image_url,alt_text,caption,category,is_featured,sort_order,is_cover')
      .eq('lodge_id', lodgeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []) as Row[];
  }, []);

/** Amenities attached to one property, in display order. */
export const amenitiesForLodge = async (lodgeId: string): Promise<Row[]> =>
  softly(async () => {
    const { data, error } = await supabase
      .from('lodge_amenities')
      .select('amenity_id, amenities(id,name,icon_key,sort_order,is_active)')
      .eq('lodge_id', lodgeId);
    if (error) return [];

    return ((data ?? []) as Row[])
      .map((row) => row.amenities as Row | null)
      .filter((amenity): amenity is Row => Boolean(amenity) && amenity!.is_active !== false)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }, []);

/**
 * Tours whose itinerary actually stays at this property.
 *
 * Built on the real itinerary_days.accommodation_id link — never on "same
 * destination", which would claim a trip uses a lodge it may not.
 */
export const toursFeaturingLodge = async (lodgeId: string): Promise<Row[]> =>
  softly(async () => {
    const [days, attached] = await Promise.all([
      supabase.from('itinerary_days').select('tour_id, tours!inner(id,title,slug,status,deleted_at,duration_days,price_from,currency,main_image_url)').eq('accommodation_id', lodgeId),
      supabase.from('lodge_tours').select('tour_id, tours!inner(id,title,slug,status,deleted_at,duration_days,price_from,currency,main_image_url)').eq('lodge_id', lodgeId)
    ]);
    if (days.error && attached.error) return [];

    const seen = new Set<string>();
    const tours: Row[] = [];
    for (const row of ([...(days.data ?? []), ...(attached.data ?? [])]) as Row[]) {
      const tour = row.tours as Row | null;
      if (!tour || tour.deleted_at || tour.status !== 'published') continue;
      const id = String(tour.id);
      if (seen.has(id)) continue;
      seen.add(id);
      tours.push(tour);
    }
    return tours.slice(0, 6);
  }, []);

const lodgeIdOr404 = async (id: string): Promise<string> => {
  const { data, error } = await supabase.from('lodges').select('id').eq('id', id).maybeSingle();
  if (error) throw new AppError('Unable to load the property.', 500, [error]);
  if (!data) throw new AppError('Property not found.', 404);
  return String((data as Row).id);
};

/** Everything the admin editor needs for the Gallery and Amenities sections. */
export const getLodgeMedia = asyncHandler(async (req, res) => {
  const lodgeId = await lodgeIdOr404(req.params.id);
  const [images, attached, all] = await Promise.all([
    imagesForLodge(lodgeId),
    amenitiesForLodge(lodgeId),
    softly(async () => {
      const { data } = await supabase
        .from('amenities')
        .select('id,name,icon_key,sort_order,is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      return (data ?? []) as Row[];
    }, [])
  ]);

  return sendSuccess(res, 'Property media fetched successfully.', {
    images,
    amenity_ids: attached.map((amenity) => String(amenity.id)),
    amenities: all
  });
});

const notMigrated = (res: Response) =>
  new AppError(
    'The accommodation gallery tables are not in the database yet. Run the 2026-08-10 accommodation migration first.',
    503
  );

/** Replace the whole gallery in one go, in the order the admin arranged it. */
export const replaceLodgeImages = asyncHandler(async (req, res) => {
  const lodgeId = await lodgeIdOr404(req.params.id);
  const incoming = ((req.body as { images?: Row[] }).images ?? []) as Row[];

  // Exactly one cover: the flagged one, else the first image. The database has
  // a partial unique index on this, so sending two would be rejected outright.
  const coverAt = Math.max(
    0,
    incoming.findIndex((image) => image.is_cover === true)
  );

  const rows = incoming.map((image, index) => ({
    lodge_id: lodgeId,
    image_url: String(image.image_url),
    alt_text: image.alt_text ? String(image.alt_text) : null,
    caption: image.caption ? String(image.caption) : null,
    category: image.category ? String(image.category) : 'EXTERIOR',
    is_featured: image.is_featured === true,
    sort_order: index,
    is_cover: index === coverAt && incoming.length > 0
  }));

  // Delete-then-insert is safe here in a way it is not for tour inclusions:
  // these rows are derived entirely from what the client just sent, so a
  // failure loses nothing the admin cannot immediately re-save.
  const del = await supabase.from('lodge_images').delete().eq('lodge_id', lodgeId);
  if (del.error) throw notMigrated(res);

  if (rows.length) {
    const ins = await supabase.from('lodge_images').insert(rows);
    if (ins.error) throw new AppError('Unable to save the gallery.', 500, [ins.error]);
  }

  await safeAudit({ action: 'update', entityId: lodgeId, entityType: 'lodge_images', newData: { count: rows.length }, req });

  return sendSuccess(res, 'Gallery saved successfully.', { count: rows.length });
});

/** Replace the amenity set for one property. */
export const replaceLodgeAmenities = asyncHandler(async (req, res) => {
  const lodgeId = await lodgeIdOr404(req.params.id);
  const ids = [...new Set(((req.body as { amenity_ids?: string[] }).amenity_ids ?? []).map(String))];

  const del = await supabase.from('lodge_amenities').delete().eq('lodge_id', lodgeId);
  if (del.error) throw notMigrated(res);

  if (ids.length) {
    const ins = await supabase
      .from('lodge_amenities')
      .insert(ids.map((amenityId) => ({ lodge_id: lodgeId, amenity_id: amenityId })));
    if (ins.error) throw new AppError('Unable to save amenities.', 500, [ins.error]);
  }

  await safeAudit({ action: 'update', entityId: lodgeId, entityType: 'lodge_amenities', newData: { count: ids.length }, req });

  return sendSuccess(res, 'Amenities saved successfully.', { count: ids.length });
});

/** The reusable amenity list, for the admin picker. */
export const listAmenities = asyncHandler(async (_req, res) => {
  const items = await softly(async () => {
    const { data } = await supabase
      .from('amenities')
      .select('id,name,icon_key,sort_order,is_active')
      .order('sort_order', { ascending: true });
    return (data ?? []) as Row[];
  }, []);

  return sendSuccess(res, 'Amenities fetched successfully.', { items });
});
